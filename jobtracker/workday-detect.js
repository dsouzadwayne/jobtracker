/**
 * JobTracker Workday Detection
 */

(function() {
  'use strict';

  if (window.__jobTrackerWorkdayDetectInitialized) return;
  window.__jobTrackerWorkdayDetectInitialized = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (/application.*submitted|thank you for applying/i.test(node.textContent)) {
          chrome.runtime.sendMessage({
            type: 'SUBMISSION_DETECTED',
            payload: {
              position: document.querySelector('[data-automation-id="jobPostingHeader"], h1')?.textContent?.trim() || '',
              company: document.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() || '',
              jobUrl: window.location.href,
              platform: 'workday'
            }
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log('JobTracker: Workday detection module loaded');
})();
