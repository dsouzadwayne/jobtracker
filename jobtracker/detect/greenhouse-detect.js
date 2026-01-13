/**
 * JobTracker Greenhouse Detection
 * Extracts job information from Greenhouse ATS pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerGreenhouseDetectInitialized) return;
  window.__jobTrackerGreenhouseDetectInitialized = true;

  // Check if we're on a Greenhouse job page
  function isGreenhouseJobPage() {
    return /greenhouse\.io/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isGreenhouseJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Greenhouse detection module loaded (manual mode)');
  }

  function extractJobInfo() {
    // Try to get from page elements first, fallback to document title
    let position = document.querySelector('.app-title, h1')?.textContent?.trim() || '';
    let company = document.querySelector('.company-name, #header .company')?.textContent?.trim() || '';

    // Fallback: parse from document title (format: "Position at Company - Greenhouse")
    if (!position || !company) {
      const titleParts = document.title.split(' at ');
      if (titleParts.length >= 2) {
        if (!position) position = titleParts[0].trim();
        if (!company) company = titleParts[1].split(' - ')[0].trim();
      }
    }

    return {
      position,
      company,
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
