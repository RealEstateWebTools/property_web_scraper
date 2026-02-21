import { describe, it, expect, beforeEach } from 'vitest';

describe('content-script', () => {
  let messageListener;

  beforeEach(() => {
    // Set up DOM for content script
    document.title = 'Test Property Page';
    // Capture the listener that content-script.js registers
    messageListener = null;
    chrome.runtime.onMessage.addListener = (fn) => { messageListener = fn; };

    // Execute the content script IIFE inline
    (() => {
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === 'CAPTURE_HTML') {
          sendResponse({
            html: document.documentElement.outerHTML,
            url: window.location.href,
            title: document.title,
          });
        }
        return true;
      });
    })();
  });

  it('responds to CAPTURE_HTML with html, url, and title', () => {
    let response;
    messageListener(
      { type: 'CAPTURE_HTML' },
      {},
      (r) => { response = r; }
    );

    expect(response).toBeDefined();
    expect(response.html).toContain('<html');
    expect(response.title).toBe('Test Property Page');
    expect(typeof response.url).toBe('string');
  });

  it('ignores non-CAPTURE_HTML messages', () => {
    let response;
    messageListener(
      { type: 'OTHER_MSG' },
      {},
      (r) => { response = r; }
    );

    expect(response).toBeUndefined();
  });
});
