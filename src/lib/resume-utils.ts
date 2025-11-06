import type { Resume, ExperienceItem } from '@/types'

export const generateResumeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const generateExperienceId = (index: number) =>
  `exp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`

export const buildResumeContent = (resume: Resume): string => {
  const parts: string[] = []

  if (resume.sections.summary) {
    parts.push(resume.sections.summary.trim())
  }

  if (resume.sections.experience) {
    const experienceText = resume.sections.experience
      .map((exp: ExperienceItem) => {
        const header = [exp.position, exp.company]
          .filter(Boolean)
          .join(' | ')
        const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' – ')
        const bodyLines = exp.description?.map((line) => `• ${line.trim()}`) ?? []

        return [header, dates, ...bodyLines].filter(Boolean).join('\n')
      })
      .filter(Boolean)
      .join('\n\n')

    if (experienceText) {
      parts.push('Experience', experienceText)
    }
  }

  if (resume.sections.skills?.length) {
    parts.push('Skills', resume.sections.skills.join(', '))
  }

  if (resume.sections.education?.length) {
    const educationText = resume.sections.education
      .map((edu) =>
        [edu.institution, edu.degree, edu.field, `${edu.startDate} - ${edu.endDate}`]
          .filter(Boolean)
          .join(', ')
      )
      .filter(Boolean)
      .join('\n')

    if (educationText) {
      parts.push('Education', educationText)
    }
  }

  return parts.join('\n\n').trim()
}
