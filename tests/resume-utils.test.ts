import { describe, it, expect } from 'vitest'
import { buildResumeContent } from '@/lib/resume-utils'
import type { Resume } from '@/types'

describe('buildResumeContent', () => {
  it('combines summary, experience, skills, and education', () => {
    const resume: Resume = {
      id: 'test-resume',
      name: 'Test Resume',
      content: '',
      sections: {
        summary: 'Product leader with 8+ years building B2B tools.',
        experience: [
          {
            id: 'exp-1',
            company: 'Acme Corp',
            position: 'Product Manager',
            startDate: 'Jan 2021',
            endDate: 'Present',
            description: ['Increased activation by 25%', 'Shipped experimentation platform'],
          },
        ],
        skills: ['Product Strategy', 'A/B Testing', 'SQL'],
        education: [
          {
            id: 'edu-1',
            institution: 'Stanford University',
            degree: 'MS',
            field: 'Computer Science',
            startDate: '2016',
            endDate: '2018',
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const content = buildResumeContent(resume)
    expect(content).toContain('Product leader with 8+ years')
    expect(content).toContain('Experience')
    expect(content).toContain('• Increased activation by 25%')
    expect(content).toContain('Skills')
    expect(content).toContain('Education')
  })

  it('omits empty sections gracefully', () => {
    const resume: Resume = {
      id: 'test-resume-2',
      name: 'Minimal Resume',
      content: '',
      sections: {
        summary: '',
        experience: undefined,
        skills: undefined,
        education: undefined,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const content = buildResumeContent(resume)
    expect(content).toBe('')
  })
})
