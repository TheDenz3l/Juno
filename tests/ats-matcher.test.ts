import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { Resume, JobPosting } from '@/types'
import { calculateATSScore } from '@/lib/ats-matcher'
import { extractKeywordsWithCache } from '@/lib/grok-keyword-extractor'

vi.mock('@/lib/grok-keyword-extractor', () => ({
  extractKeywordsWithCache: vi.fn(),
}))

const baseResume: Resume = {
  id: 'resume-1',
  name: 'Test Resume',
  content: 'Experienced engineer skilled in JavaScript and React.',
  sections: {
    summary: 'Engineer skilled in JavaScript and React.',
    experience: [
      {
        id: 'exp-1',
        company: 'Acme',
        position: 'Frontend Developer',
        startDate: '2022-01',
        endDate: '2023-01',
        description: [
          'Built React user interfaces and optimized JavaScript bundles.',
        ],
      },
    ],
    skills: ['JavaScript', 'React'],
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
}

const baseJob: JobPosting = {
  id: 'job-1',
  title: 'Frontend Engineer',
  company: 'ExampleCo',
  description: 'Seeking a Frontend Engineer with JavaScript expertise and strong communication.',
  url: 'https://example.com/job/1',
  source: 'indeed',
  detectedAt: new Date('2024-05-01'),
}

describe('calculateATSScore keyword sourcing', () => {
  beforeEach(() => {
    vi.mocked(extractKeywordsWithCache).mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prioritizes Grok keywords by default when available', async () => {
    vi.stubEnv('VITE_ATS_ENABLE_GROK', 'true')

    vi.mocked(extractKeywordsWithCache).mockResolvedValue({
      hardSkills: [
        { term: 'GraphQL', importance: 90, category: 'hard', requirementLevel: 'preferred' },
      ],
      softSkills: [
        { term: 'Collaboration', importance: 80, category: 'soft', requirementLevel: 'required' },
      ],
      experienceRequirements: [],
      certifications: [],
    })

    const score = await calculateATSScore(baseResume, {
      ...baseJob,
      description: `${baseJob.description} Experience with GraphQL APIs is a plus.`,
    })

    expect(extractKeywordsWithCache).toHaveBeenCalledTimes(1)
    expect(score.missingKeywords).toContain('GraphQL')
    expect(score.analysis.softSkills.missing).toContain('Collaboration')
  })

  it('uses only local extraction when preferLocal is forced', async () => {
    vi.stubEnv('VITE_ATS_ENABLE_GROK', 'true')
    vi.stubEnv('VITE_ATS_PREFER_LOCAL', 'true')

    const score = await calculateATSScore(baseResume, baseJob)

    expect(extractKeywordsWithCache).not.toHaveBeenCalled()
    expect(score.matchedKeywords.some(keyword => keyword.toLowerCase().includes('javascript'))).toBe(true)
    expect(score.missingKeywords.some(keyword => keyword.toLowerCase().includes('communication'))).toBe(true)
  })

  it('falls back to local extraction when Grok fails', async () => {
    vi.stubEnv('VITE_ATS_ENABLE_GROK', 'true')

    vi.mocked(extractKeywordsWithCache).mockRejectedValue(new Error('network error'))

    const score = await calculateATSScore(baseResume, baseJob)

    expect(extractKeywordsWithCache).toHaveBeenCalledTimes(1)
    expect(score.matchedKeywords.some(keyword => keyword.toLowerCase().includes('javascript'))).toBe(true)
    expect(score.missingKeywords.some(keyword => keyword.toLowerCase().includes('communication'))).toBe(true)
  })
})
