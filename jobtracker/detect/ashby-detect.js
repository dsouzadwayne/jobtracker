/**
 * JobTracker Ashby Detection
 * Extracts job information from Ashby ATS pages (jobs.ashbyhq.com)
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  if (window.__jobTrackerAshbyDetectInitialized) return;
  window.__jobTrackerAshbyDetectInitialized = true;

  // Check if we're on an Ashby job page
  function isAshbyJobPage() {
    return window.location.hostname.includes('ashbyhq.com') ||
           window.location.hostname.includes('ashbyprd.com');
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isAshbyJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Ashby detection module loaded (manual mode)');
  }

  function extractJobDescription() {
    // Try to get job description from __appData (Ashby stores data in window)
    try {
      if (window.__appData?.posting?.descriptionPlainText) {
        return window.__appData.posting.descriptionPlainText;
      }
    } catch (e) {}

    // Fallback: Try common Ashby selectors
    const selectors = [
      '.ashby-job-posting-description',
      '[class*="description"]',
      '.posting-description',
      '.job-description'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText?.trim()) {
        return el.innerText.trim();
      }
    }

    // Last resort: look for main content area
    const mainContent = document.querySelector('[class*="right-pane"], [class*="content"]');
    if (mainContent) {
      return mainContent.innerText?.trim() || '';
    }

    return '';
  }

  function extractCompanyName() {
    // Try __appData first
    try {
      if (window.__appData?.organization?.name) {
        return window.__appData.organization.name;
      }
      if (window.__appData?.posting?.linkedData?.hiringOrganization?.name) {
        return window.__appData.posting.linkedData.hiringOrganization.name;
      }
    } catch (e) {}

    // Try meta tags
    const metaOg = document.querySelector('meta[property="og:site_name"]');
    if (metaOg?.content) return metaOg.content;

    // Try page title parsing (format: "Job Title @ Company")
    const title = document.title;
    if (title.includes('@')) {
      return title.split('@').pop()?.trim() || '';
    }

    // Try logo alt text
    const logo = document.querySelector('[class*="logo"] img, .ashby-job-posting-header img');
    if (logo?.alt) return logo.alt;

    // Try header link
    const headerLink = document.querySelector('[class*="navLogo"] img');
    if (headerLink?.alt) return headerLink.alt;

    return '';
  }

  function extractLocation() {
    // Try __appData first
    try {
      if (window.__appData?.posting?.locationName) {
        return window.__appData.posting.locationName;
      }
      const address = window.__appData?.posting?.address?.postalAddress;
      if (address) {
        return [address.addressLocality, address.addressCountry].filter(Boolean).join(', ');
      }
    } catch (e) {}

    // Try common selectors
    const selectors = [
      '.ashby-job-posting-brief-location',
      '[class*="location"]',
      '[class*="Location"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.trim()) {
        const text = el.textContent.trim();
        // Avoid picking up labels like "Location"
        if (text.length > 3 && !text.toLowerCase().startsWith('location')) {
          return text;
        }
      }
    }

    return '';
  }

  function extractJobTitle() {
    // Try __appData first
    try {
      if (window.__appData?.posting?.title) {
        return window.__appData.posting.title;
      }
    } catch (e) {}

    // Try heading
    const heading = document.querySelector('.ashby-job-posting-heading, h1[class*="title"], h1');
    if (heading?.textContent?.trim()) {
      return heading.textContent.trim();
    }

    // Try meta
    const metaTitle = document.querySelector('meta[property="og:title"]');
    if (metaTitle?.content) return metaTitle.content;

    // Parse from page title (format: "Job Title @ Company")
    const title = document.title;
    if (title.includes('@')) {
      return title.split('@')[0]?.trim() || '';
    }

    return title;
  }

  function extractJobInfo() {
    return {
      position: extractJobTitle(),
      company: extractCompanyName(),
      location: extractLocation(),
      jobUrl: window.location.href,
      platform: 'ashby',
      jobDescription: extractJobDescription(),
      // Additional metadata
      employmentType: window.__appData?.posting?.employmentType || '',
      workplaceType: window.__appData?.posting?.workplaceType || '',
      department: window.__appData?.posting?.departmentName || ''
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
