// Content script for Indeed job pages
console.log('Juno content script loaded on Indeed')

// Parse and filter job description to emphasize requirements over company marketing
function parseAndFilterJobDescription(description) {
  // Section headers that indicate actual job requirements (high priority)
  const requirementSectionHeaders = [
    /(?:^|\n)\s*(requirements?|qualifications?|skills?|what (?:we're|you'll) looking for|you have|must have|what you'll need|ideal candidate|necessary qualifications?|required qualifications?|minimum qualifications?|preferred qualifications?)[\s:]*\n/gi,
    /(?:^|\n)\s*(responsibilities|duties|what you'll do|your role|the role|role overview|day to day|key responsibilities)[\s:]*\n/gi,
    /(?:^|\n)\s*(education|experience|background)[\s:]*\n/gi
  ]

  // Section headers that indicate company fluff (low priority)
  const companySectionHeaders = [
    /(?:^|\n)\s*(company (?:description|overview)|about (?:us|the company|our company)|who we are|our company|the company|our mission|our values|what we do|why join us|why work (?:with us|here))[\s:]*\n/gi,
    /(?:^|\n)\s*(benefits|perks|what we offer|compensation|salary)[\s:]*\n/gi
  ]

  let processedText = description

  // Try to find and prioritize requirement sections
  let requirementSections = []
  let neutralSections = []
  let companyMarketingSections = []

  // Split by common section delimiters
  const sections = description.split(/\n\s*\n/)

  sections.forEach((section, index) => {
    const sectionLower = section.toLowerCase()

    // Check if this section contains requirement keywords
    const isRequirementSection = requirementSectionHeaders.some(pattern => {
      pattern.lastIndex = 0
      return pattern.test(section)
    }) ||
    sectionLower.includes('required') ||
    sectionLower.includes('qualifications') ||
    sectionLower.includes('skills') ||
    sectionLower.includes('experience') ||
    sectionLower.includes('responsibilities')

    // Check if this section is company marketing
    const isCompanySection = companySectionHeaders.some(pattern => {
      pattern.lastIndex = 0
      return pattern.test(section)
    }) ||
    (index === 0 && sectionLower.includes('is a') && sectionLower.includes('company'))

    if (isRequirementSection) {
      requirementSections.push(section)
    } else if (isCompanySection) {
      companyMarketingSections.push(section)
    } else {
      // Neutral section - keep at normal weight, don't triple
      neutralSections.push(section)
    }
  })

  // Apply intelligent weighting
  // Requirements: 3x weight (most important)
  // Neutral: 1x weight (normal)
  // Company marketing: 0.3x weight (minimal, just for context)

  processedText = ''

  if (requirementSections.length > 0) {
    // Triple requirements sections
    const requirementText = requirementSections.join('\n\n')
    processedText = requirementText + '\n\n' + requirementText + '\n\n' + requirementText
  }

  // Add neutral sections once (normal weight)
  if (neutralSections.length > 0) {
    const neutralText = neutralSections.join('\n\n')
    if (processedText) {
      processedText += '\n\n' + neutralText
    } else {
      processedText = neutralText
    }
  }

  // Add minimal company context (just first section, once)
  if (companyMarketingSections.length > 0) {
    const companyText = companyMarketingSections[0]
    // Only add if it's not too long (cap at 500 chars)
    if (companyText.length <= 500) {
      processedText += '\n\n' + companyText
    }
  }

  // Fallback: if no sections were identified, use original
  if (!processedText) {
    processedText = description
  }

  return processedText
}

// Keyword highlighting state
let jobDescriptionElement = null
let highlightingEnabled = false
const HIGHLIGHT_CLASS_MATCHED = 'juno-keyword-matched'
const HIGHLIGHT_CLASS_MISSED = 'juno-keyword-missed'

// Add CSS styles for highlighted keywords
function addHighlightStyles() {
  if (document.getElementById('juno-highlight-styles')) return

  const style = document.createElement('style')
  style.id = 'juno-highlight-styles'
  style.textContent = `
    .${HIGHLIGHT_CLASS_MATCHED} {
      background-color: #86efac !important;
      color: #166534 !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      font-weight: 500 !important;
    }
    .${HIGHLIGHT_CLASS_MISSED} {
      background-color: #fed7aa !important;
      color: #9a3412 !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      font-weight: 500 !important;
    }
  `
  document.head.appendChild(style)
}

// Highlight keywords in the job description
function highlightKeywords(matchedKeywords, missedKeywords) {
  if (!jobDescriptionElement) {
    console.warn('No job description element to highlight')
    return
  }

  // First, remove any existing highlights
  removeHighlights()

  // Add highlight styles if not already added
  addHighlightStyles()

  // Combine all keywords with their types
  const keywordsToHighlight = [
    ...matchedKeywords.map(kw => ({ keyword: kw, type: 'matched' })),
    ...missedKeywords.map(kw => ({ keyword: kw, type: 'missed' }))
  ]

  // Sort by length (longest first) to avoid partial matches
  keywordsToHighlight.sort((a, b) => b.keyword.length - a.keyword.length)

  // Use TreeWalker to find all text nodes
  const walker = document.createTreeWalker(
    jobDescriptionElement,
    NodeFilter.SHOW_TEXT,
    null
  )

  const textNodes = []
  let node
  while ((node = walker.nextNode())) {
    textNodes.push(node)
  }

  // Process each text node
  textNodes.forEach(textNode => {
    const text = textNode.textContent
    let parent = textNode.parentNode

    // Skip if already highlighted
    if (parent.classList &&
        (parent.classList.contains(HIGHLIGHT_CLASS_MATCHED) ||
         parent.classList.contains(HIGHLIGHT_CLASS_MISSED))) {
      return
    }

    // Create a document fragment to hold the new nodes
    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    const matches = []

    // Find all keyword matches in this text node
    keywordsToHighlight.forEach(({ keyword, type }) => {
      const normalizedKeyword = keyword.toLowerCase()
      const normalizedText = text.toLowerCase()
      let index = normalizedText.indexOf(normalizedKeyword)

      while (index !== -1) {
        // Check for word boundaries
        const beforeChar = index > 0 ? text[index - 1] : ' '
        const afterChar = index + keyword.length < text.length ? text[index + keyword.length] : ' '
        const isWordBoundary = /\s|[.,!?;:]/.test(beforeChar) && /\s|[.,!?;:]/.test(afterChar)

        if (isWordBoundary) {
          matches.push({
            start: index,
            end: index + keyword.length,
            type,
            keyword
          })
        }

        index = normalizedText.indexOf(normalizedKeyword, index + 1)
      }
    })

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start)

    // Remove overlapping matches (keep first match)
    const filteredMatches = []
    let lastEnd = -1
    matches.forEach(match => {
      if (match.start >= lastEnd) {
        filteredMatches.push(match)
        lastEnd = match.end
      }
    })

    // If no matches, skip this text node
    if (filteredMatches.length === 0) return

    // Build the fragment with highlighted keywords
    filteredMatches.forEach(match => {
      // Add text before the match
      if (lastIndex < match.start) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.start)))
      }

      // Add highlighted keyword
      const span = document.createElement('span')
      span.className = match.type === 'matched' ? HIGHLIGHT_CLASS_MATCHED : HIGHLIGHT_CLASS_MISSED
      span.textContent = text.substring(match.start, match.end)
      fragment.appendChild(span)

      lastIndex = match.end
    })

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)))
    }

    // Replace the text node with the fragment
    parent.replaceChild(fragment, textNode)
  })

  highlightingEnabled = true
  console.log('Keywords highlighted:', { matched: matchedKeywords.length, missed: missedKeywords.length })
}

