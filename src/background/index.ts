// Background service worker for Juno extension
// Handles side panel behavior, job data storage, and messaging between scripts.

type JobDetectedMessage = {
  type: 'JOB_DETECTED'
  data: {
    id: string
    title: string
    company?: string
    description: string
    url: string
    source: 'indeed' | 'linkedin' | 'glassdoor'
    detectedAt: string
  }
}

type OpenSidePanelMessage = {
  type: 'OPEN_SIDE_PANEL'
}

type ToggleKeywordHighlightingMessage = {
  type: 'TOGGLE_KEYWORD_HIGHLIGHTING'
  data: {
    enabled: boolean
    matchedKeywords: string[]
    missedKeywords: string[]
  }
}

type UnknownMessage = {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type RuntimeMessage =
  | JobDetectedMessage
  | OpenSidePanelMessage
  | ToggleKeywordHighlightingMessage
  | UnknownMessage

const isJobDetectedMessage = (message: RuntimeMessage): message is JobDetectedMessage => {
  const payload = (message as JobDetectedMessage).data
  return (
    message.type === 'JOB_DETECTED' &&
    payload != null &&
    typeof payload.id === 'string' &&
    typeof payload.title === 'string' &&
    typeof payload.description === 'string' &&
    typeof payload.url === 'string' &&
    typeof payload.detectedAt === 'string'
  )
}

const isToggleHighlightMessage = (
  message: RuntimeMessage
): message is ToggleKeywordHighlightingMessage => {
  if (message.type !== 'TOGGLE_KEYWORD_HIGHLIGHTING') return false
  const payload = (message as ToggleKeywordHighlightingMessage).data
  return (
    payload != null &&
    typeof payload.enabled === 'boolean' &&
    Array.isArray(payload.matchedKeywords) &&
    Array.isArray(payload.missedKeywords)
  )
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Juno] Extension installed')
  } else if (details.reason === 'update') {
    console.log('[Juno] Extension updated')
  }
})

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Juno] Failed to configure side panel behavior:', error))

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  console.log('[Juno] Background received message:', message.type, 'from', sender.tab?.url)

  if (isJobDetectedMessage(message)) {
    chrome.storage.local.set(
      {
        currentJob: message.data,
        lastJobUpdate: Date.now(),
      },
      () => {
        const storageError = chrome.runtime.lastError
        if (storageError) {
          console.error('[Juno] Failed to persist job data:', storageError.message)
          sendResponse({ success: false, error: storageError.message })
        } else {
          sendResponse({ success: true })
        }
      }
    )
    return true
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    const windowId = sender.tab?.windowId
    if (!windowId) {
      sendResponse({ success: false, error: 'No active window' })
      return false
    }

    chrome.sidePanel
      .open({ windowId })
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error('[Juno] Failed to open side panel:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true
  }

  if (isToggleHighlightMessage(message)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]

      if (!activeTab?.id || !activeTab.url?.includes('indeed.com')) {
        sendResponse({ success: false, error: 'No active Indeed tab' })
        return
      }

      chrome.tabs.sendMessage(activeTab.id, message, (response) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError) {
          console.error('[Juno] Forward highlight toggle failed:', runtimeError.message)
          sendResponse({ success: false, error: runtimeError.message })
          return
        }

        sendResponse(response ?? { success: true })
      })
    })

    return true
  }

  console.warn('[Juno] Unknown message type received:', message.type)
  sendResponse({ success: false, error: 'Unknown message type' })
  return false
})
