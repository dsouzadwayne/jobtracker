/**
 * JobTracker SmartRecruiters Detection
 * Extracts job information from SmartRecruiters ATS pages for manual tracking
 * Supports both job listing pages (jobs.smartrecruiters.com) and application pages (oneclick-ui)
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

  /**
   * Extract from window.__OC_CONTEXT__ (available on application/oneclick pages)
   */
  function extractFromContext() {
    try {
      const ctx = window.__OC_CONTEXT__;
      if (!ctx) return null;

      const job = ctx.job || {};
      const branding = ctx.branding || {};
      const company = ctx.company || {};

      const position = job.title || '';
      const companyName = branding.name || company.companyIdentifier || '';
      const location = job.location || job.structuredLocation?.locationString || '';

      if (position || companyName) {
        return {
          position,
          company: companyName,
          location,
          jobUrl: window.location.href,
          platform: 'smartrecruiters',
          jobDescription: '', // Description not in __OC_CONTEXT__, will try DOM
          jobType: job.employmentType || '',
          remote: job.locationRemote ? 'remote' : ''
        };
      }
    } catch (e) {
      console.warn('JobTracker: Failed to extract from __OC_CONTEXT__', e);
    }
    return null;
  }

  /**
   * Extract job description from DOM
   */
  function extractJobDescription() {
    // Skip IE11 notification overlay elements
    const skipSelector = '.isn, [class*="isn-"]';

    const selectors = [
      // Job listing page selectors
      '[itemprop="description"]',
      '.job-sections [itemprop="description"]',
      '#st-jobDescription .wysiwyg',
      '#st-jobDescription',
      '.job-description',
      '.description',
      '[class*="JobDescription"]',
      '[class*="job-description"]',
      // Application page - usually no description but try anyway
      '[data-test="job-description"]'
    ];

    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && !el.closest(skipSelector) && el.innerText?.trim()) {
          return el.innerText.trim().substring(0, 10000);
        }
      } catch (e) {
        // Selector failed
      }
    }
    return '';
  }

  /**
   * Extract location from DOM
   */
  function extractLocation() {
    const skipSelector = '.isn, [class*="isn-"]';

    const selectors = [
      // Custom web component with formattedaddress attribute
      'spl-job-location[formattedaddress]',
      // Microdata
      '[itemprop="jobLocation"] [itemprop="addressLocality"]',
      '[itemprop="jobLocation"] [itemprop="address"]',
      // Topbar on application page
      '[data-test="topbar-location"]',
      // Job listing page
      '.job-details [itemprop="addressLocality"]',
      '.job-location',
      '.location',
      '[class*="JobLocation"]',
      '[class*="job-location"]',
      '[data-automation="job-location"]',
      '.job-info .location'
    ];

    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && !el.closest(skipSelector)) {
          // Handle spl-job-location custom element
          if (el.hasAttribute('formattedaddress')) {
            return el.getAttribute('formattedaddress') || '';
          }
          if (el.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
      } catch (e) {
        // Selector failed
      }
    }
    return '';
  }

  /**
   * Extract company name from DOM
   */
  function extractCompany() {
    const skipSelector = '.isn, [class*="isn-"]';

    const selectors = [
      // Microdata - meta tag with content attribute
      '[itemprop="hiringOrganization"] [itemprop="name"]',
      'meta[itemprop="name"][content]',
      // Logo alt text
      '.header-logo img[alt]',
      '[data-test="topbar-logo"][alt]',
      'img.brand-logo[alt]',
      // Fallback
      '.company-name',
      '[class*="company-name"]'
    ];

    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && !el.closest(skipSelector)) {
          // Handle meta tags
          if (el.tagName === 'META') {
            const content = el.getAttribute('content');
            if (content && content.length < 100) return content;
          }
          // Handle img alt text
          if (el.tagName === 'IMG') {
            const alt = el.getAttribute('alt');
            if (alt && alt.length < 100 && !alt.toLowerCase().includes('logo')) {
              return alt.replace(/\s*logo\s*/i, '').trim();
            }
          }
          // Regular text content
          if (el.textContent?.trim() && el.textContent.trim().length < 100) {
            return el.textContent.trim();
          }
        }
      } catch (e) {
        // Selector failed
      }
    }
    return '';
  }

  /**
   * Extract position/job title from DOM
   */
  function extractPosition() {
    const skipSelector = '.isn, [class*="isn-"]';

    const selectors = [
      // Job listing page - specific selectors first
      'h1.job-title[itemprop="title"]',
      'h1.job-title',
      '.job-title[itemprop="title"]',
      '[itemprop="title"]',
      // Application page topbar
      '[data-test="topbar-job-title"]',
      // Fallback - but NOT generic h1 (might pick up IE11 notification)
      'main h1',
      '.jobad-main h1'
    ];

    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && !el.closest(skipSelector) && el.textContent?.trim()) {
          const text = el.textContent.trim();
          // Skip if it looks like the IE11 notification
          if (text.length < 200 && !text.toLowerCase().includes('internet explorer')) {
            return text;
          }
        }
      } catch (e) {
        // Selector failed
      }
    }
    return '';
  }

  /**
   * Extract employment type from DOM
   */
  function extractEmploymentType() {
    const selectors = [
      '[itemprop="employmentType"]',
      '.job-details li:not([itemprop])'
    ];

    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && el.textContent?.trim()) {
          const text = el.textContent.trim().toLowerCase();
          if (text.includes('full-time') || text.includes('full time')) return 'full-time';
          if (text.includes('part-time') || text.includes('part time')) return 'part-time';
          if (text.includes('contract')) return 'contract';
          if (text.includes('internship') || text.includes('intern')) return 'internship';
        }
      } catch (e) {
        // Selector failed
      }
    }
    return '';
  }

  /**
   * Main extraction function
   */
  function extractJobInfo() {
    // First try extracting from __OC_CONTEXT__ (application page)
    let info = extractFromContext();

    if (info) {
      // Fill in missing fields from DOM
      if (!info.jobDescription) {
        info.jobDescription = extractJobDescription();
      }
      if (!info.location) {
        info.location = extractLocation();
      }
      return info;
    }

    // Fall back to full DOM extraction (job listing page)
    return {
      position: extractPosition(),
      company: extractCompany(),
      location: extractLocation(),
      jobUrl: window.location.href,
      platform: 'smartrecruiters',
      jobDescription: extractJobDescription(),
      jobType: extractEmploymentType()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
