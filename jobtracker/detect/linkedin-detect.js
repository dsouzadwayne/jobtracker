/**
 * JobTracker LinkedIn Detection
 * Extracts job information from LinkedIn job pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
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
    location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet'
  };

  // Valid LinkedIn job page patterns
  const LINKEDIN_JOB_PATTERNS = [
    /linkedin\.com\/jobs\/view/i,
    /linkedin\.com\/jobs\/collections/i
  ];

  // Check if we're on a LinkedIn job page
  function isLinkedInJobPage() {
    return LINKEDIN_JOB_PATTERNS.some(p => p.test(window.location.href));
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isLinkedInJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: LinkedIn detection module loaded (manual mode)');
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
