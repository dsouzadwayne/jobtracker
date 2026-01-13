/**
 * JobTracker Indeed Detection
 * Extracts job information from Indeed job pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerIndeedDetectInitialized) return;
  window.__jobTrackerIndeedDetectInitialized = true;

  const SELECTORS = {
    jobTitle: '.jobsearch-JobInfoHeader-title, [data-job-title], h1.icl-u-xs-mb--xs',
    company: '[data-company-name], .jobsearch-CompanyInfoWithoutHeaderImage, .icl-u-lg-mr--sm',
    location: '.jobsearch-JobInfoHeader-subtitle, [data-job-location]'
  };

  // Check if we're on an Indeed job page
  function isIndeedJobPage() {
    return /indeed\.com/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isIndeedJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Indeed detection module loaded (manual mode)');
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
