import { Resume, JobPosting, ATSScore } from '@/types'
import { getMLExtractor, type MLKeyword } from './ml-keyword-extractor'

// ============================================================================
// ML-FIRST HYBRID KEYWORD EXTRACTION
// ============================================================================

let mlExtractorEnabled = true // Can be toggled by user or disabled on error

/**
 * Try ML-based keyword extraction first, fall back to rule-based if it fails
 * This provides the best of both worlds: semantic understanding + pattern matching
 */
async function extractKeywordsMLFirst(text: string, fallbackToRules: boolean = true): Promise<string[]> {
  // Try ML extraction first
  if (mlExtractorEnabled) {
    try {
      console.log('[ATS Matcher] Attempting ML-based keyword extraction...')
      const extractor = getMLExtractor()

      const mlKeywords: MLKeyword[] = await extractor.extractKeywords(text, {
        topN: 50, // Get more keywords for better coverage
        timeout: 30000,
        minScore: 0.3 // Only include semantically relevant keywords
      })

      if (mlKeywords.length > 0) {
        console.log(`[ATS Matcher] ML extraction successful: ${mlKeywords.length} keywords found`)

        // Also extract with rules to capture technical terms ML might miss
        const ruleKeywords = extractKeywordsWithContext(text)

        // Merge ML and rule-based keywords, prioritizing ML scores
        const mlKeywordSet = new Set(mlKeywords.map(k => normalizeKeyword(k.keyword)))
        const combined = [
          ...mlKeywords.map(k => k.keyword),
          ...ruleKeywords.filter(k => !mlKeywordSet.has(normalizeKeyword(k)))
        ]

        console.log(`[ATS Matcher] Combined ML + rules: ${combined.length} total keywords`)
        return combined
      }
    } catch (error) {
      console.warn('[ATS Matcher] ML extraction failed, falling back to rules:', error)
      mlExtractorEnabled = false // Disable ML for future attempts this session
    }
  }

  // Fall back to rule-based extraction
  if (fallbackToRules) {
    console.log('[ATS Matcher] Using rule-based keyword extraction')
    return extractKeywordsWithContext(text)
  }

  return []
}

// ============================================================================
// REQUIREMENT LEVEL DETECTION
// ============================================================================

