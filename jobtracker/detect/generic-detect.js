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
    /naukri\.com/i,
    /ashby(hq|prd)\.com/i
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

    // Strategy 0: Check for __appData (Ashby-like ATS systems)
    try {
      if (window.__appData?.posting) {
        const posting = window.__appData.posting;
        info.position = posting.title || '';
        info.company = window.__appData.organization?.name ||
                      posting.linkedData?.hiringOrganization?.name || '';
        info.location = posting.locationName ||
                       [posting.address?.postalAddress?.addressLocality,
                        posting.address?.postalAddress?.addressCountry].filter(Boolean).join(', ') || '';
        info.jobDescription = posting.descriptionPlainText || '';
        info.platform = 'ashby-like';
        if (info.position && info.company) {
          return info;
        }
      }
    } catch (e) {
      // __appData not available or parsing failed
      console.warn('JobTracker: __appData extraction failed', e.message);
    }

    // Strategy 1: JSON-LD structured data
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const jobPosting = findJobPosting(data);
        if (jobPosting) {
          info.position = jobPosting.title || info.position;
          info.company = jobPosting.hiringOrganization?.name || info.company;
          info.location = extractLocationFromJobPosting(jobPosting) || info.location;
          info.jobDescription = jobPosting.description || info.jobDescription;
          if (info.position && info.company) break;
        }
      } catch (e) {
        // JSON-LD parsing failed for this script, continue with others
        console.warn('JobTracker: JSON-LD parsing failed', e.message);
      }
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
      // Ashby-like ATS selectors
      '.ashby-job-posting-heading',
      '[class*="posting-headline"] h2',
      '[class*="_title_"]',
      // Standard job board selectors
      'h1',
      '[class*="job-title"]',
      '[class*="position-title"]',
      '[class*="jobtitle"]',
      '[data-automation*="title"]',
      '[data-testid*="title"]',
      '.job-title',
      '.position-title',
      // Additional ATS patterns
      '[class*="JobTitle"]',
      '[class*="posting-title"]'
    ];

    const companySelectors = [
      // Ashby-like ATS selectors
      '[class*="navLogo"] img[alt]',
      '[class*="posting-categories"] .company',
      // Standard selectors
      '[class*="company-name"]',
      '[class*="employer"]',
      '[class*="organization"]',
      '[data-automation*="company"]',
      '[data-testid*="company"]',
      '.company-name',
      '.employer-name',
      // Additional ATS patterns
      '[class*="CompanyName"]',
      '[class*="hiringOrganization"]'
    ];

    const locationSelectors = [
      // Ashby-like ATS selectors
      '[class*="posting-categories"] .location',
      '[class*="_location_"]',
      // Standard selectors
      '[class*="location"]',
      '[class*="job-location"]',
      '[data-automation*="location"]',
      '.location',
      '.job-location',
      // Additional ATS patterns
      '[class*="JobLocation"]',
      '[class*="workLocation"]'
    ];

    if (!info.position) {
      for (const selector of positionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length < 200) {
            info.position = el.textContent.trim();
            break;
          }
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
      }
    }

    if (!info.company) {
      for (const selector of companySelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            // Handle image elements (for logo-based company names)
            if (el.tagName === 'IMG' && el.alt) {
              info.company = el.alt.trim();
              break;
            }
            // Handle text elements
            if (el.textContent.trim().length < 100) {
              info.company = el.textContent.trim();
              break;
            }
          }
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
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
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
      }
    }

    // Strategy 4: Document title parsing
    if (!info.position || !info.company) {
      const title = document.title;

      // Ashby format: "Job Title @ Company"
      if (title.includes('@')) {
        const [jobPart, companyPart] = title.split('@');
        if (!info.position && jobPart) info.position = jobPart.trim();
        if (!info.company && companyPart) info.company = companyPart.trim();
      }
      // Standard format: "Job Title - Company" or "Job Title | Company"
      else {
        const titleParts = title.split(/[-|–—]/);
        if (titleParts.length >= 1 && !info.position && titleParts[0]) {
          info.position = titleParts[0].trim();
        }
        if (titleParts.length >= 2 && !info.company && titleParts[1]) {
          info.company = titleParts[1].trim();
        }
      }
    }

    // Strategy 5: Job description extraction
    if (!info.jobDescription) {
      const descriptionSelectors = [
        // Ashby-like ATS selectors
        '.ashby-job-posting-description',
        '[class*="descriptionBody"]',
        '[class*="posting-description"]',
        '[class*="_content_"]',
        // Standard selectors
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
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
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
