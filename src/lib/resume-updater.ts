import { Resume } from '@/types'
import { EditSuggestion } from './edit-suggestions'
import { buildResumeContent } from './resume-utils'

/**
 * Apply an edit suggestion to a resume's content
 * @param resume The resume to update
 * @param suggestion The suggestion to apply
 * @returns Updated resume object
 */
export function applyEditSuggestion(resume: Resume, suggestion: EditSuggestion): Resume {
  // Clone the resume to avoid mutations
  const updatedResume = { ...resume }
  updatedResume.sections = { ...resume.sections }

  // Helper function to normalize text for comparison
  const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ')

  // Update based on section type
  if (suggestion.section === 'experience' && updatedResume.sections.experience) {
    updatedResume.sections.experience = updatedResume.sections.experience.map(exp => {
      // Clone experience item
      const updatedExp = { ...exp }

      // Check if description array exists
      if (!exp.description || !Array.isArray(exp.description)) {
        return updatedExp
      }

      // Check if any description bullet matches the original text
      const normalizedOriginal = normalizeText(suggestion.original)
      const descriptionIndex = exp.description.findIndex(bullet => {
        const normalizedBullet = normalizeText(bullet)
        // Use exact match or check if original is a substring of the bullet
        return normalizedBullet === normalizedOriginal ||
               normalizedBullet.includes(normalizedOriginal)
      })

      if (descriptionIndex !== -1) {
        // Replace the matching bullet
        updatedExp.description = [...exp.description]
        const originalBullet = updatedExp.description[descriptionIndex]

        // Replace the original text with the suggestion within the bullet
        // Use case-insensitive replacement to handle variations
        const regex = new RegExp(
          suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        )
        const updatedBullet = originalBullet.replace(
          regex,
          suggestion.suggestion
        )

        // Verify replacement actually happened
        if (updatedBullet === originalBullet) {
          throw new Error(`Failed to apply suggestion: text "${suggestion.original}" not found in resume`)
        }

        updatedExp.description[descriptionIndex] = updatedBullet
      } else {
        throw new Error(`Failed to find matching text in experience section: "${suggestion.original}"`)
      }

      return updatedExp
    })
  } else if (suggestion.section === 'summary' && typeof updatedResume.sections.summary === 'string') {
    // Replace in summary section with case-insensitive match
    const regex = new RegExp(
      suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    updatedResume.sections.summary = updatedResume.sections.summary.replace(
      regex,
      suggestion.suggestion
    )
  }

  // Rebuild resume content to keep manual edits and structured sections in sync
  updatedResume.content = buildResumeContent(updatedResume)

  // Update timestamp
  updatedResume.updatedAt = new Date()

  return updatedResume
}

/**
 * Apply multiple edit suggestions to a resume
 * @param resume The resume to update
 * @param suggestions Array of suggestions to apply
 * @returns Updated resume object
 */
export function applyMultipleEditSuggestions(resume: Resume, suggestions: EditSuggestion[]): Resume {
  let updatedResume = resume

  for (const suggestion of suggestions) {
    updatedResume = applyEditSuggestion(updatedResume, suggestion)
  }

  return updatedResume
}
