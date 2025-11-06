import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface KeywordExtractionRequest {
  jobDescription: string
}

interface ExtractedKeyword {
  term: string
  importance: number // 0-100
  category: 'hard' | 'soft'
  requirementLevel: 'required' | 'preferred' | 'optional'
  context?: string
}

interface ExperienceRequirement {
  skill: string
  years: number
  isMinimum: boolean
}

interface KeywordExtractionResponse {
  hardSkills: ExtractedKeyword[]
  softSkills: ExtractedKeyword[]
  experienceRequirements: ExperienceRequirement[]
  certifications: string[]
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
    // Optional authentication for development/testing
    // TODO: Re-enable strict auth before production
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let user = null
    let isAuthenticated = false

    if (authHeader) {
      try {
        const { data: { user: authenticatedUser }, error: userError } =
          await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

        if (!userError && authenticatedUser) {
          user = authenticatedUser
          isAuthenticated = true

          // Check quota for authenticated users
          const { data: quotaCheck } = await supabase.rpc('check_quota', {
            p_user_id: user.id,
            p_type: 'keyword_extraction',
          })

          if (!quotaCheck?.allowed) {
            return new Response(
              JSON.stringify({ error: 'Keyword extraction quota exceeded' }),
              {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }
        }
      } catch (authError) {
        console.warn('[Keyword Extraction] Auth failed, proceeding unauthenticated:', authError)
      }
    }

    console.log('[Keyword Extraction] Request authenticated:', isAuthenticated)

    // Parse request body
    const body: KeywordExtractionRequest = await req.json()
    const { jobDescription } = body

    if (!jobDescription || jobDescription.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Job description is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Truncate job description to manage costs (max 3000 chars ~ 750 tokens)
    const truncatedDescription = jobDescription.slice(0, 3000)

    // System prompt for ATS keyword extraction
    const systemPrompt = `You are an expert ATS (Applicant Tracking System) keyword extraction engine. Your job is to analyze job descriptions and extract the most important, relevant keywords that candidates need to match.

**Your tasks:**
1. Extract technical skills, tools, technologies, and software
2. Identify soft skills (communication, leadership, etc.)
3. Categorize each keyword as "required" or "preferred" based on context
4. Assign importance scores (0-100) based on:
   - Frequency of mention
   - Section placement (requirements = higher score)
   - Requirement level (required > preferred > optional)
   - Technical specificity (React.js > JavaScript frameworks)
5. Extract experience requirements (years of experience for specific skills)
6. Identify required certifications

**Critical guidelines:**
- Focus on actionable, specific terms candidates can match
- Ignore marketing fluff, company descriptions, and boilerplate text
- Prioritize technical requirements over generic descriptions
- Extract individual keywords, NOT multi-line blocks or paragraphs
- Use consistent, normalized terminology (e.g., "JavaScript" not "js")

Return results ONLY as valid JSON with no additional text or explanation.`

    const userPrompt = `Analyze this job description and extract ATS keywords:

${truncatedDescription}

Return a JSON object with this EXACT structure:
{
  "hardSkills": [
    {"term": "React", "importance": 95, "category": "hard", "requirementLevel": "required", "context": "5+ years React experience"},
    {"term": "TypeScript", "importance": 90, "category": "hard", "requirementLevel": "required"}
  ],
  "softSkills": [
    {"term": "communication", "importance": 85, "category": "soft", "requirementLevel": "required"},
    {"term": "leadership", "importance": 75, "category": "soft", "requirementLevel": "preferred"}
  ],
  "experienceRequirements": [
    {"skill": "React", "years": 5, "isMinimum": true}
  ],
  "certifications": ["AWS Certified", "PMP"]
}`

    console.log('[Keyword Extraction] Calling Grok-4-Fast API...')

    // Call OpenRouter with Grok-4-Fast
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://juno-ats.com',
        'X-Title': 'Juno ATS Extension',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.3, // Lower for more consistent extraction
        response_format: { type: "json_object" }
      }),
    })

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json()
      console.error('[Keyword Extraction] OpenRouter error:', errorData)
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`)
    }

    const grokData = await openRouterResponse.json()
    console.log('[Keyword Extraction] Grok response received')

    const keywordData = JSON.parse(grokData.choices[0].message.content)

    // Increment usage quota only for authenticated users
    if (isAuthenticated && user) {
      await supabase.rpc('increment_usage', {
        p_user_id: user.id,
        p_type: 'keyword_extraction',
        p_amount: 1,
      })
    }

    console.log('[Keyword Extraction] Success - extracted',
      keywordData.hardSkills?.length || 0, 'hard skills and',
      keywordData.softSkills?.length || 0, 'soft skills',
      isAuthenticated ? `(user: ${user?.id})` : '(unauthenticated)')

    return new Response(
      JSON.stringify({
        success: true,
        data: keywordData,
        meta: {
          tokensUsed: grokData.usage?.total_tokens || 0,
          model: grokData.model,
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error: any) {
    console.error('[Keyword Extraction] Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Keyword extraction failed',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
