/**
 * JobTracker Generic Detection
 * Extracts job information from unsupported sites using heuristics
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerGenericDetectInitialized) return;
  window.__jobTrackerGenericDetectInitialized = true;

  // Skip if on a supported platform (they have their own detectors)
  const SUPPORTED_PLATFORMS = [
    /linkedin\.com/i,
    /indeed\.com/i,
    /glassdoor\.(com|co\.uk)/i,
    /greenhouse\.io/i,
    /lever\.(co|com)/i,
    /(myworkdayjobs|workday)\.com/i,
    /icims\.com/i,
    /smartrecruiters\.com/i,
    /naukri\.com/i
  ];

  if (SUPPORTED_PLATFORMS.some(p => p.test(window.location.href))) {
    return;
  }

  // Initialize - just expose the job extraction function
  function init() {
    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Generic detection module loaded (manual mode)');
  }

  // Extract job info from page using various strategies
  function extractJobInfo() {
    const info = {
      company: '',
      position: '',
      location: '',
      jobUrl: window.location.href,
      platform: 'other',
      jobDescription: ''
    };

    // Strategy 1: JSON-LD structured data
    try {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        const data = JSON.parse(script.textContent);
        const jobPosting = findJobPosting(data);
        if (jobPosting) {
          info.position = jobPosting.title || info.position;
          info.company = jobPosting.hiringOrganization?.name || info.company;
          info.location = extractLocationFromJobPosting(jobPosting) || info.location;
          info.jobDescription = jobPosting.description || info.jobDescription;
          if (info.position && info.company) break;
        }
      }
    } catch (e) {
      // JSON-LD parsing failed, continue with other strategies
    }

    // Strategy 2: Open Graph / Meta tags
    if (!info.position) {
      info.position =
        document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector('meta[name="title"]')?.content ||
        '';
    }

    if (!info.company) {
      info.company =
        document.querySelector('meta[property="og:site_name"]')?.content ||
        '';
    }

    // Strategy 3: Common selector heuristics
    const positionSelectors = [
      'h1',
      '[class*="job-title"]',
      '[class*="position-title"]',
      '[class*="jobtitle"]',
      '[data-automation*="title"]',
      '[data-testid*="title"]',
      '.job-title',
      '.position-title'
    ];

    const companySelectors = [
      '[class*="company-name"]',
      '[class*="employer"]',
      '[class*="organization"]',
      '[data-automation*="company"]',
      '[data-testid*="company"]',
      '.company-name',
      '.employer-name'
    ];

    const locationSelectors = [
      '[class*="location"]',
      '[class*="job-location"]',
      '[data-automation*="location"]',
      '.location',
      '.job-location'
    ];

    if (!info.position) {
      for (const selector of positionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length < 200) {
            info.position = el.textContent.trim();
            break;
          }
        } catch (e) {}
      }
    }

    if (!info.company) {
      for (const selector of companySelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length < 100) {
            info.company = el.textContent.trim();
            break;
          }
        } catch (e) {}
      }
    }

    if (!info.location) {
      for (const selector of locationSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length < 100) {
            info.location = el.textContent.trim();
            break;
          }
        } catch (e) {}
      }
    }

    // Strategy 4: Document title parsing
    if (!info.position || !info.company) {
      const titleParts = document.title.split(/[-|–—]/);
      if (titleParts.length >= 2) {
        if (!info.position) info.position = titleParts[0].trim();
        if (!info.company) info.company = titleParts[1].trim();
      }
    }

    // Strategy 5: Job description extraction
    if (!info.jobDescription) {
      const descriptionSelectors = [
        '[class*="job-description"]',
        '[class*="jobDescription"]',
        '[class*="description"]',
        '[data-automation*="description"]',
        '[data-testid*="description"]',
        '.job-description',
        '#job-description',
        'article',
        '[role="main"] section'
      ];

      for (const selector of descriptionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.innerText?.trim()) {
            info.jobDescription = el.innerText.trim();
            break;
          }
        } catch (e) {}
      }
    }

    // Clean up extracted text
    info.position = cleanText(info.position);
    info.company = cleanText(info.company);
    info.location = cleanText(info.location);

    return info;
  }

  // Find JobPosting in JSON-LD (may be nested in @graph)
  function findJobPosting(data) {
    if (!data) return null;

    if (data['@type'] === 'JobPosting') {
      return data;
    }

    if (Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        if (item['@type'] === 'JobPosting') {
          return item;
        }
      }
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const found = findJobPosting(item);
        if (found) return found;
      }
    }

    return null;
  }

  // Extract location from JobPosting schema
  function extractLocationFromJobPosting(jobPosting) {
    const loc = jobPosting.jobLocation;
    if (!loc) return '';

    if (typeof loc === 'string') return loc;

    if (loc.address) {
      const addr = loc.address;
      if (typeof addr === 'string') return addr;
      return [addr.addressLocality, addr.addressRegion, addr.addressCountry]
        .filter(Boolean)
        .join(', ');
    }

    return loc.name || '';
  }

  // Clean extracted text
  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\n\r\t]/g, ' ')
      .trim()
      .substring(0, 200);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
