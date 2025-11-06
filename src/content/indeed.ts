import {
  COMPANY_SELECTORS,
  JOB_DESCRIPTION_SELECTORS,
  JOB_TITLE_SELECTORS,
  parseAndFilterJobDescription,
} from '@/lib/job-detection'

// Content script injected on Indeed job pages. Detects job postings,
// manages the floating action button, and coordinates keyword highlighting.

type HighlightPayload = {
  type: 'TOGGLE_KEYWORD_HIGHLIGHTING'
  data: {
    enabled: boolean
    matchedKeywords: string[]
    missedKeywords: string[]
  }
}

type JobDetectedPayload = {
  type: 'JOB_DETECTED'
  data: {
    id: string
    title: string
    company?: string
    description: string
    url: string
    source: 'indeed'
    detectedAt: string
  }
}

type RuntimeResponse = { success: boolean; error?: string }

const FAB_ID = 'juno-fab'
const CONTEXT_ERROR_ID = 'juno-context-error'
const HIGHLIGHT_MATCHED = 'juno-highlight-matched'
const HIGHLIGHT_MISSED = 'juno-highlight-missed'

let jobDescriptionElement: HTMLElement | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let lastUrl = window.location.href
let lastPreviewTitle = ''
const highlightingState = { enabled: false }


const highlightStyles = `
  .${HIGHLIGHT_MATCHED} {
    background-color: rgba(34, 197, 94, 0.2);
    border-radius: 4px;
    padding: 0 2px;
  }
  .${HIGHLIGHT_MISSED} {
    background-color: rgba(239, 68, 68, 0.2);
    border-radius: 4px;
    padding: 0 2px;
  }
`

const ensureHighlightStylesInjected = () => {
  if (document.getElementById('juno-highlight-style')) return
  const style = document.createElement('style')
  style.id = 'juno-highlight-style'
  style.textContent = highlightStyles
  document.head.appendChild(style)
}

const highlightKeywords = (matched: string[], missed: string[]): void => {
  if (!jobDescriptionElement) return
  ensureHighlightStylesInjected()

  const matchedSet = new Set(matched.map((keyword) => keyword.toLowerCase()))
  const missedSet = new Set(missed.map((keyword) => keyword.toLowerCase()))

  const walker = document.createTreeWalker(jobDescriptionElement, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.nodeValue && node.nodeValue.trim().length > 0) {
      textNodes.push(node)
    }
  }

  textNodes.forEach((textNode) => {
    const parent = textNode.parentElement
    if (!parent) return

    const original = textNode.nodeValue ?? ''
    const lowerOriginal = original.toLowerCase()

    const allKeywords = [...matchedSet, ...missedSet].filter((keyword) =>
      lowerOriginal.includes(keyword)
    )

    if (allKeywords.length === 0) return

    const fragment = document.createDocumentFragment()
    let lastIndex = 0

    allKeywords.forEach((keyword) => {
      const keywordIndex = lowerOriginal.indexOf(keyword, lastIndex)
      if (keywordIndex === -1) return

      if (keywordIndex > lastIndex) {
        fragment.append(original.substring(lastIndex, keywordIndex))
      }

      const span = document.createElement('span')
      const textMatch = original.substring(keywordIndex, keywordIndex + keyword.length)
      span.textContent = textMatch
      span.className = matchedSet.has(keyword)
        ? HIGHLIGHT_MATCHED
        : HIGHLIGHT_MISSED
      fragment.append(span)
      lastIndex = keywordIndex + keyword.length
    })

    if (lastIndex < original.length) {
      fragment.append(original.substring(lastIndex))
    }

    parent.replaceChild(fragment, textNode)
  })

  highlightingState.enabled = true
  console.log('[Juno] Highlighted keywords:', { matched: matched.length, missed: missed.length })
}

const removeHighlights = (): void => {
  if (!jobDescriptionElement) return

  const spans = jobDescriptionElement.querySelectorAll(`.${HIGHLIGHT_MATCHED}, .${HIGHLIGHT_MISSED}`)
  spans.forEach((span) => {
    const text = document.createTextNode(span.textContent ?? '')
    span.parentNode?.replaceChild(text, span)
  })

  jobDescriptionElement.normalize?.()
  highlightingState.enabled = false
  console.log('[Juno] Highlights removed')
}

