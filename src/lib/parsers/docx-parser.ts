import mammoth from 'mammoth'
import { Resume, ContactSection, ExperienceItem, EducationItem } from '@/types'

interface ParsedResume {
  rawText: string
  sections: Resume['sections']
}

export async function parseDOCX(file: File): Promise<ParsedResume> {
  try {
    const arrayBuffer = await file.arrayBuffer()

    // Extract text from DOCX
    const result = await mammoth.extractRawText({ arrayBuffer })
    const fullText = result.value

    // Parse sections from text (reuse same logic as PDF parser)
    const sections = parseResumeText(fullText)

    return {
      rawText: fullText,
      sections,
    }
  } catch (error) {
    console.error('DOCX parsing error:', error)
    throw new Error('Failed to parse DOCX. Please check the file and try again.')
  }
}

// Parse resume text into structured sections (same as PDF parser)
function parseResumeText(text: string): Resume['sections'] {
  const sections: Resume['sections'] = {}

  sections.contact = extractContactInfo(text)
  sections.summary = extractSummary(text)
  sections.experience = extractExperience(text)
  sections.education = extractEducation(text)
  sections.skills = extractSkills(text)

  return sections
}

function extractContactInfo(text: string): ContactSection | undefined {
  const contact: Partial<ContactSection> = {}

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i)
  if (emailMatch) contact.email = emailMatch[0]

  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  if (phoneMatch) contact.phone = phoneMatch[0]

  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i)
  if (linkedinMatch) contact.linkedin = linkedinMatch[0]

  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length > 0) {
    contact.name = lines[0].trim()
  }

  return contact.email ? (contact as ContactSection) : undefined
}

function extractSummary(text: string): string | undefined {
  const summaryRegex = /(summary|objective|profile|about me)[:\s]+([\s\S]{0,500}?)(?=\n\n|experience|education|skills|$)/i
  const match = text.match(summaryRegex)
  return match ? match[2].trim() : undefined
}

function extractExperience(text: string): ExperienceItem[] | undefined {
  const experiences: ExperienceItem[] = []
  const expSection = text.match(/experience[:\s]+([\s\S]{0,2000}?)(?=education|skills|$)/i)

  if (expSection) {
    const entries = expSection[1].split(/\n\n+/)

    entries.forEach((entry, index) => {
      const lines = entry.split('\n').filter(l => l.trim())
      if (lines.length < 2) return

      const exp: ExperienceItem = {
        id: `exp-${index}`,
        company: lines[1]?.trim() || '',
        position: lines[0]?.trim() || '',
        startDate: '',
        endDate: '',
        description: lines.slice(2).filter(l => l.trim())
      }

      const dateMatch = entry.match(/(\d{4})\s*[-–]\s*(\d{4}|present)/i)
      if (dateMatch) {
        exp.startDate = dateMatch[1]
        exp.endDate = dateMatch[2]
      }

      experiences.push(exp)
    })
  }

  return experiences.length > 0 ? experiences : undefined
}

function extractEducation(text: string): EducationItem[] | undefined {
  const education: EducationItem[] = []
  const eduSection = text.match(/education[:\s]+([\s\S]{0,1000}?)(?=experience|skills|$)/i)

  if (eduSection) {
    const entries = eduSection[1].split(/\n\n+/)

    entries.forEach((entry, index) => {
      const lines = entry.split('\n').filter(l => l.trim())
      if (lines.length < 2) return

      const edu: EducationItem = {
        id: `edu-${index}`,
        institution: lines[0]?.trim() || '',
        degree: lines[1]?.trim() || '',
        field: '',
        startDate: '',
        endDate: ''
      }

      const dateMatch = entry.match(/(\d{4})\s*[-–]\s*(\d{4})/i)
      if (dateMatch) {
        edu.startDate = dateMatch[1]
        edu.endDate = dateMatch[2]
      }

      education.push(edu)
    })
  }

  return education.length > 0 ? education : undefined
}

function extractSkills(text: string): string[] | undefined {
  const skillsSection = text.match(/skills?[:\s]+([\s\S]{0,500}?)(?=\n\n|experience|education|$)/i)

  if (skillsSection) {
    const skills = skillsSection[1]
      .split(/[,•\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 50)

    return skills.length > 0 ? skills : undefined
  }

  return undefined
}
