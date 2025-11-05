import { Resume, JobPosting, ATSScore } from '@/types'

// Common stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'you', 'your', 'their', 'our', 'this',
  'have', 'had', 'been', 'can', 'could', 'should', 'would', 'may', 'must'
])

// Common hard skills keywords (tech-focused, expandable)
const HARD_SKILLS_PATTERNS = [
  // Programming languages
  /\b(javascript|typescript|python|java|c\+\+|c#|ruby|go|rust|php|swift|kotlin)\b/gi,
  // Frameworks
  /\b(react|vue|angular|node\.?js|express|django|flask|spring|\.net|rails)\b/gi,
  // Tools & platforms
  /\b(git|docker|kubernetes|aws|azure|gcp|jenkins|ci\/cd|terraform|ansible)\b/gi,
  // Databases
  /\b(sql|postgresql|mysql|mongodb|redis|elasticsearch|oracle|dynamodb)\b/gi,
  // Methodologies
  /\b(agile|scrum|kanban|devops|test[- ]driven|tdd|bdd)\b/gi,
  // Certifications
  /\b(aws certified|pmp|cissp|comptia|microsoft certified|google certified)\b/gi,
]

// Soft skills patterns
const SOFT_SKILLS = [
  'leadership', 'communication', 'collaboration', 'teamwork', 'problem[- ]solving',
  'critical thinking', 'time management', 'adaptability', 'creativity', 'analytical',
  'organized', 'detail[- ]oriented', 'self[- ]motivated', 'proactive', 'strategic'
]

export interface KeywordMatch {
  keyword: string
  inResume: boolean
  category: 'hard' | 'soft'
}

export function calculateATSScore(resume: Resume, job: JobPosting): ATSScore {
  // Extract keywords from job description
  const jobKeywords = extractKeywords(job.description)

  // Extract keywords from resume
  const resumeText = buildResumeText(resume)
  const resumeKeywords = extractKeywords(resumeText)

  // Categorize keywords
  const { hardSkills: jobHardSkills, softSkills: jobSoftSkills } = categorizeKeywords(jobKeywords)
  const { hardSkills: resumeHardSkills, softSkills: resumeSoftSkills } = categorizeKeywords(resumeKeywords)

  // Calculate matches
  const hardSkillsMatched: string[] = []
  const hardSkillsMissing: string[] = []

  jobHardSkills.forEach(skill => {
    if (resumeHardSkills.some(rs => normalizeKeyword(rs) === normalizeKeyword(skill))) {
      hardSkillsMatched.push(skill)
    } else {
      hardSkillsMissing.push(skill)
    }
  })

  const softSkillsMatched: string[] = []
  const softSkillsMissing: string[] = []

  jobSoftSkills.forEach(skill => {
    if (resumeSoftSkills.some(rs => normalizeKeyword(rs) === normalizeKeyword(skill))) {
      softSkillsMatched.push(skill)
    } else {
      softSkillsMissing.push(skill)
    }
  })

  // Calculate score (0-100)
  const totalJobKeywords = jobHardSkills.length + jobSoftSkills.length
  const totalMatched = hardSkillsMatched.length + softSkillsMatched.length

  const score = totalJobKeywords > 0
    ? Math.round((totalMatched / totalJobKeywords) * 100)
    : 0

  // Get top 10 missing keywords
  const allMissing = [...hardSkillsMissing, ...softSkillsMissing]
  const topMissing = deduplicateKeywords(allMissing).slice(0, 10)

  return {
    score,
    missingKeywords: topMissing,
    matchedKeywords: deduplicateKeywords([...hardSkillsMatched, ...softSkillsMatched]),
    analysis: {
      hardSkills: {
        matched: hardSkillsMatched,
        missing: hardSkillsMissing
      },
      softSkills: {
        matched: softSkillsMatched,
        missing: softSkillsMissing
      }
    }
  }
}

// Extract keywords from text
function extractKeywords(text: string): string[] {
  const keywords: string[] = []

  // Extract multi-word phrases (2-3 words)
  const phrases = text.match(/\b[a-z]+(?:[- ][a-z]+){1,2}\b/gi) || []
  keywords.push(...phrases)

  // Extract single words (excluding stop words)
  const words = text
    .toLowerCase()
    .match(/\b[a-z]{3,}\b/g) || []

  const filteredWords = words.filter(word => !STOP_WORDS.has(word))
  keywords.push(...filteredWords)

  return keywords
}

// Categorize keywords into hard/soft skills
function categorizeKeywords(keywords: string[]): {
  hardSkills: string[]
  softSkills: string[]
} {
  const hardSkills: string[] = []
  const softSkills: string[] = []

  keywords.forEach(keyword => {
    const normalized = keyword.toLowerCase()

    // Check if it's a hard skill
    const isHardSkill = HARD_SKILLS_PATTERNS.some(pattern =>
      pattern.test(normalized)
    )

    // Check if it's a soft skill
    const isSoftSkill = SOFT_SKILLS.some(skill => {
      const skillPattern = new RegExp(skill, 'i')
      return skillPattern.test(normalized)
    })

    if (isHardSkill) {
      hardSkills.push(keyword)
    } else if (isSoftSkill) {
      softSkills.push(keyword)
    } else {
      // Default to hard skill if not clearly soft
      hardSkills.push(keyword)
    }
  })

  return { hardSkills, softSkills }
}

// Build searchable text from resume
function buildResumeText(resume: Resume): string {
  const parts: string[] = [resume.content]

  if (resume.sections.summary) {
    parts.push(resume.sections.summary)
  }

  if (resume.sections.skills) {
    parts.push(resume.sections.skills.join(' '))
  }

  if (resume.sections.experience) {
    resume.sections.experience.forEach(exp => {
      parts.push(exp.position, exp.company, ...exp.description)
    })
  }

  return parts.join(' ')
}

// Normalize keyword for comparison
function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

// Deduplicate keywords (handle synonyms and variations)
function deduplicateKeywords(keywords: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []

  keywords.forEach(keyword => {
    const normalized = normalizeKeyword(keyword)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      unique.push(keyword)
    }
  })

  return unique
}

// Suggest keywords to add to resume
export function suggestKeywords(score: ATSScore): string[] {
  return score.missingKeywords.slice(0, 10)
}
