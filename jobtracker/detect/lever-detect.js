/**
 * JobTracker Lever Detection
 * Extracts job information from Lever ATS pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerLeverDetectInitialized) return;
  window.__jobTrackerLeverDetectInitialized = true;

  // Check if we're on a Lever job page
  function isLeverJobPage() {
    return /lever\.(co|com)/.test(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isLeverJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Lever detection module loaded (manual mode)');
  }

  function extractJobInfo() {
    return {
      position: document.querySelector('.posting-headline h2')?.textContent?.trim() || '',
      company: document.querySelector('.posting-categories .company, .main-header-content h1')?.textContent?.trim() || '',
      location: document.querySelector('.posting-categories .location')?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'lever'
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
