import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Pro features will be disabled.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Auth helpers
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase not configured')

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null

  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export async function getProfile(userId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Usage quota helpers
export async function checkQuota(type: 'match' | 'ai_suggestion' | 'ai_call') {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('check_quota', {
    p_user_id: user.id,
    p_type: type,
  })

  if (error) throw error
  return data
}

export async function incrementUsage(type: 'match' | 'ai_suggestion' | 'ai_call', amount = 1) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('increment_usage', {
    p_user_id: user.id,
    p_type: type,
    p_amount: amount,
  })

  if (error) throw error
  return data
}

// Resume sync helpers
export async function syncResume(resume: any) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('resumes')
    .upsert({
      id: resume.id,
      user_id: user.id,
      name: resume.name,
      content: resume.content,
      sections: resume.sections,
      is_active: resume.id === resume.activeResumeId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSyncedResumes() {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

// Application sync helpers
export async function syncApplication(application: any) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('applications')
    .upsert({
      id: application.id,
      user_id: user.id,
      resume_id: application.resumeId,
      job_title: application.jobTitle,
      company: application.company,
      job_url: application.jobUrl,
      job_description: application.jobDescription,
      job_source: application.jobSource,
      ats_score: application.atsScore,
      status: application.status,
      notes: application.notes,
      callback_received: application.callbackReceived,
      callback_at: application.callbackAt,
      applied_at: application.appliedAt,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// AI suggestion helper
export async function generateAISuggestion(
  type: 'bullets' | 'summary' | 'cover_letter',
  resumeText: string,
  jobDescription: string,
  section?: string
) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-suggestions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type,
      resumeText,
      jobDescription,
      section,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to generate AI suggestion')
  }

  const data = await response.json()
  return data.suggestion
}
