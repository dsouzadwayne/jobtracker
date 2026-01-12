/**
 * JobTracker Indeed Detection
 * Detects job application submissions on Indeed
 */

(function() {
  'use strict';

  if (window.__jobTrackerIndeedDetectInitialized) return;
  window.__jobTrackerIndeedDetectInitialized = true;

  const SELECTORS = {
    jobTitle: '.jobsearch-JobInfoHeader-title, [data-job-title], h1.icl-u-xs-mb--xs',
    company: '[data-company-name], .jobsearch-CompanyInfoWithoutHeaderImage, .icl-u-lg-mr--sm',
    location: '.jobsearch-JobInfoHeader-subtitle, [data-job-location]',
    successPage: '.ia-PostApply, [class*="post-apply"]'
  };

  const SUCCESS_PATTERNS = [
    /application.*submitted/i,
    /successfully applied/i,
    /your application/i,
    /thank you for applying/i
  ];

  function init() {
    observeSuccess();
    console.log('JobTracker: Indeed detection module loaded');
  }

  function observeSuccess() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const successEl = node.matches?.(SELECTORS.successPage)
            ? node
            : node.querySelector?.(SELECTORS.successPage);

          if (successEl || SUCCESS_PATTERNS.some(p => p.test(node.textContent))) {
            handleSuccess();
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function handleSuccess() {
    try {
      const jobInfo = extractJobInfo();
      if (!jobInfo.company && !jobInfo.position) return;

      await chrome.runtime.sendMessage({
        type: 'SUBMISSION_DETECTED',
        payload: { ...jobInfo, platform: 'indeed', detectionSource: window.location.href }
      });

      console.log('JobTracker: Indeed application detected:', jobInfo);
    } catch (error) {
      console.error('JobTracker: Indeed detection error:', error);
    }
  }

  function extractJobInfo() {
    return {
      position: document.querySelector(SELECTORS.jobTitle)?.textContent?.trim() || '',
      company: document.querySelector(SELECTORS.company)?.textContent?.trim() || '',
      location: document.querySelector(SELECTORS.location)?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'indeed'
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
