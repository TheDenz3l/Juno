import { parsePDF } from './pdf-parser'
import { parseDOCX } from './docx-parser'
import { parseTXT } from './txt-parser'
import { Resume } from '@/types'

export async function parseResumeFile(file: File): Promise<Resume> {
  const fileType = file.type
  const fileName = file.name

  let parsedData

  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    parsedData = await parsePDF(file)
  } else if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    parsedData = await parseDOCX(file)
  } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    parsedData = await parseTXT(file)
  } else {
    throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
  }

  // Create Resume object
  const resume: Resume = {
    id: generateId(),
    name: fileName.replace(/\.(pdf|docx|txt)$/i, ''),
    content: parsedData.rawText,
    sections: parsedData.sections,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return resume
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
