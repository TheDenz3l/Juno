import * as pdfjsLib from 'pdfjs-dist'
import { Resume, ContactSection, ExperienceItem, EducationItem } from '@/types'

// Set up PDF.js worker with proper error handling
let pdfWorkerInitialized = false

function initializePDFWorker() {
  if (pdfWorkerInitialized) return true

  try {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdfjs-dist/build/pdf.worker.min.mjs')
      pdfWorkerInitialized = true
      console.log('PDF.js worker initialized successfully')
      return true
    } else {
      console.error('Chrome runtime not available for PDF worker')
      return false
    }
  } catch (error) {
    console.error('Failed to initialize PDF worker:', error)
    return false
  }
}

interface ParsedResume {
  rawText: string
  sections: Resume['sections']
}

export async function parsePDF(file: File): Promise<ParsedResume> {
  try {
    // Initialize PDF worker before parsing
    if (!initializePDFWorker()) {
      throw new Error('PDF worker failed to initialize. Extension may need to be reloaded.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      fullText += pageText + '\n'
    }

    // Parse sections from text
    const sections = parseResumeText(fullText)

    return {
      rawText: fullText,
      sections,
    }
  } catch (error) {
    console.error('PDF parsing error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to parse PDF: ${errorMessage}. Please check the file and try again.`)
  }
}

// Parse resume text into structured sections
function parseResumeText(text: string): Resume['sections'] {
  const sections: Resume['sections'] = {}

  // Extract contact information
  sections.contact = extractContactInfo(text)

  // Extract summary/objective
  sections.summary = extractSummary(text)

  // Extract experience
  sections.experience = extractExperience(text)

  // Extract education
  sections.education = extractEducation(text)

  // Extract skills
  sections.skills = extractSkills(text)

  return sections
}

// Extract contact information
function extractContactInfo(text: string): ContactSection | undefined {
  const contact: Partial<ContactSection> = {}

  // Email regex
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i)
  if (emailMatch) contact.email = emailMatch[0]

  // Phone regex (various formats)
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  if (phoneMatch) contact.phone = phoneMatch[0]

  // LinkedIn regex
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i)
  if (linkedinMatch) contact.linkedin = linkedinMatch[0]

  // Extract name (usually first line or before contact info)
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length > 0) {
    contact.name = lines[0].trim()
  }

  return contact.email ? (contact as ContactSection) : undefined
}

// Extract summary/objective section
function extractSummary(text: string): string | undefined {
  const summaryRegex = /(summary|objective|profile|about me)[:\s]+([\s\S]{0,500}?)(?=\n\n|experience|education|skills|$)/i
  const match = text.match(summaryRegex)
  return match ? match[2].trim() : undefined
}

// Extract experience section
function extractExperience(text: string): ExperienceItem[] | undefined {
  const experiences: ExperienceItem[] = []

  // This is a simplified parser - in production, you'd want more sophisticated NLP
  const expSection = text.match(/experience[:\s]+([\s\S]{0,2000}?)(?=education|skills|$)/i)

  if (expSection) {
    // Split by common delimiters for job entries
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

      // Try to extract dates
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

// Extract education section
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

      // Try to extract dates
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

// Extract skills section
function extractSkills(text: string): string[] | undefined {
  const skillsSection = text.match(/skills?[:\s]+([\s\S]{0,500}?)(?=\n\n|experience|education|$)/i)

  if (skillsSection) {
    // Split by common delimiters
    const skills = skillsSection[1]
      .split(/[,•\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 50)

    return skills.length > 0 ? skills : undefined
  }

  return undefined
}