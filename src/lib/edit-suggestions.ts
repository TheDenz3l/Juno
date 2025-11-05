export interface EditSuggestion {
  id: string
  type: 'action_verb' | 'passive_voice' | 'formatting' | 'clarity' | 'quantification'
  original: string
  suggestion: string
  rationale: string
  section: 'summary' | 'experience' | 'skills' | 'education' | 'contact'
  confidence: number // 0-1
}

// Strong action verbs for resumes (reserved for future use)
// const ACTION_VERBS = {
//   leadership: ['led', 'managed', 'directed', 'coordinated', 'supervised', 'mentored', 'trained'],
//   achievement: ['achieved', 'exceeded', 'delivered', 'accomplished', 'attained', 'completed'],
//   improvement: ['improved', 'enhanced', 'optimized', 'streamlined', 'increased', 'reduced'],
//   creation: ['created', 'developed', 'designed', 'built', 'implemented', 'established'],
//   analysis: ['analyzed', 'evaluated', 'assessed', 'measured', 'researched', 'investigated'],
//   collaboration: ['collaborated', 'partnered', 'coordinated', 'facilitated', 'supported']
// }

// Weak verbs to replace
const WEAK_VERBS = [
  'worked on', 'helped with', 'responsible for', 'was in charge of',
  'did', 'made', 'got', 'had', 'used', 'tried', 'assisted'
]

export function generateEditSuggestions(text: string, section: EditSuggestion['section']): EditSuggestion[] {
  const suggestions: EditSuggestion[] = []

  // Split into sentences/bullet points
  const items = text.split(/[.\n]/).filter(item => item.trim().length > 0)

  items.forEach((item, index) => {
    // Check for weak action verbs
    const weakVerbSuggestions = checkWeakVerbs(item, section, index)
    suggestions.push(...weakVerbSuggestions)

    // Check for passive voice
    const passiveVoiceSuggestions = checkPassiveVoice(item, section, index)
    suggestions.push(...passiveVoiceSuggestions)

    // Check for missing quantification
    const quantificationSuggestions = checkQuantification(item, section, index)
    suggestions.push(...quantificationSuggestions)

    // Check for formatting issues
    const formattingSuggestions = checkFormatting(item, section, index)
    suggestions.push(...formattingSuggestions)
  })

  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10)
}

function checkWeakVerbs(text: string, section: EditSuggestion['section'], index: number): EditSuggestion[] {
  const suggestions: EditSuggestion[] = []

  WEAK_VERBS.forEach(weakVerb => {
    const regex = new RegExp(`\\b${weakVerb}\\b`, 'gi')
    if (regex.test(text)) {
      // Suggest a strong alternative based on context
      let strongVerb = 'managed' // default

      if (text.match(/team|people|members/i)) {
        strongVerb = 'led'
      } else if (text.match(/create|build|develop/i)) {
        strongVerb = 'developed'
      } else if (text.match(/improve|better|enhance/i)) {
        strongVerb = 'improved'
      } else if (text.match(/analyze|data|research/i)) {
        strongVerb = 'analyzed'
      }

      const suggestion = text.replace(regex, strongVerb)

      suggestions.push({
        id: `${section}-${index}-weak-verb`,
        type: 'action_verb',
        original: text,
        suggestion,
        rationale: `Replace "${weakVerb}" with a stronger action verb like "${strongVerb}"`,
        section,
        confidence: 0.8
      })
    }
  })

  return suggestions
}

function checkPassiveVoice(text: string, section: EditSuggestion['section'], index: number): EditSuggestion[] {
  const suggestions: EditSuggestion[] = []

  // Detect passive voice patterns (was/were + past participle)
  const passivePattern = /\b(was|were|is|are|been)\s+(\w+ed|managed|led|built|created)\b/gi
  const matches = Array.from(text.matchAll(passivePattern))

  if (matches.length > 0) {
    // Suggest active voice
    let suggestion = text
    matches.forEach(match => {
      const passivePhrase = match[0]
      const verb = match[2]

      // Try to convert to active voice
      suggestion = suggestion.replace(passivePhrase, verb)
    })

    suggestions.push({
      id: `${section}-${index}-passive`,
      type: 'passive_voice',
      original: text,
      suggestion,
      rationale: 'Use active voice instead of passive voice to make your achievements more impactful',
      section,
      confidence: 0.7
    })
  }

  return suggestions
}

function checkQuantification(text: string, section: EditSuggestion['section'], index: number): EditSuggestion[] {
  const suggestions: EditSuggestion[] = []

  // Only check experience section
  if (section !== 'experience') return suggestions

  // Check if the text has any numbers or metrics
  const hasNumbers = /\d+|\$|%|million|billion|thousand/i.test(text)

  if (!hasNumbers) {
    // Suggest adding quantification
    suggestions.push({
      id: `${section}-${index}-quantify`,
      type: 'quantification',
      original: text,
      suggestion: text + ' [Add specific metrics: e.g., "resulting in 30% increase in efficiency"]',
      rationale: 'Add quantifiable metrics to demonstrate impact (e.g., percentages, dollar amounts, time saved)',
      section,
      confidence: 0.6
    })
  }

  return suggestions
}

function checkFormatting(text: string, section: EditSuggestion['section'], index: number): EditSuggestion[] {
  const suggestions: EditSuggestion[] = []

  // Check if bullet points start with action verbs (should be capitalized)
  if (section === 'experience' && text.length > 0) {
    const firstChar = text.trim()[0]
    if (firstChar === firstChar.toLowerCase()) {
      const suggestion = text.trim().charAt(0).toUpperCase() + text.trim().slice(1)

      suggestions.push({
        id: `${section}-${index}-capitalize`,
        type: 'formatting',
        original: text,
        suggestion,
        rationale: 'Start bullet points with a capital letter',
        section,
        confidence: 0.9
      })
    }
  }

  // Check for double spaces
  if (text.includes('  ')) {
    const suggestion = text.replace(/\s+/g, ' ')

    suggestions.push({
      id: `${section}-${index}-spacing`,
      type: 'formatting',
      original: text,
      suggestion,
      rationale: 'Remove extra spaces for cleaner formatting',
      section,
      confidence: 0.95
    })
  }

  return suggestions
}

// Apply suggestion to text
export function applySuggestion(originalText: string, suggestion: EditSuggestion): string {
  return originalText.replace(suggestion.original, suggestion.suggestion)
}
