/**
 * JobTracker iCIMS Detection
 */

(function() {
  'use strict';

  if (window.__jobTrackerIcimsDetectInitialized) return;
  window.__jobTrackerIcimsDetectInitialized = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (/application.*submitted|thank you/i.test(node.textContent)) {
          chrome.runtime.sendMessage({
            type: 'SUBMISSION_DETECTED',
            payload: {
              position: document.querySelector('.iCIMS_Header h1, .job-title')?.textContent?.trim() || '',
              company: document.querySelector('.iCIMS_Company')?.textContent?.trim() || '',
              jobUrl: window.location.href,
              platform: 'icims'
            }
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log('JobTracker: iCIMS detection module loaded');
})();
