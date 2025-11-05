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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Message received in background:', message)

  if (message.type === 'JOB_DETECTED') {
    // Job posting detected, handle accordingly
    sendResponse({ success: true })
  }

  return true // Keep message channel open for async response
})
