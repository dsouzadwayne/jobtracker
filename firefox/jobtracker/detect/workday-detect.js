/**
 * JobTracker Workday Detection
 * Extracts job information from Workday ATS pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerWorkdayDetectInitialized) return;
  window.__jobTrackerWorkdayDetectInitialized = true;

  // Check if we're on a Workday job page
  function isWorkdayJobPage() {
    return /(myworkdayjobs|workday)\.com/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isWorkdayJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Workday detection module loaded (manual mode)');
  }

  function extractJobDescription() {
    const selectors = [
      '[data-automation-id="jobPostingDescription"]',
      '[data-automation-id="job-posting-details"]',
      '.job-description',
      '[class*="job-description"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText?.trim()) {
        return el.innerText.trim();
      }
    }
    return '';
  }

  function extractJobInfo() {
    return {
      position: document.querySelector('[data-automation-id="jobPostingHeader"], h1')?.textContent?.trim() || '',
      company: document.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'workday',
      jobDescription: extractJobDescription()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