// Patterns to detect requirement levels from context
const REQUIREMENT_LEVEL_PATTERNS = {
  required: [
    /\b(required|must\s+have|mandatory|essential|necessary|critical|need\s+to\s+have)\b/gi,
    /\b(minimum|at\s+least|\d+\+?\s+years?)\b/gi,
    /\b(proficient|expert|strong\s+knowledge|deep\s+understanding)\b/gi,
  ],
  preferred: [
    /\b(preferred|nice\s+to\s+have|bonus|plus|ideal|desired|looking\s+for)\b/gi,
    /\b(experience\s+with|familiarity\s+with|knowledge\s+of|understanding\s+of)\b/gi,
    /\b(would\s+be\s+great|would\s+be\s+nice|we'd\s+love)\b/gi,
  ],
  optional: [
    /\b(optional|helpful|consider|may\s+include|could\s+include)\b/gi,
    /\b(nice\s+if|bonus\s+if|advantage)\b/gi,
  ]
}

// Section header patterns to identify different parts of job descriptions
const SECTION_PATTERNS = {
  requirements: [
    /(?:^|\n)\s*(?:required\s+)?(?:qualifications?|requirements?|skills?|competencies|what\s+(?:we're|you'll)\s+looking\s+for|you\s+have|must\s+have)/gi,
    /(?:^|\n)\s*(?:minimum|basic|essential)\s+(?:qualifications?|requirements?|skills?)/gi,
  ],
  responsibilities: [
    /(?:^|\n)\s*(?:responsibilities|duties|what\s+you'll\s+do|your\s+role|the\s+role|day-to-day)/gi,
    /(?:^|\n)\s*(?:key\s+responsibilities|primary\s+duties|main\s+tasks)/gi,
  ],
  preferred: [
    /(?:^|\n)\s*(?:preferred|nice\s+to\s+have|bonus|plus|ideal|desired)/gi,
    /(?:^|\n)\s*(?:additional|extra)\s+(?:qualifications?|requirements?|skills?)/gi,
  ],
  experience: [
    /(?:^|\n)\s*(?:experience|background|expertise|track\s+record)/gi,
    /(?:^|\n)\s*(?:years?\s+of\s+experience|work\s+experience)/gi,
  ],
  companyMarketing: [
    /(?:^|\n)\s*(?:company\s+(?:description|overview)|about\s+(?:us|the\s+company)|who\s+we\s+are)/gi,
    /(?:^|\n)\s*(?:benefits|perks|what\s+we\s+offer|compensation|why\s+join)/gi,
  ]
}

// Action verb patterns for extracting responsibilities
const ACTION_VERB_PATTERNS = [
  /\b(design|develop|build|create|implement|deploy|maintain|manage|lead|coordinate|oversee)\b/gi,
  /\b(architect|engineer|optimize|improve|enhance|refactor|debug|troubleshoot|resolve)\b/gi,
  /\b(collaborate|work\s+with|partner\s+with|communicate|present|document|write)\b/gi,
  /\b(analyze|research|investigate|evaluate|assess|review|test|validate|verify)\b/gi,
  /\b(plan|organize|schedule|prioritize|execute|deliver|ship|launch|release)\b/gi,
  /\b(mentor|train|coach|guide|teach|support|assist|help|advise)\b/gi,
]

// Experience timeline patterns
const EXPERIENCE_PATTERNS = [
  /(\d+)\+?\s*(?:to|-)\s*(\d+)\s*years?\s+(?:of\s+)?(?:experience|work|background)?\s+(?:in|with)?\s+([a-z][a-z\s.+#-]+)/gi,
  /(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|work|background)?\s+(?:in|with)?\s+([a-z][a-z\s.+#-]+)/gi,
  /(?:minimum|at\s+least|minimum\s+of)\s+(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|work)?\s+(?:in|with)?\s+([a-z][a-z\s.+#-]+)/gi,
]

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

// Critical technical phrase patterns that must be preserved as complete units
// These are extracted BEFORE single-word extraction to prevent splitting
const CRITICAL_PHRASE_PATTERNS = [
  // JavaScript frameworks (with various formats)
  /\b(?:react|vue|angular|svelte|next|nuxt)\.?js\b/gi,
  /\breact\s+native\b/gi,
  /\bnode\.?js\b/gi,

  // DevOps & CI/CD
  /\bcontinuous\s+(?:integration|deployment|delivery)\b/gi,
  /\bci\s*\/\s*cd\b/gi,
  /\bdevops\b/gi,

  // Development types
  /\b(?:front|back|full)[- ]?end(?:\s+(?:development|developer|engineer))?\b/gi,

  // UI/UX terms
  /\buser\s+(?:interface|experience|interfaces|experiences)\b/gi,
  /\bui\s*\/\s*ux\b/gi,

  // API types
  /\brest(?:ful)?\s+api\b/gi,
  /\bgraphql\b/gi,

  // Testing types
  /\b(?:unit|integration|e2e|end-to-end)\s+test(?:ing|s)?\b/gi,
  /\btest[- ]driven\s+development\b/gi,
  /\btdd\b/gi,

  // Methodologies
  /\bagile\s+(?:development|methodology|methodologies|scrum)\b/gi,
  /\bscrum\s+master\b/gi,
  /\bkanban\b/gi,

  // Version control
  /\bversion\s+control\b/gi,
  /\bgit(?:hub|lab)?\b/gi,

  // Cloud platforms
  /\b(?:aws|azure|gcp|google\s+cloud)\b/gi,

  // Databases
  /\b(?:postgre)?sql\b/gi,
  /\bmongo\s*db\b/gi,
  /\bredis\b/gi,

  // Other multi-word technical terms
  /\bmachine\s+learning\b/gi,
  /\bartificial\s+intelligence\b/gi,
  /\bdata\s+(?:science|analysis|analytics)\b/gi,
  /\bweb\s+(?:development|developer|services)\b/gi,
  /\bmobile\s+(?:development|developer|app|application)\b/gi,
  /\bresponsive\s+design\b/gi,
  /\bcode\s+review\b/gi,
  /\bpair\s+programming\b/gi,
  /\bproduction\s+(?:environment|systems?|deployment|support)\b/gi,
  /\bsoftware\s+(?:architecture|engineering|development\s+life\s+cycle)\b/gi,
  /\bobject[- ]oriented\s+programming\b/gi,
  /\boop\b/gi
]

// Technical adjectives that are valid phrase starters
const TECHNICAL_ADJECTIVES = new Set([
  'continuous', 'distributed', 'object-oriented', 'event-driven', 'data-driven',
  'test-driven', 'agile', 'scrum', 'responsive', 'scalable', 'modular',
  'cross-platform', 'full-stack', 'front-end', 'back-end', 'real-time',
  'cloud-based', 'microservices', 'serverless', 'containerized', 'automated',
  'asynchronous', 'synchronous', 'relational', 'non-relational', 'nosql',
  'restful', 'graphql', 'mobile', 'web', 'native', 'hybrid', 'progressive'
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
  'every', 'almost', 'nearly', 'quite', 'fairly', 'pretty', 'rather',

  // Generic business/tech terms that appear in almost every job posting
  // These don't differentiate candidates and cause false matches
  'experience', 'experienced', 'software', 'applications', 'application',
  'design', 'designs', 'designed', 'designer', 'product', 'products',
  'release', 'releases', 'support', 'supports', 'supported', 'supporting',
  'performance', 'development', 'develop', 'develops', 'developer', 'developing',
  'minimum', 'maximum', 'familiarity', 'familiar', 'knowledge', 'knowledgeable',
  'understanding', 'understand', 'understands', 'understood', 'ability',
  'abilities', 'capable', 'capability', 'strong', 'excellent', 'proficient',
  'proficiency', 'skill', 'skills', 'skilled', 'talent', 'talented',
  'plus', 'preferred', 'nice', 'bonus', 'required', 'requirements',
  'engineering', 'engineer', 'engineers', 'technical', 'technology',
  'technologies', 'tools', 'tool', 'process', 'processes', 'processing',
  'team', 'teams', 'member', 'members', 'environment', 'environments',
  'professional', 'professionals', 'industry', 'business', 'businesses',
  'client', 'clients', 'customer', 'customers', 'solution', 'solutions',
  'project', 'projects', 'implementation', 'implementations', 'manage',
  'management', 'managed', 'managing', 'manager', 'maintain', 'maintaining',
  'maintained', 'maintenance', 'ensure', 'ensuring', 'ensures', 'ensured'
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

export async function calculateATSScore(resume: Resume, job: JobPosting): Promise<ATSScore> {
  // Extract keywords from job description with ML-first hybrid approach
  const jobKeywords = await extractKeywordsMLFirst(job.description)

  // Extract keywords from resume (use rule-based for resume for consistency)
  const resumeText = buildResumeText(resume)
  const resumeKeywords = extractKeywords(resumeText)

  // Categorize keywords
  const { hardSkills: jobHardSkills, softSkills: jobSoftSkills } = categorizeKeywords(jobKeywords)
  const { hardSkills: resumeHardSkills, softSkills: resumeSoftSkills } = categorizeKeywords(resumeKeywords)

  // Calculate matches with fuzzy matching for better accuracy
  const hardSkillsMatched: string[] = []
  const hardSkillsMissing: string[] = []

  jobHardSkills.forEach(skill => {
    const skillNormalized = normalizeKeyword(skill)
    const isMatched = resumeHardSkills.some(rs => {
      const rsNormalized = normalizeKeyword(rs)
      // Exact match
      if (rsNormalized === skillNormalized) return true
      // Contains match (e.g., "Salesforce CRM" contains "CRM")
      if (rsNormalized.includes(skillNormalized) || skillNormalized.includes(rsNormalized)) return true
      // Common synonyms
      if (areSynonyms(skillNormalized, rsNormalized)) return true
      return false
    })

    if (isMatched) {
      hardSkillsMatched.push(skill)
    } else {
      hardSkillsMissing.push(skill)
    }
  })

  const softSkillsMatched: string[] = []
  const softSkillsMissing: string[] = []

  jobSoftSkills.forEach(skill => {
    const skillNormalized = normalizeKeyword(skill)
    const isMatched = resumeSoftSkills.some(rs => {
      const rsNormalized = normalizeKeyword(rs)
      // Exact match
      if (rsNormalized === skillNormalized) return true
      // Contains match
      if (rsNormalized.includes(skillNormalized) || skillNormalized.includes(rsNormalized)) return true
      // Common synonyms
      if (areSynonyms(skillNormalized, rsNormalized)) return true
      return false
    })

    if (isMatched) {
      softSkillsMatched.push(skill)
    } else {
      softSkillsMissing.push(skill)
    }
  })

  // Calculate score with weighted importance
  // Hard skills are more important (60%) than soft skills (40%)
  const hardSkillScore = jobHardSkills.length > 0
    ? (hardSkillsMatched.length / jobHardSkills.length) * 60
    : 30 // If no hard skills specified, give partial credit

  const softSkillScore = jobSoftSkills.length > 0
    ? (softSkillsMatched.length / jobSoftSkills.length) * 40
    : 20 // If no soft skills specified, give partial credit

  const score = Math.round(hardSkillScore + softSkillScore)

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

  // Allow phrases starting with technical adjectives (e.g., "continuous integration")
  // Check if entire phrase matches any critical phrase pattern
  for (const pattern of CRITICAL_PHRASE_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(lowerPhrase)) {
      return true // Critical phrases always pass
    }
  }

  // Filter phrases that start with stop words UNLESS it's a technical adjective
  if (words.length > 0 && STOP_WORDS.has(words[0]) && !TECHNICAL_ADJECTIVES.has(words[0])) {
    return false
  }

  // Filter phrases that end with stop words (except specific ones)
  const allowedEndWords = new Set(['engineer', 'developer', 'manager', 'designer', 'analyst'])
  if (words.length > 1 && STOP_WORDS.has(words[words.length - 1]) && !allowedEndWords.has(words[words.length - 1])) {
    return false
  }

  // Reject if ALL words in phrase are stop words
  const allStopWords = words.every(w => STOP_WORDS.has(w) && !TECHNICAL_ADJECTIVES.has(w))
  if (allStopWords) {
    return false
  }

  // Reject phrases with more than 50% stop words (but don't count technical adjectives as stop words)
  const stopWordCount = words.filter(w => STOP_WORDS.has(w) && !TECHNICAL_ADJECTIVES.has(w)).length
  if (stopWordCount / words.length > 0.5) {
    return false
  }

  // Must have at least one word with 4+ characters or be whitelisted (to filter out meaningless short phrases)
  const hasSubstantialWord = words.some(w =>
    (w.length >= 4 && !STOP_WORDS.has(w)) ||
    TECHNICAL_WHITELIST.has(w) ||
    TECHNICAL_ADJECTIVES.has(w)
  )
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

// ============================================================================
// CONTEXT-AWARE KEYWORD EXTRACTION
// ============================================================================

interface KeywordWithContext {
  keyword: string
  requirementLevel: 'required' | 'preferred' | 'optional' | 'neutral'
  section: 'requirements' | 'responsibilities' | 'preferred' | 'experience' | 'companyMarketing' | 'unknown'
  importance: number // 0-100 score
  context: string // Surrounding text for debugging
}

/**
 * Detect requirement level based on surrounding context
 */
function detectRequirementLevel(text: string, keyword: string): 'required' | 'preferred' | 'optional' | 'neutral' {
  // Get 100 characters before and after the keyword for context
  const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (keywordIndex === -1) return 'neutral'

  const contextStart = Math.max(0, keywordIndex - 100)
  const contextEnd = Math.min(text.length, keywordIndex + keyword.length + 100)
  const context = text.slice(contextStart, contextEnd).toLowerCase()

  // Check for requirement level indicators
  for (const pattern of REQUIREMENT_LEVEL_PATTERNS.required) {
    if (pattern.test(context)) {
      return 'required'
    }
  }

  for (const pattern of REQUIREMENT_LEVEL_PATTERNS.preferred) {
    if (pattern.test(context)) {
      return 'preferred'
    }
  }

  for (const pattern of REQUIREMENT_LEVEL_PATTERNS.optional) {
    if (pattern.test(context)) {
      return 'optional'
    }
  }

  return 'neutral'
}

/**
 * Identify which section of the job description a keyword appears in
 */
function identifySection(text: string, keyword: string): KeywordWithContext['section'] {
  // Split text into sections based on headers
  const sections: Array<{ type: KeywordWithContext['section'], startIndex: number }> = []

  // Find all section headers and their positions
  for (const [sectionType, patterns] of Object.entries(SECTION_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        sections.push({
          type: sectionType as KeywordWithContext['section'],
          startIndex: match.index
        })
      }
    }
  }

  // Sort sections by position
  sections.sort((a, b) => a.startIndex - b.startIndex)

  // Find which section the keyword belongs to
  const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (keywordIndex === -1) return 'unknown'

  // Find the last section header before the keyword
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].startIndex < keywordIndex) {
      return sections[i].type
    }
  }

  return 'unknown'
}

/**
 * Calculate importance score based on multiple factors
 */
function calculateImportance(kwContext: KeywordWithContext, frequency: number): number {
  let score = 50 // Base score

  // Requirement level weighting (0-30 points)
  switch (kwContext.requirementLevel) {
    case 'required':
      score += 30
      break
    case 'preferred':
      score += 15
      break
    case 'optional':
      score += 5
      break
  }

  // Section weighting (0-20 points)
  switch (kwContext.section) {
    case 'requirements':
      score += 20
      break
    case 'responsibilities':
      score += 15
      break
    case 'experience':
      score += 15
      break
    case 'preferred':
      score += 10
      break
    case 'companyMarketing':
      score -= 10 // Reduce importance of company marketing keywords
      break
  }

  // Frequency weighting (0-20 points, capped at 5 mentions)
  score += Math.min(frequency - 1, 4) * 5

  // Technical specificity bonus (0-10 points)
  if (TECHNICAL_WHITELIST.has(kwContext.keyword.toLowerCase())) {
    score += 10
  }

  return Math.min(100, Math.max(0, score))
}

/**
 * Extract action verb + skill patterns (e.g., "Design RESTful APIs")
 */
function extractActionPatterns(text: string): string[] {
  const patterns: string[] = []
  const seen = new Set<string>()

  // Find action verbs
  for (const pattern of ACTION_VERB_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      // Get the context after the action verb (next 50 characters)
      const contextStart = match.index
      const contextEnd = Math.min(text.length, match.index + 50)
      const context = text.slice(contextStart, contextEnd)

      // Extract the full phrase (verb + object)
      const phraseMatch = context.match(/\b\w+\s+(?:and\s+\w+\s+)?[\w\s.+#-]{2,30}\b/i)
      if (phraseMatch) {
        const phrase = phraseMatch[0].trim()
        const normalized = normalizeKeyword(phrase)
        if (!seen.has(normalized) && phrase.split(' ').length >= 2 && phrase.split(' ').length <= 5) {
          seen.add(normalized)
          patterns.push(phrase)
        }
      }
    }
  }

  return patterns
}

/**
 * Extract experience requirements with timeline context
 * TODO: This will be used for enhanced experience matching in Phase 3
 */
export function extractExperienceRequirements(text: string): Array<{ skill: string, years: number, isMinimum: boolean }> {
  const requirements: Array<{ skill: string, years: number, isMinimum: boolean }> = []

  for (const pattern of EXPERIENCE_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const years = parseInt(match[1])
      const skill = (match[3] || match[2] || '').trim()

      if (skill && skill.length > 2 && years > 0 && years < 50) {
        requirements.push({
          skill: skill,
          years: years,
          isMinimum: text.toLowerCase().includes('minimum') || text.toLowerCase().includes('at least')
        })
      }
    }
  }

  return requirements
}

/**
 * Enhanced keyword extraction with context awareness
 * Returns keywords prioritized by importance scores
 */
function extractKeywordsWithContext(text: string): string[] {
  // Extract basic keywords using existing method
  const basicKeywords = extractKeywords(text)

  // Extract action patterns
  const actionPatterns = extractActionPatterns(text)

  // Combine all keywords
  const allKeywords = [...basicKeywords, ...actionPatterns]

  // Build context map for each keyword
  const keywordContexts = new Map<string, KeywordWithContext>()
  const frequencyMap = new Map<string, number>()

  for (const keyword of allKeywords) {
    const normalized = normalizeKeyword(keyword)

    // Track frequency
    frequencyMap.set(normalized, (frequencyMap.get(normalized) || 0) + 1)

    // Skip if we've already processed this keyword
    if (keywordContexts.has(normalized)) continue

    // Get context information
    const requirementLevel = detectRequirementLevel(text, keyword)
    const section = identifySection(text, keyword)

    // Extract context snippet for debugging
    const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase())
    const contextStart = Math.max(0, keywordIndex - 30)
    const contextEnd = Math.min(text.length, keywordIndex + keyword.length + 30)
    const context = keywordIndex !== -1 ? text.slice(contextStart, contextEnd) : ''

    keywordContexts.set(normalized, {
      keyword,
      requirementLevel,
      section,
      importance: 0, // Will be calculated below
      context
    })
  }

  // Calculate importance scores
  for (const [normalized, kwContext] of keywordContexts) {
    const frequency = frequencyMap.get(normalized) || 1
    kwContext.importance = calculateImportance(kwContext, frequency)
  }

  // Sort by importance and return top keywords
  const sortedKeywords = Array.from(keywordContexts.values())
    .sort((a, b) => b.importance - a.importance)
    .map(kwc => kwc.keyword)

  // Return top 50 keywords or all if less than 50
  return sortedKeywords.slice(0, 50)
}

// Extract keywords from text with frequency tracking
function extractKeywords(text: string): string[] {
  // FIRST: Extract critical technical phrases to preserve them intact
  const criticalPhrases: string[] = []
  const criticalMatches = new Set<string>()

  CRITICAL_PHRASE_PATTERNS.forEach(pattern => {
    pattern.lastIndex = 0
    const matches = text.match(pattern) || []
    matches.forEach(match => {
      const normalized = normalizeKeyword(match)
      if (!criticalMatches.has(normalized)) {
        criticalMatches.add(normalized)
        criticalPhrases.push(match)
      }
    })
  })

  // Remove critical phrases from text to prevent duplicate extraction as split words
  let textWithoutCriticalPhrases = text
  criticalPhrases.forEach(phrase => {
    // Replace with placeholder to preserve word boundaries
    textWithoutCriticalPhrases = textWithoutCriticalPhrases.replace(
      new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      ' __REMOVED__ '
    )
  })

  // Extract multi-word phrases (2-4 words) - now includes numbers and special chars
  // Matches: "5+ years", "C++", "Node.js", "ISO 9001", "Bachelor of Science degree"
  const phrases = textWithoutCriticalPhrases.match(/\b[\w.#+]+(?:[- ][\w.#+]+){1,3}\b/gi) || []

  // Extract single words (including numbers, min 2 chars to catch "Go", "C#", etc.)
  // But filter 2-char words later unless whitelisted
  const words = textWithoutCriticalPhrases
    .toLowerCase()
    .match(/\b[\w.#+]{2,30}\b/g) || []  // Added upper limit of 30 chars

  // Combine all potential keywords (critical phrases first to prioritize them)
  const allKeywords = [...criticalPhrases, ...phrases, ...words]

  // Track frequency of each normalized keyword
  const frequencyMap = new Map<string, { original: string; count: number }>()

  allKeywords.forEach(keyword => {
    const normalized = normalizeKeyword(keyword)

    // Skip placeholder tokens
    if (normalized === '__removed__' || normalized === 'removed') return

    // CRITICAL: Filter out multi-line blocks and excessively long "keywords"
    if (keyword.includes('\n') || keyword.length > 50) {
      return
    }

    // Filter boilerplate phrases
    const lowerKeyword = keyword.toLowerCase()
    const boilerplatePatterns = [
      'about us', 'we are', 'we offer', 'our company', 'the company',
      'equal opportunity', 'we celebrate', 'we partner', 'join our',
      'premium retail solutions', 'flagship location'
    ]
    if (boilerplatePatterns.some(p => lowerKeyword.includes(p))) {
      return
    }

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

// Technology synonym mapping - maps variations to canonical forms
// This helps match resume keywords with job posting keywords even if worded differently
const TECH_SYNONYMS = new Map<string, Set<string>>([
  // JavaScript and frameworks
  ['javascript', new Set(['js', 'ecmascript', 'es6', 'es2015', 'es2020'])],
  ['typescript', new Set(['ts'])],
  ['react', new Set(['reactjs', 'react.js'])],
  ['vue', new Set(['vuejs', 'vue.js'])],
  ['angular', new Set(['angularjs', 'angular.js'])],
  ['node', new Set(['nodejs', 'node.js'])],

  // Continuous Integration/Deployment
  ['continuous integration', new Set(['ci', 'ci/cd', 'cicd', 'continuous delivery', 'continuous deployment'])],

  // Development roles
  ['frontend', new Set(['front-end', 'front end', 'client-side'])],
  ['backend', new Set(['back-end', 'back end', 'server-side'])],
  ['fullstack', new Set(['full-stack', 'full stack'])],

  // UI/UX
  ['ui', new Set(['user interface', 'user interfaces'])],
  ['ux', new Set(['user experience'])],

  // Version control
  ['git', new Set(['github', 'gitlab', 'version control'])],

  // Testing
  ['testing', new Set(['test', 'tests', 'qa', 'quality assurance'])],
  ['unit testing', new Set(['unit test', 'unit tests'])],
  ['integration testing', new Set(['integration test', 'integration tests'])],

  // Methodologies
  ['agile', new Set(['scrum', 'kanban', 'agile methodology'])],

  // Cloud platforms
  ['aws', new Set(['amazon web services'])],
  ['gcp', new Set(['google cloud', 'google cloud platform'])],
  ['azure', new Set(['microsoft azure'])],

  // Databases
  ['sql', new Set(['structured query language'])],
  ['nosql', new Set(['no-sql', 'non-relational'])],
  ['mongodb', new Set(['mongo'])],
  ['postgresql', new Set(['postgres', 'psql'])],

  // Other technical terms
  ['api', new Set(['rest api', 'restful api', 'web api', 'web services'])],
  ['machinelearning', new Set(['ml', 'machine learning'])],
  ['artificialintelligence', new Set(['ai', 'artificial intelligence'])],
  ['oop', new Set(['object-oriented programming', 'object oriented'])],
])

// Reverse map for quick lookup: synonym -> canonical
const SYNONYM_TO_CANONICAL = new Map<string, string>()
TECH_SYNONYMS.forEach((synonyms, canonical) => {
  synonyms.forEach(synonym => {
    SYNONYM_TO_CANONICAL.set(synonym, canonical)
  })
})

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

  // Apply synonym mapping - convert variations to canonical form
  // This allows "React.js" and "ReactJS" to match as the same keyword
  if (SYNONYM_TO_CANONICAL.has(normalized)) {
    normalized = SYNONYM_TO_CANONICAL.get(normalized)!
  }

  return normalized
}

// Check if two keywords are synonyms
function areSynonyms(keyword1: string, keyword2: string): boolean {
  // Normalize keywords by removing spaces for synonym matching
  const k1 = keyword1.replace(/\s+/g, '')
  const k2 = keyword2.replace(/\s+/g, '')

  const synonymMap: { [key: string]: string[] } = {
    'crm': ['salesforce', 'customerrelationshipmanagement', 'hubspot'],
    'pos': ['pointofsale', 'cashregister', 'paymentsystem'],
    'customerservice': ['clientrelations', 'customersupport', 'clientservice', 'customercare'],
    'leadership': ['teammanagement', 'managing', 'supervising', 'leading'],
    'communication': ['interpersonal', 'verbal', 'writtencommunication'],
    'problemsolving': ['troubleshooting', 'analytical', 'criticalthinking'],
    'sales': ['selling', 'revenuegeneration', 'businessdevelopment'],
    'retail': ['store', 'shop', 'merchandise'],
    'inventory': ['stock', 'merchandisemanagement'],
    'javascript': ['js', 'ecmascript'],
    'typescript': ['ts'],
    'python': ['py'],
    'collaboration': ['teamwork', 'teamplayer', 'cooperative']
  }

  // Check both directions
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (k1 === key && synonyms.includes(k2)) return true
    if (k2 === key && synonyms.includes(k1)) return true
    if (synonyms.includes(k1) && synonyms.includes(k2)) return true
  }

  return false
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
