import { describe, expect, it } from 'vitest'
import type { Resume } from '@/types'
import { applyEditSuggestion, applyMultipleEditSuggestions } from '@/lib/resume-updater'
import type { EditSuggestion } from '@/lib/edit-suggestions'

const buildResume = (): Resume => ({
  id: 'resume-123',
  name: 'Test Resume',
  content: 'Driven professional.\n\nExperience\nLead Developer | Example Inc.\n2020 – 2022\n• Was responsible for team delivery.',
  sections: {
    summary: 'Driven professional.',
    experience: [
      {
        id: 'exp-1',
        company: 'Example Inc.',
        position: 'Lead Developer',
        startDate: '2020',
        endDate: '2022',
        description: ['Was responsible for team delivery.'],
      },
    ],
    skills: ['Leadership'],
  },
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
})

describe('resume-updater', () => {
  it('applies a single experience suggestion and rebuilds resume content', () => {
    const resume = buildResume()
    const suggestion: EditSuggestion = {
      id: 'experience-0-weak-verb',
      type: 'action_verb',
      original: 'Was responsible for team delivery.',
      suggestion: 'Led team delivery.',
      rationale: 'Use a stronger action verb.',
      section: 'experience',
      confidence: 0.8,
    }

    const updated = applyEditSuggestion(resume, suggestion)

    expect(updated.sections.experience?.[0].description[0]).toBe('Led team delivery.')
    expect(updated.content).toContain('Led team delivery.')
    expect(updated.updatedAt.getTime()).toBeGreaterThan(resume.updatedAt.getTime())
  })

  it('applies multiple suggestions in order', () => {
    const resume = buildResume()
    const suggestions: EditSuggestion[] = [
      {
        id: 'experience-0-verb',
        type: 'action_verb',
        original: 'Was responsible for team delivery.',
        suggestion: 'Led team delivery.',
        rationale: 'Use action verb.',
        section: 'experience',
        confidence: 0.9,
      },
      {
        id: 'summary-0-format',
        type: 'formatting',
        original: 'Driven professional.',
        suggestion: 'Driven professional delivering measurable outcomes.',
        rationale: 'Clarify summary.',
        section: 'summary',
        confidence: 0.7,
      },
    ]

    const updated = applyMultipleEditSuggestions(resume, suggestions)

    expect(updated.sections.experience?.[0].description[0]).toBe('Led team delivery.')
    expect(updated.sections.summary).toBe('Driven professional delivering measurable outcomes.')
    expect(updated.content).toContain('Driven professional delivering measurable outcomes.')
    expect(updated.content).toContain('Led team delivery.')
  })
})
