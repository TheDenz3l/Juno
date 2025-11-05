import { Resume, JobPosting, ATSScore } from '@/types'

// Programming languages and technical terms that should NEVER be filtered
// even if they match stop words or are very short
const TECHNICAL_WHITELIST = new Set([
  // Programming languages
  'c', 'c++', 'c#', 'r', 'go', 'f#', 'rust', 'ruby', 'dart', 'lua', 'perl',
  // Short but important terms
  'ai', 'ml', 'ui', 'ux', 'qa', 'ci', 'cd', 'api', 'sdk', 'ide', 'cli',
  'ios', 'aws', 'gcp', 'sql', 'nosql', 'rpa', 'erp', 'crm', 'plc', 'cad',
  'cam', 'iot', 'vpn', 'dns', 'tcp', 'udp', 'http', 'ssl', 'tls', 'ssh',
  'git', 'svn', 'npm', 'pip', 'apt', 'yum', 'bash', 'zsh', 'vim', 'emacs',
  // File extensions
  'js', 'ts', 'py', 'rb', 'go', 'rs', 'php', 'cpp', 'hpp', 'css', 'html',
  'json', 'xml', 'yaml', 'yml', 'md', 'sql', 'sh',
  // Technical operators (preserved form)
  'node.js', '.net', 'asp.net', 'ci/cd', 'tcp/ip'
])

// Common stop words to filter out
const STOP_WORDS = new Set([
  // Articles & prepositions
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'you', 'your', 'their', 'our', 'this',
  'have', 'had', 'been', 'can', 'could', 'should', 'would', 'may', 'must',
  'or', 'but', 'not', 'no', 'yes', 'if', 'then', 'than', 'so', 'too',
  'very', 'just', 'about', 'into', 'through', 'over', 'under', 'out',
  'up', 'down', 'off', 'between', 'during', 'before', 'after', 'above',
  'below', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'only', 'own', 'same', 'than', 'too', 'very', 'can', 'will', 'just',

  // Pronouns
  'i', 'me', 'my', 'we', 'us', 'they', 'them', 'he', 'him', 'she', 'her',
  'who', 'what', 'which', 'when', 'where', 'why', 'how', 'all', 'any',

  // Common verbs
  'do', 'does', 'did', 'doing', 'done', 'get', 'got', 'getting', 'make',
  'made', 'making', 'take', 'taking', 'go', 'going', 'come', 'coming',
  'see', 'seeing', 'saw', 'know', 'knowing', 'knew', 'think', 'thinking',
  'give', 'giving', 'find', 'finding', 'tell', 'telling', 'ask', 'asking',
  'work', 'working', 'seem', 'feel', 'try', 'leave', 'call',

  // Business jargon & filler words
  'company', 'description', 'overview', 'about', 'us', 'we', 'our',
  'offers', 'provides', 'looking', 'seeking', 'opportunity', 'role',
  'position', 'job', 'candidate', 'applicant', 'responsibilities',
  'requirements', 'qualifications', 'benefits', 'perks', 'salary',
  'compensation', 'including', 'include', 'includes', 'such', 'well',
  'also', 'additionally', 'furthermore', 'moreover', 'however',
  'therefore', 'thus', 'hence', 'within', 'without', 'throughout',
  'regarding', 'concerning', 'related', 'associated', 'connection',
  'due', 'based', 'according', 'depending', 'following', 'previous',
  'next', 'first', 'last', 'new', 'old', 'current', 'former', 'future',
  'right', 'left', 'high', 'low', 'large', 'small', 'big', 'little',
  'long', 'short', 'early', 'late', 'good', 'bad', 'great', 'best',
  'better', 'less', 'least', 'much', 'many', 'able', 'available',

  // Generic business words
  'end', 'key', 'main', 'major', 'minor', 'general', 'specific',
  'particular', 'certain', 'various', 'different', 'similar', 'sure',
  'possible', 'likely', 'probably', 'perhaps', 'maybe', 'almost',
  'already', 'always', 'never', 'often', 'sometimes', 'usually',
  'really', 'quite', 'rather', 'enough', 'far', 'near', 'close',
  'open', 'yet', 'still', 'even', 'ever', 'since', 'ago', 'now',
  'today', 'tomorrow', 'yesterday', 'week', 'month', 'year', 'day',
  'time', 'times', 'way', 'ways', 'thing', 'things', 'place', 'places',
  'part', 'parts', 'area', 'areas', 'side', 'sides', 'point', 'points',
  'case', 'cases', 'fact', 'facts', 'level', 'levels', 'order', 'group',
  'groups', 'number', 'numbers', 'system', 'systems', 'program', 'programs',
  'question', 'questions', 'problem', 'problems', 'service', 'services',
  'use', 'uses', 'used', 'using', 'user', 'users', 'need', 'needs',
  'needed', 'want', 'wants', 'wanted', 'help', 'helps', 'helped',

  // Words that start noise phrases
  'every', 'almost', 'nearly', 'quite', 'fairly', 'pretty', 'rather'
])

