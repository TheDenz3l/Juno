import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface AIRequest {
  type: 'bullets' | 'summary' | 'cover_letter'
  resumeText: string
  jobDescription: string
  section?: string // for bullets
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (userError || !user) {
      throw new Error('Invalid auth token')
    }

    // Check quota
    const { data: quotaCheck } = await supabase.rpc('check_quota', {
      p_user_id: user.id,
      p_type: 'ai_call',
    })

    if (!quotaCheck?.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Quota exceeded',
          message: `You've reached your AI suggestion limit. Current: ${quotaCheck?.current}, Limit: ${quotaCheck?.limit}`,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const body: AIRequest = await req.json()

    // Scrub PII from resume text
    const scrubbedResume = scrubPII(body.resumeText)
    const scrubbedJob = scrubPII(body.jobDescription)

    // Generate AI suggestion
    const suggestion = await generateAISuggestion(body.type, scrubbedResume, scrubbedJob, body.section)

    // Increment usage
    await supabase.rpc('increment_usage', {
      p_user_id: user.id,
      p_type: 'ai_call',
      p_amount: 1,
    })

    return new Response(JSON.stringify({ suggestion }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

async function generateAISuggestion(
  type: AIRequest['type'],
  resumeText: string,
  jobDescription: string,
  section?: string
): Promise<any> {
  const prompts = {
    bullets: `You are a professional resume writer. Given the following resume section and job description, rewrite the resume bullets to better match the job requirements.

Job Description:
${jobDescription.substring(0, 1000)}

Resume Section (${section || 'Experience'}):
${resumeText.substring(0, 500)}

Instructions:
- Use strong action verbs
- Quantify achievements where possible
- Highlight relevant skills from the job description
- Keep each bullet under 2 lines
- Return 3-5 improved bullet points as JSON array

Return format:
{
  "bullets": ["bullet 1", "bullet 2", "bullet 3"],
  "rationale": "Brief explanation of changes"
}`,

    summary: `You are a professional resume writer. Given the following resume and job description, write a compelling professional summary.

Job Description:
${jobDescription.substring(0, 1000)}

Current Resume:
${resumeText.substring(0, 800)}

Instructions:
- 2-3 sentences
- Highlight relevant experience and skills
- Match the tone of the job posting
- Include key accomplishments

Return format:
{
  "summary": "Your professional summary here",
  "rationale": "Brief explanation"
}`,

    cover_letter: `You are a professional career coach. Write a compelling cover letter for the following job.

Job Description:
${jobDescription.substring(0, 1500)}

Candidate Background:
${resumeText.substring(0, 1000)}

Instructions:
- Professional tone
- 3-4 paragraphs
- Highlight relevant experience
- Show enthusiasm for the role
- Include specific examples from their background

Return format:
{
  "cover_letter": "Full cover letter text",
  "tone": "neutral|friendly|formal"
}`
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SUPABASE_URL,
    },
    body: JSON.stringify({
      model: 'minimax/minimax-m2:free',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer and career coach. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompts[type],
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  try {
    return JSON.parse(content)
  } catch {
    // If not valid JSON, return as plain text
    return { text: content }
  }
}

function scrubPII(text: string): string {
  // Remove email addresses
  let scrubbed = text.replace(/[\w.+-]+@[\w.-]+\.\w{2,}/gi, '[EMAIL]')

  // Remove phone numbers
  scrubbed = scrubbed.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]')

  // Remove street addresses (basic pattern)
  scrubbed = scrubbed.replace(/\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct)/gi, '[ADDRESS]')

  return scrubbed
}
