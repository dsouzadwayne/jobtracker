/**
 * JobTracker Glassdoor Detection
 * Extracts job information from Glassdoor job pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerGlassdoorDetectInitialized) return;
  window.__jobTrackerGlassdoorDetectInitialized = true;

  const SELECTORS = {
    jobTitle: '[data-test="job-title"], h1',
    company: '[data-test="employer-name"]',
    location: '[data-test="location"]'
  };

  // Check if we're on a Glassdoor job page
  function isGlassdoorJobPage() {
    return /glassdoor\.(com|co\.uk)/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isGlassdoorJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Glassdoor detection module loaded (manual mode)');
  }

  function extractJobInfo() {
    return {
      position: document.querySelector(SELECTORS.jobTitle)?.textContent?.trim() || '',
      company: document.querySelector(SELECTORS.company)?.textContent?.trim() || '',
      location: document.querySelector(SELECTORS.location)?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'glassdoor'
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