// Noise phrase patterns to completely filter out
const NOISE_PATTERNS = [
  /^(company|job|position|role|candidate|applicant)\s+description$/gi,
  /^(about|overview)\s+(us|the company|our company)$/gi,
  /^(we|our company|the company)\s+(is|are|offers|provides)$/gi,
  /^(in|on|at|for|with|by|from|to)\s+the\s+/gi,
  /^(for|of|in|on|at|with|by|from|to|through)\s+/gi,
  /^the\s+(right|best|ideal|perfect)/gi,
  /^(right|best|ideal|perfect)\s+solution/gi,
  /^(almost|nearly|quite)\s+every/gi,
  /^is\s+an?\s+/gi,
  /^(leader|leading)\s+in/gi,
  /^offers\s+(the|a|an)/gi,
  /^provides\s+(the|a|an)/gi,
]

// Common hard skills keywords (expandable across multiple domains)
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
  /\b(agile|scrum|kanban|devops|test[- ]driven|tdd|bdd|lean|six[- ]sigma)\b/gi,
  // Certifications
  /\b(aws certified|pmp|cissp|comptia|microsoft certified|google certified|cpa|cfa)\b/gi,

  // Engineering & Design Tools
  /\b(autocad|solidworks|catia|inventor|revit|sketchup|blender|maya|photoshop|illustrator|figma|sketch)\b/gi,
  /\b(cad|cam|cae|fea|cfd|plc|scada|hmi)\b/gi,

  // Sales & Business Tools
  /\b(salesforce|hubspot|crm|erp|sap|oracle|dynamics|pipedrive|zoho)\b/gi,
  /\b(tableau|power[- ]bi|looker|qlik|excel|google analytics|mixpanel)\b/gi,

  // Material Handling & Industrial
  /\b(conveyor[s]?|sortation|intralogistics|warehouse automation|material handling)\b/gi,
  /\b(plc programming|robotics|automation|industrial control|servo[s]?|pneumatic[s]?|hydraulic[s]?)\b/gi,

  // Manufacturing & Production
  /\b(cnc|machining|welding|fabrication|assembly|quality control|iso \d+|gmp|haccp)\b/gi,

  // Degrees & Education
  /\b(bachelor['\u2019]?s?|master['\u2019]?s?|phd|mba|associates?|degree|engineering|mechanical|electrical|computer science)\b/gi,

  // Experience Levels
  /\b(\d+\+?\s*years?|years?\s+of\s+experience|experienced?|senior|junior|mid[- ]level)\b/gi,

  // Technical Concepts
  /\b(api|rest|graphql|microservices|cloud|machine learning|ai|data science|blockchain)\b/gi,
  /\b(networking|tcp\/ip|dns|vpn|firewall|security|encryption|authentication)\b/gi,
]