// Remove all keyword highlights
function removeHighlights() {
  if (!jobDescriptionElement) return

  // Find all highlighted spans
  const matchedSpans = jobDescriptionElement.querySelectorAll(`.${HIGHLIGHT_CLASS_MATCHED}`)
  const missedSpans = jobDescriptionElement.querySelectorAll(`.${HIGHLIGHT_CLASS_MISSED}`)

  // Replace each span with its text content
  const allSpans = [...matchedSpans, ...missedSpans]
  allSpans.forEach(span => {
    const text = document.createTextNode(span.textContent)
    span.parentNode.replaceChild(text, span)
  })

  // Normalize the container to merge adjacent text nodes
  if (jobDescriptionElement.normalize) {
    jobDescriptionElement.normalize()
  }

  highlightingEnabled = false
  console.log('Highlights removed')
}

// Detect if we're on a job posting page
function detectJobPosting() {
  // Check URL pattern - now includes search results page
  const isJobPage = window.location.href.includes('/viewjob') ||
                     window.location.href.includes('/rc/clk') ||
                     window.location.href.includes('/jobs')

  if (!isJobPage) return null

  // Try to extract job description
  // Updated selectors to include search results page format
  const jobDescriptionSelectors = [
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[id*="jobDesc"]',
    '[class*="jobDesc"]',
    '.jobsearch-RightPane #jobDescriptionText', // Search results page
    '.jobsearch-RightPane .jobsearch-jobDescriptionText' // Search results page
  ]

  let jobDescription = ''
  for (const selector of jobDescriptionSelectors) {
    const element = document.querySelector(selector)
    if (element) {
      jobDescription = element.textContent || ''
      jobDescriptionElement = element // Store reference for highlighting
      break
    }
  }

  if (!jobDescription || jobDescription.trim().length < 50) return null

  // Parse job description into sections and filter for quality
  jobDescription = parseAndFilterJobDescription(jobDescription)

  // Extract job title
  let jobTitle = ''
  const titleSelectors = [
    '.jobsearch-JobInfoHeader-title',
    'h1[class*="jobTitle"]',
    'h2[class*="jobTitle"]', // Search results page often uses h2
    '.jobTitle',
    'h1',
    'h2.jobTitle'
  ]

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector)
    if (element) {
      jobTitle = element.textContent?.trim() || ''
      break
    }
  }

  // Extract company name
  let companyName = ''
  const companySelectors = [
    '[data-testid="inlineHeader-companyName"]',
    '[data-testid="company-name"]',
    '.jobsearch-InlineCompanyRating',
    '[data-company-name]',
    '.icl-u-lg-mr--sm.icl-u-xs-mr--xs',
    '.companyName',
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"] span'
  ]

  for (const selector of companySelectors) {
    const element = document.querySelector(selector)
    if (element) {
      companyName = element.textContent?.trim() || ''
      break
    }
  }

  // Generate unique job ID
  const jobId = `indeed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  return {
    id: jobId,
    title: jobTitle,
    company: companyName || undefined,
    description: jobDescription,
    url: window.location.href,
    source: 'indeed',
    detectedAt: new Date().toISOString()
  }
}

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    // chrome.runtime.id will throw if context is invalid
    return !!(chrome.runtime && chrome.runtime.id)
  } catch (e) {
    return false
  }
}

// Show user-friendly error when extension context is invalid
function showContextInvalidatedError() {
  const existingError = document.getElementById('juno-context-error')
  if (existingError) return // Already showing

  const errorDiv = document.createElement('div')
  errorDiv.id = 'juno-context-error'
  errorDiv.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 24px;
    background: #ef4444;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 999998;
    max-width: 300px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  `

  errorDiv.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px;">Extension Updated</div>
    <div style="margin-bottom: 12px;">Juno was updated or reloaded. Please refresh this page to continue.</div>
    <button id="juno-reload-btn" style="
      background: white;
      color: #ef4444;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
    ">Refresh Page</button>
  `

  document.body.appendChild(errorDiv)

  // Add click handler for reload button
  document.getElementById('juno-reload-btn').addEventListener('click', () => {
    window.location.reload()
  })

  // Update FAB to show disconnected state
  const fab = document.getElementById('juno-fab')
  if (fab) {
    fab.style.background = '#6b7280' // Gray color
    fab.style.cursor = 'not-allowed'
    fab.title = 'Extension needs page refresh'
  }
}

// Initialize - using async/await pattern per Chrome MV3 best practices
async function init() {
  try {
    const jobData = detectJobPosting()

    if (jobData) {
      console.log('Job posting detected:', jobData.title)

      // Notify background script
      // Check if extension context is valid before attempting to communicate
      if (!isExtensionContextValid()) {
        console.error('Extension context is invalid - cannot send job data')
        showContextInvalidatedError()
        return
      }

      try {
        // Modern async/await pattern for chrome.runtime.sendMessage
        const response = await chrome.runtime.sendMessage({
          type: 'JOB_DETECTED',
          data: jobData
        })

        if (response && response.success) {
          console.log('Job data sent successfully to background')
          // Create floating action button after successful message
          createFAB()
        } else {
          console.warn('Job data message sent but response indicates failure:', response)
          // Still create FAB even if response is unclear
          createFAB()
        }
      } catch (error) {
        console.error('Error communicating with extension:', error)

        // Check for specific context invalidation errors
        const errorMsg = error.message || String(error)
        if (errorMsg.includes('Extension context invalidated') ||
            errorMsg.includes('message port closed') ||
            errorMsg.includes('Receiving end does not exist')) {
          console.warn('Extension was reloaded. Please refresh this page.')
          showContextInvalidatedError()
        } else {
          // For other errors, still try to create FAB (content script can work independently)
          console.warn('Message failed but creating FAB anyway for standalone functionality')
          createFAB()
        }
      }
    }
  } catch (error) {
    console.error('Juno content script error:', error)
  }
}

// Create floating action button
function createFAB() {
  // Check if FAB already exists
  if (document.getElementById('juno-fab')) return

  const fab = document.createElement('button')
  fab.id = 'juno-fab'
  fab.innerHTML = '📄'
  fab.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #0ea5e9;
    color: white;
    border: none;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    transition: transform 0.2s, box-shadow 0.2s;
  `

  fab.addEventListener('mouseenter', () => {
    fab.style.transform = 'scale(1.1)'
    fab.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'
  })

  fab.addEventListener('mouseleave', () => {
    fab.style.transform = 'scale(1)'
    fab.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
  })

  fab.addEventListener('click', async () => {
    // Check if extension context is valid before attempting to communicate
    if (!isExtensionContextValid()) {
      console.error('Extension context is invalid - extension was likely reloaded')
      showContextInvalidatedError()
      return
    }

    // Open side panel using async/await
    try {
      const response = await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })

      if (response && response.success) {
        console.log('Side panel opened successfully')
      } else if (response && !response.success) {
        console.error('Side panel open failed:', response.error)
        alert('Failed to open side panel. Please try again.')
      } else {
        console.warn('Side panel open request sent but response unclear:', response)
      }
    } catch (error) {
      console.error('Error opening side panel:', error)

      // Check for specific context invalidation errors
      const errorMsg = error.message || String(error)
      if (errorMsg.includes('Extension context invalidated') ||
          errorMsg.includes('message port closed') ||
          errorMsg.includes('Receiving end does not exist')) {
        showContextInvalidatedError()
      } else {
        // Other error - show generic message
        alert('Failed to open side panel. Please try again.')
      }
    }
  })

  document.body.appendChild(fab)
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Re-run if URL changes (SPA navigation) or job details panel changes
let lastUrl = location.href
let lastJobTitle = ''

