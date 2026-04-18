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

  function extractJobDescription() {
    // Try to get all job description sections and combine them
    const sections = document.querySelectorAll('.section.page-centered, [data-qa="job-description"]');
    if (sections.length > 0) {
      const content = Array.from(sections)
        .map(el => el.innerText?.trim())
        .filter(text => text && !text.includes('Apply for this job'))
        .join('\n\n');
      if (content) return content;
    }

    // Fallback to single container selectors
    const selectors = ['.section-wrapper', '.posting-content', '.content-body'];
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
      position: document.querySelector('.posting-headline h2')?.textContent?.trim() || '',
      company: document.querySelector('.posting-categories .company, .main-header-content h1')?.textContent?.trim() || '',
      location: document.querySelector('.posting-categories .location')?.textContent?.trim() || '',
      jobUrl: window.location.href,
      platform: 'lever',
      jobDescription: extractJobDescription()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
