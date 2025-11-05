// Background service worker
console.log('Juno background service worker initialized')

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Juno installed')
    // Open onboarding or welcome page
  } else if (details.reason === 'update') {
    console.log('Juno updated')
  }
})

// Handle side panel opening
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error))

// Listen for messages from content scripts
// Using proper async message handler per Chrome MV3 best practices
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background:', message, 'from:', sender.tab?.url || 'unknown')

  // Validate message structure
  if (!message || typeof message !== 'object' || !message.type) {
    console.error('Invalid message format:', message)
    sendResponse({ success: false, error: 'Invalid message format' })
    return false
  }

  if (message.type === 'JOB_DETECTED') {
    // Validate job data
    if (!message.data || !message.data.title || !message.data.description) {
      console.error('Invalid job data:', message.data)
      sendResponse({ success: false, error: 'Invalid job data' })
      return false
    }

    // Store job data in chrome.storage.local so side panel can access it
    chrome.storage.local.set({
      currentJob: message.data,
      lastJobUpdate: Date.now()
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to store job data:', chrome.runtime.lastError)
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        console.log('Job data stored successfully:', message.data.title)
        sendResponse({ success: true })
      }
    })
    return true // Keep message channel open for async response
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Open side panel when FAB is clicked
    if (sender.tab?.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId })
        .then(() => {
          console.log('Side panel opened successfully')
          sendResponse({ success: true })
        })
        .catch((error) => {
          console.error('Failed to open side panel:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true // Keep message channel open for async response
    } else {
      console.error('Cannot open side panel: no valid window ID')
      sendResponse({ success: false, error: 'No valid window ID' })
      return false
    }
  }

  if (message.type === 'TOGGLE_KEYWORD_HIGHLIGHTING') {
    // Forward keyword highlighting toggle to content script
    console.log('Forwarding keyword highlighting toggle to content script')

    // Get the active Indeed tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]

      if (!activeTab || !activeTab.url?.includes('indeed.com')) {
        console.warn('No active Indeed tab found')
        sendResponse({ success: false, error: 'No active Indeed tab' })
        return
      }

      // Send message to content script in the active tab
      chrome.tabs.sendMessage(activeTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to send message to content script:', chrome.runtime.lastError)
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
        } else {
          console.log('Message forwarded successfully:', response)
          sendResponse(response || { success: true })
        }
      })
    })

    return true // Keep message channel open for async response
  }

  // Handle unknown message types
  console.warn('Unknown message type:', message.type)
  sendResponse({ success: false, error: 'Unknown message type' })
  return false
})
