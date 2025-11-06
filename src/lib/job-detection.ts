const REQUIREMENT_SECTION_HEADERS: RegExp[] = [
  /(?:^|\n)\s*(requirements?|qualifications?|skills?|what (?:we're|you'll) looking for|you have|must have|what you'll need|ideal candidate|necessary qualifications?|required qualifications?|minimum qualifications?|preferred qualifications?)[\s:]*\n/gi,
  /(?:^|\n)\s*(responsibilities|duties|what you'll do|your role|the role|role overview|day to day|key responsibilities)[\s:]*\n/gi,
  /(?:^|\n)\s*(education|experience|background)[\s:]*\n/gi,
]

const COMPANY_SECTION_HEADERS: RegExp[] = [
  /(?:^|\n)\s*(company (?:description|overview)|about (?:us|the company|our company)|who we are|our company|the company|our mission|our values|what we do|why join us|why work (?:with us|here))[\s:]*\n/gi,
  /(?:^|\n)\s*(benefits|perks|what we offer|compensation|salary)[\s:]*\n/gi,
]

export const JOB_DESCRIPTION_SELECTORS = [
  '#jobDescriptionText',
  '.jobsearch-jobDescriptionText',
  '[id*="jobDesc"]',
  '[class*="jobDesc"]',
  '.jobsearch-RightPane #jobDescriptionText',
  '.jobsearch-RightPane .jobsearch-jobDescriptionText',
]

export const JOB_TITLE_SELECTORS = [
  '.jobsearch-JobInfoHeader-title',
  'h1[class*="jobTitle"]',
  'h2[class*="jobTitle"]',
  '.jobTitle',
  'h1',
  'h2.jobTitle',
]

export const COMPANY_SELECTORS = [
  '[data-testid="inlineHeader-companyName"]',
  '[data-testid="company-name"]',
  '.jobsearch-InlineCompanyRating',
  '[data-company-name]',
  '.icl-u-lg-mr--sm.icl-u-xs-mr--xs',
  '.companyName',
  '[data-testid="inlineHeader-companyName"] a',
  '[data-testid="inlineHeader-companyName"] span',
]

export const parseAndFilterJobDescription = (description: string): string => {
  if (!description.trim()) return ''

  const sections = description.split(/\n\s*\n/)

  const requirementSections: string[] = []
  const neutralSections: string[] = []
  const companySections: string[] = []

  sections.forEach((section) => {
    const lower = section.toLowerCase()

    const isRequirement = REQUIREMENT_SECTION_HEADERS.some((pattern) => {
      pattern.lastIndex = 0
      return pattern.test(section)
    })

    const isCompany = COMPANY_SECTION_HEADERS.some((pattern) => {
      pattern.lastIndex = 0
      return pattern.test(section)
    })

    if (isRequirement) {
      requirementSections.push(section)
    } else if (isCompany) {
      companySections.push(section)
    } else if (
      lower.includes('responsibilities') ||
      lower.includes('requirements') ||
      lower.includes('qualifications') ||
      lower.includes('skills') ||
      lower.includes('experience')
    ) {
      requirementSections.push(section)
    } else {
      neutralSections.push(section)
    }
  })

  return [...requirementSections, ...neutralSections, ...companySections].join('\n\n')
}
