import { describe, it, expect } from 'vitest'
import { parseAndFilterJobDescription } from '@/lib/job-detection'

describe('parseAndFilterJobDescription', () => {
  it('prioritizes requirement sections ahead of company copy', () => {
    const input = `
About the Company
We are a mission-driven team changing the world.

Responsibilities
- Build features
- Collaborate with design

Benefits
- Unlimited PTO
`

    const result = parseAndFilterJobDescription(input)
    expect(result.startsWith('Responsibilities')).toBe(true)
    expect(result.trim().split('\n\n').pop()).toContain('Benefits')
  })

  it('returns empty string for blank descriptions', () => {
    expect(parseAndFilterJobDescription('   ')).toBe('')
  })

  it('treats neutral sections as middle priority', () => {
    const input = `
Who We Are
We care deeply about customers.

What you'll do
- Own product roadmap

Preferred Qualifications
- SQL
- Experimentation
`

    const result = parseAndFilterJobDescription(input)
    const sections = result.split('\n\n')
    expect(sections[sections.length - 1]).toContain('Who We Are')
  })
})