const detectJobPosting = () => {
  const isJobPage =
    window.location.href.includes('/viewjob') ||
    window.location.href.includes('/rc/clk') ||
    window.location.href.includes('/jobs')

  if (!isJobPage) return null

  let description = ''
  for (const selector of JOB_DESCRIPTION_SELECTORS) {
    const element = document.querySelector(selector) as HTMLElement | null
    if (element?.textContent && element.textContent.trim().length > 50) {
      description = element.textContent
      jobDescriptionElement = element
      break
    }
  }

  if (!description) return null

  const filteredDescription = parseAndFilterJobDescription(description)

  let title = ''
  for (const selector of JOB_TITLE_SELECTORS) {
    const element = document.querySelector(selector)
    if (element?.textContent?.trim()) {
      title = element.textContent.trim()
      break
    }
  }

  let company: string | undefined
  for (const selector of COMPANY_SELECTORS) {
    const element = document.querySelector(selector)
    if (element?.textContent?.trim()) {
      company = element.textContent.trim()
      break
    }
  }

  const jobId = `indeed-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

  return {
    id: jobId,
    title,
    company,
    description: filteredDescription,
    url: window.location.href,
    source: 'indeed' as const,
    detectedAt: new Date().toISOString(),
  }
}

const isExtensionContextValid = (): boolean => {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

const showContextInvalidatedError = () => {
  if (document.getElementById(CONTEXT_ERROR_ID)) return

  const container = document.createElement('div')
  container.id = CONTEXT_ERROR_ID
  container.style.cssText = `
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

  container.innerHTML = `
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

  document.body.appendChild(container)

  const reloadButton = document.getElementById('juno-reload-btn')
  reloadButton?.addEventListener('click', () => window.location.reload())

  const fab = document.getElementById(FAB_ID) as HTMLButtonElement | null
  if (fab) {
    fab.style.background = '#6b7280'
    fab.style.cursor = 'not-allowed'
    fab.title = 'Extension needs page refresh'
  }
}

const createFab = () => {
  if (document.getElementById(FAB_ID)) return

  const fab = document.createElement('button')
  fab.id = FAB_ID
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
    if (!isExtensionContextValid()) {
      console.warn('[Juno] Extension context invalidated while clicking FAB')
      showContextInvalidatedError()
      return
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'OPEN_SIDE_PANEL',
      } as OpenSidePanelMessage)) as RuntimeResponse | undefined

      if (!response?.success) {
        const error = response?.error ?? 'Unknown error'
        console.error('[Juno] Failed to open side panel:', error)
        alert('Failed to open side panel. Please try again.')
      }
    } catch (error) {
      const message = (error as Error).message ?? String(error)
      console.error('[Juno] Error opening side panel:', message)

      if (
        message.includes('Extension context invalidated') ||
        message.includes('Receiving end does not exist')
      ) {
        showContextInvalidatedError()
      } else {
        alert('Failed to open side panel. Please try again.')
      }
    }
  })

  document.body.appendChild(fab)
}

const init = async () => {
  try {
    const jobData = detectJobPosting()
    if (!jobData) return

    console.log('[Juno] Job detected:', jobData.title)

    if (!isExtensionContextValid()) {
      console.warn('[Juno] Cannot communicate with extension context')
      showContextInvalidatedError()
      return
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'JOB_DETECTED',
        data: jobData,
      } as JobDetectedPayload)) as RuntimeResponse | undefined

      if (!response?.success) {
        console.warn('[Juno] Background rejected job data:', response?.error)
      }

      createFab()
    } catch (error) {
      const message = (error as Error).message ?? String(error)
      console.error('[Juno] Failed to notify background:', message)

      if (
        message.includes('Extension context invalidated') ||
        message.includes('Receiving end does not exist')
      ) {
        showContextInvalidatedError()
      } else {
        createFab()
      }
    }
  } catch (error) {
    console.error('[Juno] Content script initialization error:', error)
  }
}

const debounceInit = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const currentUrl = window.location.href

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      highlightingState.enabled = false
      removeHighlights()
      init()
      return
    }

    if (currentUrl.includes('/jobs')) {
      const titleElement = document.querySelector(
        'h2[class*="jobTitle"], .jobTitle, h1[class*="jobTitle"]'
      )
      const currentTitle = titleElement?.textContent?.trim() ?? ''

      if (currentTitle && currentTitle !== lastPreviewTitle) {
        lastPreviewTitle = currentTitle
        init()
      }
    }
  }, 500)
}

const observer = new MutationObserver(debounceInit)
observer.observe(document, { subtree: true, childList: true })

chrome.runtime.onMessage.addListener((message: HighlightPayload, _sender, sendResponse) => {
  if (message.type !== 'TOGGLE_KEYWORD_HIGHLIGHTING') return false

  const { enabled, matchedKeywords, missedKeywords } = message.data

  if (enabled) {
    highlightKeywords(matchedKeywords, missedKeywords)
    sendResponse({ success: true, highlighted: true })
  } else {
    removeHighlights()
    sendResponse({ success: true, highlighted: false })
  }

  return true
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
