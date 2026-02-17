/**
 * content-script.js — Injected into supported property listing pages.
 * Captures the page HTML when requested by the popup.
 */

(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'CAPTURE_HTML') {
      sendResponse({
        html: document.documentElement.outerHTML,
        url: window.location.href,
        title: document.title,
      });
    }
    return true; // Keep message channel open for async response
  });
})();
