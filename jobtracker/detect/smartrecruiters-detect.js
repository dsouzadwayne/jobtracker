/**
 * JobTracker SmartRecruiters Detection
 * Extracts job information from SmartRecruiters ATS pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerSmartrecruitersDetectInitialized) return;
  window.__jobTrackerSmartrecruitersDetectInitialized = true;

  // Check if we're on a SmartRecruiters job page
  function isSmartrecruitersJobPage() {
    return /smartrecruiters\.com/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isSmartrecruitersJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: SmartRecruiters detection module loaded (manual mode)');
  }

  function extractJobDescription() {
    const selectors = ['.job-description', '.description', '[class*="JobDescription"]', '[class*="job-description"]'];
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
      position: document.querySelector('.job-title, h1')?.textContent?.trim() || '',
      company: document.querySelector('.company-name')?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'smartrecruiters',
      jobDescription: extractJobDescription()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
