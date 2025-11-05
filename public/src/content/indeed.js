// Content script for Indeed job pages
console.log('Juno content script loaded on Indeed')

// Detect if we're on a job posting page
function detectJobPosting() {
  // Check URL pattern
  const isJobPage = window.location.href.includes('/viewjob') ||
                     window.location.href.includes('/rc/clk')

  if (!isJobPage) return null

  // Try to extract job description
  const jobDescriptionSelectors = [
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[id*="jobDesc"]',
    '[class*="jobDesc"]'
  ]

  let jobDescription = ''
  for (const selector of jobDescriptionSelectors) {
    const element = document.querySelector(selector)
    if (element) {
      jobDescription = element.textContent || ''
      break
    }
  }

  if (!jobDescription || jobDescription.trim().length < 50) return null

  // Extract job title
  let jobTitle = ''
  const titleSelectors = [
    '.jobsearch-JobInfoHeader-title',
    'h1[class*="jobTitle"]',
    'h1'
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
    '.jobsearch-InlineCompanyRating',
    '[data-company-name]',
    '.icl-u-lg-mr--sm.icl-u-xs-mr--xs'
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

// Initialize
function init() {
  try {
    const jobData = detectJobPosting()

    if (jobData) {
      console.log('Job posting detected:', jobData.title)

      // Notify background script
      try {
        chrome.runtime.sendMessage({
          type: 'JOB_DETECTED',
          data: jobData
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to send job data:', chrome.runtime.lastError.message)
            // Extension context might be invalidated - show warning to user
            if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
              console.warn('Extension was reloaded. Please refresh this page.')
            }
          }
        })
      } catch (error) {
        console.error('Error communicating with extension:', error)
      }

      // Create floating action button
      createFAB()
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

  fab.addEventListener('click', () => {
    // Open side panel
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to open side panel:', chrome.runtime.lastError.message)
          alert('Extension error. Please reload this page.')
        }
      })
    } catch (error) {
      console.error('Error opening side panel:', error)
      alert('Extension error. Please reload this page.')
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

// Re-run if URL changes (SPA navigation)
let lastUrl = location.href
new MutationObserver(() => {
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    init()
  }
}).observe(document, { subtree: true, childList: true })