// Debounce function to avoid excessive calls
let debounceTimer
function debounceInit() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const url = location.href

    // Check if URL changed
    if (url !== lastUrl) {
      lastUrl = url
      init()
      return
    }

    // On search results page, check if job details changed
    if (url.includes('/jobs')) {
      const titleElement = document.querySelector('h2[class*="jobTitle"], .jobTitle, h1[class*="jobTitle"]')
      const currentTitle = titleElement?.textContent?.trim() || ''

      if (currentTitle && currentTitle !== lastJobTitle) {
        lastJobTitle = currentTitle
        console.log('Job selection changed, re-detecting...', currentTitle)
        init()
      }
    }
  }, 500) // Wait 500ms after last change
}

new MutationObserver(debounceInit).observe(document, {
  subtree: true,
  childList: true
})

// Listen for messages from side panel to toggle highlighting
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message)

  if (message.type === 'TOGGLE_KEYWORD_HIGHLIGHTING') {
    const { enabled, matchedKeywords, missedKeywords } = message.data

    if (enabled) {
      highlightKeywords(matchedKeywords || [], missedKeywords || [])
      sendResponse({ success: true, highlighted: true })
    } else {
      removeHighlights()
      sendResponse({ success: true, highlighted: false })
    }

    return true // Keep channel open for async response
  }

  return false
})
