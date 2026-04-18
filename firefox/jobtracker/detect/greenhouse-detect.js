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

  // Selectors for the new Greenhouse job board structure
  const SELECTORS = {
    // Job title selectors (new structure first)
    jobTitle: [
      'h1.section-header',
      '.job__title h1',
      '.job-title h1',
      '.app-title',
      'h1'
    ],
    // Company selectors
    company: [
      '.company-name',
      '#header .company',
      'img.logo[alt]' // Extract from logo alt text
    ],
    // Location selectors
    location: [
      '.job__location div',
      '.job__location',
      '.location',
      '[class*="location"]'
    ],
    // Job description selectors
    jobDescription: [
      '.job__description.body',
      '.job__description',
      '.job-post-content',
      '#content',
      '.content-wrapper',
      '[class*="job-description"]'
    ]
  };

  function extractJobDescription() {
    for (const selector of SELECTORS.jobDescription) {
      const el = document.querySelector(selector);
      if (el && el.innerText?.trim()) {
        return el.innerText.trim();
      }
    }
    return '';
  }

  function extractJobInfo() {
    let position = '';
    let company = '';
    let location = '';

    // Extract job title
    for (const selector of SELECTORS.jobTitle) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        position = el.textContent.trim();
        break;
      }
    }

    // Extract company name
    for (const selector of SELECTORS.company) {
      const el = document.querySelector(selector);
      if (el) {
        // Handle logo alt text extraction
        if (el.tagName === 'IMG' && el.alt) {
          company = el.alt.replace(/\s*logo\s*/i, '').trim();
        } else if (el.textContent?.trim()) {
          company = el.textContent.trim();
        }
        if (company) break;
      }
    }

    // Extract location
    for (const selector of SELECTORS.location) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        location = el.textContent.trim();
        break;
      }
    }

    // Fallback: parse from document title (format: "Job Application for Position at Company")
    if (!position || !company) {
      const title = document.title;
      // Try "Job Application for X at Y" format
      const appMatch = title.match(/Job Application for (.+?) at (.+?)$/i);
      if (appMatch?.[1] && appMatch?.[2]) {
        if (!position) position = appMatch[1].trim();
        if (!company) company = appMatch[2].trim();
      } else {
        // Try "Position at Company - Greenhouse" format
        const titleParts = title.split(' at ');
        if (titleParts.length >= 2 && titleParts[0] && titleParts[1]) {
          if (!position) position = titleParts[0].replace(/Job Application for/i, '').trim();
          const companyParts = titleParts[1].split(' - ');
          if (!company && companyParts?.[0]) company = companyParts[0].trim();
        }
      }
    }

    // Clean up the job URL - remove tracking parameters but keep job ID
    let jobUrl = window.location.href;
    const urlMatch = jobUrl.match(/(https:\/\/[^\/]+\/[^\/]+\/jobs\/\d+)/);
    if (urlMatch) {
      jobUrl = urlMatch[1];
    }

    return {
      position,
      company,
      location,
      jobUrl,
      platform: 'greenhouse',
      jobDescription: extractJobDescription()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
