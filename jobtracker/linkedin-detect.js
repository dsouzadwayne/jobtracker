/**
 * JobTracker LinkedIn Detection
 * Detects job application submissions on LinkedIn
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerLinkedInDetectInitialized) return;
  window.__jobTrackerLinkedInDetectInitialized = true;

  // LinkedIn-specific selectors
  const SELECTORS = {
    jobTitle: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24',
    company: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .jobs-details-top-card__company-url',
    location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet',
    successModal: '[data-test-post-apply-modal], .post-apply-modal',
    successText: '.artdeco-modal__header',
    easyApplyModal: '[data-test-modal-id="easy-apply-modal"]',
    submitButton: 'button[aria-label="Submit application"]',
    doneButton: 'button[aria-label="Dismiss"]'
  };

  // Success indicators
  const SUCCESS_PATTERNS = [
    /application.*sent/i,
    /application.*submitted/i,
    /your application/i,
    /successfully applied/i,
    /thanks for applying/i
  ];

  // Initialize detection
  function init() {
    // Watch for success modal
    observeSuccessModal();

    // Watch for URL changes (SPA navigation)
    observeUrlChanges();

    console.log('JobTracker: LinkedIn detection module loaded');
  }

  // Observe for success modal appearance
  function observeSuccessModal() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check if success modal appeared
          const successModal = node.matches?.(SELECTORS.successModal)
            ? node
            : node.querySelector?.(SELECTORS.successModal);

          if (successModal) {
            handleSuccessDetected();
          }

          // Also check for success text in any added content
          if (isSuccessContent(node.textContent)) {
            handleSuccessDetected();
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Check if content indicates success
  function isSuccessContent(text) {
    if (!text) return false;
    return SUCCESS_PATTERNS.some(pattern => pattern.test(text));
  }

  // Observe URL changes
  function observeUrlChanges() {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;

        // Check if navigated to a success page
        if (/applied|success|thank/i.test(lastUrl)) {
          handleSuccessDetected();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Handle successful application detection
  async function handleSuccessDetected() {
    try {
      // Extract job info
      const jobInfo = extractJobInfo();

      if (!jobInfo.company && !jobInfo.position) {
        console.log('JobTracker: Could not extract job info from LinkedIn');
        return;
      }

      // Send to background for tracking
      await chrome.runtime.sendMessage({
        type: 'SUBMISSION_DETECTED',
        payload: {
          ...jobInfo,
          platform: 'linkedin',
          detectionSource: window.location.href
        }
      });

      console.log('JobTracker: LinkedIn application detected:', jobInfo);
    } catch (error) {
      console.error('JobTracker: Error detecting LinkedIn application:', error);
    }
  }

  // Extract job information from page
  function extractJobInfo() {
    const info = {
      company: '',
      position: '',
      location: '',
      jobUrl: window.location.href,
      platform: 'linkedin'
    };

    // Extract job title
    const titleEl = document.querySelector(SELECTORS.jobTitle);
    if (titleEl) {
      info.position = titleEl.textContent?.trim() || '';
    }

    // Extract company
    const companyEl = document.querySelector(SELECTORS.company);
    if (companyEl) {
      info.company = companyEl.textContent?.trim() || '';
      // Clean up company name (remove extra text)
      info.company = info.company.split('\n')[0].trim();
    }

    // Extract location
    const locationEl = document.querySelector(SELECTORS.location);
    if (locationEl) {
      info.location = locationEl.textContent?.trim() || '';
    }

    // Try to get job ID from URL
    const jobIdMatch = window.location.href.match(/\/jobs\/view\/(\d+)/);
    if (jobIdMatch) {
      info.jobId = jobIdMatch[1];
      info.jobUrl = `https://www.linkedin.com/jobs/view/${info.jobId}`;
    }

    return info;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
