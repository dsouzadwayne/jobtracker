/**
 * JobTracker SmartRecruiters Detection
 */

(function() {
  'use strict';

  if (window.__jobTrackerSmartrecruitersDetectInitialized) return;
  window.__jobTrackerSmartrecruitersDetectInitialized = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (/application.*submitted|thank you/i.test(node.textContent)) {
          chrome.runtime.sendMessage({
            type: 'SUBMISSION_DETECTED',
            payload: {
              position: document.querySelector('.job-title, h1')?.textContent?.trim() || '',
              company: document.querySelector('.company-name')?.textContent?.trim() || '',
              jobUrl: window.location.href,
              platform: 'smartrecruiters'
            }
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log('JobTracker: SmartRecruiters detection module loaded');
})();
