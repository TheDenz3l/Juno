/**
 * Grok-4-Fast Keyword Extractor
 * Cloud-based ATS keyword extraction using OpenRouter's Grok API
 */

export interface GrokKeyword {
  term: string
  importance: number // 0-100
  category: 'hard' | 'soft'
  requirementLevel: 'required' | 'preferred' | 'optional'
  context?: string
}

export interface GrokExperienceRequirement {
  skill: string
  years: number
  isMinimum: boolean
}

export interface GrokExtractionResult {
  hardSkills: GrokKeyword[]
  softSkills: GrokKeyword[]
  experienceRequirements: GrokExperienceRequirement[]
  certifications: string[]
  meta?: {
    tokensUsed: number
    model: string
  }
}

export interface GrokExtractorOptions {
  timeout?: number // milliseconds
  maxRetries?: number
}

/**
 * Extract keywords from job description using Grok AI
 */
export async function extractKeywordsWithGrok(
  jobDescription: string,
  userAuthToken?: string,
  options: GrokExtractorOptions = {}
): Promise<GrokExtractionResult> {

  const { timeout = 30000, maxRetries = 2 } = options
  const startTime = Date.now()

  // Validate inputs
  if (!jobDescription || jobDescription.trim().length === 0) {
    throw new Error('Job description is required')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured')
  }

  const makeRequest = async (): Promise<GrokExtractionResult> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      console.log('[Grok Extractor] Calling keyword extraction API...',
        userAuthToken ? '(authenticated)' : '(unauthenticated)')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Use user token if available, otherwise use anon key.
      // Supabase edge functions expect Authorization header even for anon access.
      if (userAuthToken) {
        headers['Authorization'] = `Bearer ${userAuthToken}`
        if (supabaseAnonKey) {
          headers['apikey'] = supabaseAnonKey
        }
      } else if (supabaseAnonKey) {
        headers['Authorization'] = `Bearer ${supabaseAnonKey}`
        headers['apikey'] = supabaseAnonKey
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/keyword-extraction`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jobDescription: jobDescription.slice(0, 5000), // Limit input size
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        } else if (response.status === 429) {
          throw new Error('Keyword extraction quota exceeded. Please upgrade your plan.')
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid job description')
        }

        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success || !result.data) {
        throw new Error('Invalid response from keyword extraction API')
      }

      console.log('[Grok Extractor] Success! Extracted',
        result.data.hardSkills?.length || 0, 'hard skills and',
        result.data.softSkills?.length || 0, 'soft skills in',
        Date.now() - startTime, 'ms')

      return {
        hardSkills: result.data.hardSkills || [],
        softSkills: result.data.softSkills || [],
        experienceRequirements: result.data.experienceRequirements || [],
        certifications: result.data.certifications || [],
        meta: result.meta
      }

    } catch (error: any) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }

      throw error
    }
  }

  // Retry logic with exponential backoff
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await makeRequest()
    } catch (error: any) {
      lastError = error
      console.warn(`[Grok Extractor] Attempt ${attempt + 1} failed:`, error.message)

      // Don't retry on authentication or quota errors
      if (error.message.includes('Authentication') ||
          error.message.includes('quota')) {
        throw error
      }

      // Retry with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt)
        console.log(`[Grok Extractor] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}

/**
 * Cache for job description keywords to avoid redundant API calls
 */
const keywordCache = new Map<string, {
  result: GrokExtractionResult
  timestamp: number
}>()

const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Hash function for job descriptions (simple but effective)
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Extract keywords with caching to minimize API calls
 */
export async function extractKeywordsWithCache(
  jobDescription: string,
  userAuthToken?: string,
  options: GrokExtractorOptions = {}
): Promise<GrokExtractionResult> {

  // Generate cache key
  const cacheKey = await hashString(jobDescription)

  // Check cache
  const cached = keywordCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log('[Grok Extractor] Using cached keywords')
    return cached.result
  }

  // Extract fresh keywords
  const result = await extractKeywordsWithGrok(jobDescription, userAuthToken, options)

  // Store in cache
  keywordCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  })

  // Clean old cache entries (keep last 50)
  if (keywordCache.size > 50) {
    const entries = Array.from(keywordCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    entries.slice(0, entries.length - 50).forEach(([key]) => {
      keywordCache.delete(key)
    })
  }

  return result
}

/**
 * Clear the keyword cache (useful for testing or manual refresh)
 */
export function clearKeywordCache(): void {
  keywordCache.clear()
  console.log('[Grok Extractor] Cache cleared')
}
