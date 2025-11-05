// Application state types
export interface Resume {
  id: string
  name: string
  content: string
  sections: {
    contact?: ContactSection
    summary?: string
    experience?: ExperienceItem[]
    education?: EducationItem[]
    skills?: string[]
  }
  createdAt: Date
  updatedAt: Date
}

export interface ContactSection {
  name: string
  email: string
  phone?: string
  location?: string
  linkedin?: string
  website?: string
}

export interface ExperienceItem {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  description: string[]
}

export interface EducationItem {
  id: string
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
}

export interface JobPosting {
  id: string
  title: string
  company?: string
  description: string
  url: string
  source: 'indeed' | 'linkedin' | 'glassdoor'
  detectedAt: Date
}

export interface ATSScore {
  score: number // 0-100
  missingKeywords: string[]
  matchedKeywords: string[]
  analysis: {
    hardSkills: { matched: string[]; missing: string[] }
    softSkills: { matched: string[]; missing: string[] }
  }
}

export interface Application {
  id: string
  jobId: string
  resumeId: string
  status: 'applied' | 'interviewing' | 'rejected' | 'offer'
  atsScore?: number
  appliedAt: Date
  notes?: string
  callbackReceived?: boolean
  callbackAt?: Date
}

export interface User {
  id: string
  email: string
  plan: 'free' | 'pro' | 'premium'
  usage: {
    matchesThisMonth: number
    aiSuggestionsThisMonth: number
    resumeCount: number
    aiCallsThisMonth: number
  }
  quotas: {
    maxMatches: number
    maxAISuggestions: number
    maxResumes: number
    maxAICalls: number
  }
}

export interface AISuggestion {
  id: string
  type: 'bullets' | 'summary' | 'cover_letter'
  original: string
  suggestion: string
  rationale?: string
}