// Soft skills patterns (pre-compiled for performance)
const SOFT_SKILLS_PATTERNS = [
  /leadership/i,
  /communication/i,
  /collaboration/i,
  /teamwork/i,
  /problem[- ]solving/i,
  /critical thinking/i,
  /time management/i,
  /adaptability/i,
  /creativity/i,
  /analytical/i,
  /organized/i,
  /detail[- ]oriented/i,
  /self[- ]motivated/i,
  /proactive/i,
  /strategic/i,
  /interpersonal/i,
  /presentation/i,
  /negotiation/i,
  /conflict resolution/i,
  /mentoring/i,
  /coaching/i,
  /planning/i,
  /organizational/i,
  /multitasking/i,
  /prioritization/i
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

// Helper function to check if a phrase is valid
function isValidPhrase(phrase: string): boolean {
  const lowerPhrase = phrase.toLowerCase().trim()

  // Check against noise patterns
  for (const pattern of NOISE_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0
    if (pattern.test(lowerPhrase)) {
      return false
    }
  }

  // Split phrase into words
  const words = lowerPhrase.split(/\s+/)

  // Filter phrases that start with stop words
  if (words.length > 0 && STOP_WORDS.has(words[0])) {
    return false
  }

  // Filter phrases that end with stop words (except specific ones)
  const allowedEndWords = new Set(['engineer', 'developer', 'manager', 'designer', 'analyst'])
  if (words.length > 1 && STOP_WORDS.has(words[words.length - 1]) && !allowedEndWords.has(words[words.length - 1])) {
    return false
  }

  // Reject if ALL words in phrase are stop words
  const allStopWords = words.every(w => STOP_WORDS.has(w))
  if (allStopWords) {
    return false
  }

  // Reject phrases with more than 50% stop words
  const stopWordCount = words.filter(w => STOP_WORDS.has(w)).length
  if (stopWordCount / words.length > 0.5) {
    return false
  }

  // Must have at least one word with 4+ characters (to filter out meaningless short phrases)
  const hasSubstantialWord = words.some(w => w.length >= 4 && !STOP_WORDS.has(w))
  if (!hasSubstantialWord) {
    return false
  }

  return true
}

// Helper function to check if a keyword is meaningful
function isMeaningfulKeyword(keyword: string): boolean {
  const lower = keyword.toLowerCase().trim()

  // Check whitelist first - these are ALWAYS meaningful
  if (TECHNICAL_WHITELIST.has(lower)) {
    return true
  }

  // Must be at least 3 characters (unless whitelisted)
  if (lower.length < 3) {
    return false
  }

  // Check if it's a stop word (unless whitelisted)
  if (STOP_WORDS.has(lower)) {
    return false
  }

  // Filter overly generic single words that add no value
  // But keep them if they appear in technical contexts (handled by phrase extraction)
  const genericWords = new Set([
    'impact', 'client', 'customer', 'result',
    'leader', 'leading', 'international', 'global', 'world', 'industry',
    'business', 'professional', 'expert', 'team', 'member', 'person', 'individual'
  ])

  if (genericWords.has(lower)) {
    return false
  }

  return true
}

// Extract keywords from text with frequency tracking
function extractKeywords(text: string): string[] {
  // Extract multi-word phrases (2-4 words) - now includes numbers and special chars
  // Matches: "5+ years", "C++", "Node.js", "ISO 9001", "Bachelor of Science degree"
  const phrases = text.match(/\b[\w.#+]+(?:[- ][\w.#+]+){1,3}\b/gi) || []

  // Extract single words (including numbers, min 2 chars to catch "Go", "C#", etc.)
  // But filter 2-char words later unless whitelisted
  const words = text
    .toLowerCase()
    .match(/\b[\w.#+]{2,30}\b/g) || []  // Added upper limit of 30 chars

  // Combine all potential keywords
  const allKeywords = [...phrases, ...words]

  // Track frequency of each normalized keyword
  const frequencyMap = new Map<string, { original: string; count: number }>()

  allKeywords.forEach(keyword => {
    const normalized = normalizeKeyword(keyword)

    // Validate the keyword first
    const isPhrase = keyword.includes(' ') || keyword.includes('-')
    const isValid = isPhrase ? isValidPhrase(keyword) : isMeaningfulKeyword(keyword)

    if (!isValid) return

    if (frequencyMap.has(normalized)) {
      const entry = frequencyMap.get(normalized)!
      entry.count++
    } else {
      frequencyMap.set(normalized, { original: keyword, count: 1 })
    }
  })

  // Convert frequency map to array and sort by frequency (descending)
  const sortedKeywords = Array.from(frequencyMap.values())
    .sort((a, b) => b.count - a.count)

  // Prioritize keywords that appear 2+ times
  const frequentKeywords = sortedKeywords
    .filter(k => k.count >= 2)
    .map(k => k.original)

  // Include single-occurrence keywords that are likely meaningful
  const singleKeywords = sortedKeywords
    .filter(k => k.count === 1)
    .map(k => k.original)
    // More generous limit for single-occurrence to catch all important skills
    .slice(0, Math.max(50, frequentKeywords.length * 3))

  return [...frequentKeywords, ...singleKeywords]
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

    // Check if it's a soft skill first (more specific, using pre-compiled patterns)
    const isSoftSkill = SOFT_SKILLS_PATTERNS.some(pattern => {
      // Reset regex state to avoid lastIndex issues
      pattern.lastIndex = 0
      return pattern.test(normalized)
    })

    if (isSoftSkill) {
      softSkills.push(keyword)
      return
    }

    // Check if it's a hard skill
    const isHardSkill = HARD_SKILLS_PATTERNS.some(pattern => {
      // Reset regex state to avoid lastIndex issues
      pattern.lastIndex = 0
      return pattern.test(normalized)
    })

    if (isHardSkill) {
      hardSkills.push(keyword)
      return
    }

    // For unrecognized keywords, apply additional heuristics
    // Check if it looks like a technical term (has numbers, special chars, or is uppercase acronym)
    const looksLikeTechnicalTerm =
      /\d/.test(keyword) || // Contains numbers
      /[A-Z]{2,}/.test(keyword) || // Has uppercase acronyms
      keyword.includes('.') || // Has dots (e.g., Node.js)
      keyword.includes('/') || // Has slashes (e.g., CI/CD)
      keyword.includes('-') && keyword.split('-').length <= 2 // Hyphenated term (but not long phrases)

    if (looksLikeTechnicalTerm) {
      hardSkills.push(keyword)
    } else {
      // Only add to hard skills if it seems substantial enough
      // This prevents random generic words from being treated as hard skills
      if (normalized.length >= 6) {
        hardSkills.push(keyword)
      }
      // Otherwise, discard it (don't force it into either category)
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
// Preserves technical terms while normalizing variations
function normalizeKeyword(keyword: string): string {
  const lower = keyword.toLowerCase().trim()

  // Check whitelist first - use exact form for whitelisted terms
  if (TECHNICAL_WHITELIST.has(lower)) {
    return lower
  }

  // Special handling for common technical patterns
  // Preserve these patterns before general normalization
  const specialPatterns: [RegExp, string][] = [
    [/c\+\+/g, 'cpp'],           // C++ → cpp
    [/c#/g, 'csharp'],           // C# → csharp
    [/f#/g, 'fsharp'],           // F# → fsharp
    [/\.net/g, 'dotnet'],        // .NET → dotnet
    [/node\.js/g, 'nodejs'],     // Node.js → nodejs
    [/vue\.js/g, 'vuejs'],       // Vue.js → vuejs
    [/react\.js/g, 'reactjs'],   // React.js → reactjs
    [/angular\.js/g, 'angularjs'], // Angular.js → angularjs
    [/ci\/cd/g, 'cicd'],         // CI/CD → cicd
    [/tcp\/ip/g, 'tcpip'],       // TCP/IP → tcpip
  ]

  let normalized = lower
  for (const [pattern, replacement] of specialPatterns) {
    normalized = normalized.replace(pattern, replacement)
  }

  // Handle hyphens and spaces: treat as equivalent
  // "machine-learning", "machine learning" → "machinelearning"
  normalized = normalized.replace(/[-\s]+/g, '')

  // Remove remaining special characters but keep alphanumeric
  normalized = normalized.replace(/[^a-z0-9]/g, '')

  return normalized
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
