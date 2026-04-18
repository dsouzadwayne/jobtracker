/**
 * JobTracker iCIMS Detection
 * Extracts job information from iCIMS ATS pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerIcimsDetectInitialized) return;
  window.__jobTrackerIcimsDetectInitialized = true;

  // Check if we're on an iCIMS job page
  function isIcimsJobPage() {
    return /icims\.com/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isIcimsJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: iCIMS detection module loaded (manual mode)');
  }

  function extractJobDescription() {
    const selectors = ['.iCIMS_JobContent', '.job-description', '#iCIMS_Content', '[class*="job-description"]'];
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
      position: document.querySelector('.iCIMS_Header h1, .job-title')?.textContent?.trim() || '',
      company: document.querySelector('.iCIMS_Company')?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'icims',
      jobDescription: extractJobDescription()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
