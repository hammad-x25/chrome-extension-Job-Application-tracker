// background.js
// Runs in the background as a Chrome extension service worker.
// Its only job for now is to open the side panel when the extension icon is clicked.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => {
    console.error("Could not configure side panel:", error);
  });
