/**
 * JobTracker Glassdoor Detection
 */

(function() {
  'use strict';

  if (window.__jobTrackerGlassdoorDetectInitialized) return;
  window.__jobTrackerGlassdoorDetectInitialized = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (/application.*submitted|thanks for applying/i.test(node.textContent)) {
          chrome.runtime.sendMessage({
            type: 'SUBMISSION_DETECTED',
            payload: {
              position: document.querySelector('[data-test="job-title"], h1')?.textContent?.trim() || '',
              company: document.querySelector('[data-test="employer-name"]')?.textContent?.trim() || '',
              jobUrl: window.location.href,
              platform: 'glassdoor'
            }
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log('JobTracker: Glassdoor detection module loaded');
})();
