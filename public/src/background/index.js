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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background:', message)

  if (message.type === 'JOB_DETECTED') {
    // Store job data in chrome.storage.local so side panel can access it
    chrome.storage.local.set({
      currentJob: message.data,
      lastJobUpdate: Date.now()
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to store job data:', chrome.runtime.lastError)
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
      } else {
        console.log('Job data stored:', message.data)
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
          console.log('Side panel opened')
          sendResponse({ success: true })
        })
        .catch((error) => {
          console.error('Failed to open side panel:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true // Keep message channel open for async response
    } else {
      sendResponse({ success: false, error: 'No valid window ID' })
      return false
    }
  }

  // Don't keep channel open for unhandled messages
  return false
})
