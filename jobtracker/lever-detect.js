/**
 * JobTracker Lever Detection
 * Detects job application submissions on Lever ATS
 */

(function() {
  'use strict';

  if (window.__jobTrackerLeverDetectInitialized) return;
  window.__jobTrackerLeverDetectInitialized = true;

  const SUCCESS_PATTERNS = [/application.*received/i, /thanks for applying/i, /successfully submitted/i];

  function init() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (SUCCESS_PATTERNS.some(p => p.test(node.textContent))) {
            handleSuccess();
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('JobTracker: Lever detection module loaded');
  }

  async function handleSuccess() {
    const jobInfo = {
      position: document.querySelector('.posting-headline h2')?.textContent?.trim() || '',
      company: document.querySelector('.posting-categories .company, .main-header-content h1')?.textContent?.trim() || '',
      location: document.querySelector('.posting-categories .location')?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'lever'
    };

    if (jobInfo.company || jobInfo.position) {
      await chrome.runtime.sendMessage({
        type: 'SUBMISSION_DETECTED',
        payload: { ...jobInfo, detectionSource: window.location.href }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
