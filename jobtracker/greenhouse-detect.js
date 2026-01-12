/**
 * JobTracker Greenhouse Detection
 * Detects job application submissions on Greenhouse ATS
 */

(function() {
  'use strict';

  if (window.__jobTrackerGreenhouseDetectInitialized) return;
  window.__jobTrackerGreenhouseDetectInitialized = true;

  const SUCCESS_PATTERNS = [
    /thanks for applying/i,
    /application.*received/i,
    /successfully submitted/i,
    /thank you for your application/i
  ];

  function init() {
    observeSuccess();
    observeFormSubmit();
    console.log('JobTracker: Greenhouse detection module loaded');
  }

  function observeSuccess() {
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
  }

  function observeFormSubmit() {
    const form = document.querySelector('#application_form, form[action*="submit"]');
    if (form) {
      form.addEventListener('submit', () => {
        setTimeout(() => handleSuccess(), 2000);
      });
    }
  }

  async function handleSuccess() {
    try {
      const jobInfo = extractJobInfo();
      if (!jobInfo.company && !jobInfo.position) return;

      await chrome.runtime.sendMessage({
        type: 'SUBMISSION_DETECTED',
        payload: { ...jobInfo, platform: 'greenhouse', detectionSource: window.location.href }
      });

      console.log('JobTracker: Greenhouse application detected:', jobInfo);
    } catch (error) {
      console.error('JobTracker: Greenhouse detection error:', error);
    }
  }

  function extractJobInfo() {
    return {
      position: document.querySelector('.app-title, h1')?.textContent?.trim() || document.title.split(' at ')[0] || '',
      company: document.querySelector('.company-name, #header .company')?.textContent?.trim() || document.title.split(' at ')[1]?.split(' - ')[0] || '',
      jobUrl: window.location.href,
      platform: 'greenhouse'
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
