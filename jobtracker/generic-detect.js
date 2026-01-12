/**
 * JobTracker Generic Detection
 * Detects job application submissions on unsupported sites using heuristics
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
    /smartrecruiters\.com/i
  ];

  if (SUPPORTED_PLATFORMS.some(p => p.test(window.location.href))) {
    return;
  }

  // Configuration
  const CONFIG = {
    confidenceThreshold: 50,
    debounceMs: 1000,
    formSubmitCheckDelayMs: 2000
  };

  // Success URL patterns
  const SUCCESS_URL_PATTERNS = [
    /\/thank[-_]?you/i,
    /\/success/i,
    /\/confirmation/i,
    /\/application[-_]?received/i,
    /\/applied/i,
    /\/submitted/i,
    /submitted=true/i,
    /status=success/i,
    /complete[d]?$/i
  ];

  // Success text patterns
  const SUCCESS_TEXT_PATTERNS = [
    /application.*(?:submitted|received|sent|complete)/i,
    /thank(?:s| you).*(?:for )?appl(?:ying|ication)/i,
    /successfully.*applied/i,
    /we(?:'ve| have).*received.*application/i,
    /your application has been/i,
    /application.*confirmed/i,
    /we(?:'ll| will).*(?:contact|reach|review|get back)/i,
    /next\s+steps/i,
    /confirmation.*(?:number|email|sent)/i,
    /you(?:'ve| have).*applied/i
  ];

  // Success DOM selectors
  const SUCCESS_SELECTORS = [
    '[class*="success"]',
    '[class*="confirmation"]',
    '[class*="thank"]',
    '[class*="submitted"]',
    '[class*="complete"]',
    '[role="alert"][aria-live="polite"]',
    '.submitted',
    '#confirmation',
    '[data-testid*="success"]',
    '[data-testid*="confirmation"]'
  ];

  // Job form indicators
  const JOB_FORM_INDICATORS = [
    /apply/i,
    /application/i,
    /resume/i,
    /cv/i,
    /cover.?letter/i,
    /candidate/i,
    /career/i,
    /job/i,
    /position/i,
    /hire/i
  ];

  // State
  let pendingSubmission = null;
  let hasDetectedSuccess = false;
  let lastCheckedUrl = '';
  let settings = null;

  // Initialize
  async function init() {
    try {
      // Get settings
      settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

      if (settings?.detection?.enableGenericDetection === false) {
        return;
      }

      // Check if current page looks like a success page
      checkForSuccess();

      // Observe DOM for dynamic success indicators
      observeDOMChanges();

      // Intercept form submissions
      interceptFormSubmissions();

      // Watch for URL changes (SPA navigation)
      observeUrlChanges();

      console.log('JobTracker: Generic detection initialized');
    } catch (error) {
      console.error('JobTracker: Error initializing generic detection:', error);
    }
  }

  // Calculate confidence score for success detection
  function calculateConfidence() {
    let score = 0;
    const url = window.location.href;
    const pageText = document.body?.innerText || '';

    // URL signals (0-30 points)
    if (SUCCESS_URL_PATTERNS.some(p => p.test(url))) {
      score += 30;
    }

    // Text signals (0-40 points, 10 each, max 4)
    let textMatches = 0;
    for (const pattern of SUCCESS_TEXT_PATTERNS) {
      if (pattern.test(pageText) && textMatches < 4) {
        score += 10;
        textMatches++;
      }
    }

    // DOM signals (0-20 points, 10 each, max 2)
    let domMatches = 0;
    for (const selector of SUCCESS_SELECTORS) {
      try {
        if (document.querySelector(selector) && domMatches < 2) {
          score += 10;
          domMatches++;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Form context (0-10 points)
    if (pendingSubmission) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  // Check if current page indicates success
  function checkForSuccess() {
    if (hasDetectedSuccess) return;
    if (window.location.href === lastCheckedUrl) return;

    lastCheckedUrl = window.location.href;
    const confidence = calculateConfidence();

    if (confidence >= CONFIG.confidenceThreshold) {
      handleSuccessDetected(confidence);
    }
  }

  // Handle detected success
  async function handleSuccessDetected(confidence) {
    if (hasDetectedSuccess) return;
    hasDetectedSuccess = true;

    try {
      const jobInfo = extractJobInfo();

      // Need at least some info to track
      if (!jobInfo.company && !jobInfo.position) {
        console.log('JobTracker: Success detected but could not extract job info');
        hasDetectedSuccess = false; // Allow retry
        return;
      }

      await chrome.runtime.sendMessage({
        type: 'SUBMISSION_DETECTED',
        payload: {
          ...jobInfo,
          platform: 'other',
          source: 'generic-detection',
          confidence: confidence,
          detectionSource: window.location.href
        }
      });

      console.log('JobTracker: Generic detection - application tracked:', jobInfo);
    } catch (error) {
      console.error('JobTracker: Error in generic detection:', error);
      hasDetectedSuccess = false;
    }
  }

  // Extract job info from page
  function extractJobInfo() {
    const info = {
      company: '',
      position: '',
      location: '',
      jobUrl: window.location.href
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

    // Use pending submission info if available
    if (pendingSubmission) {
      info.position = info.position || pendingSubmission.position;
      info.company = info.company || pendingSubmission.company;
      info.location = info.location || pendingSubmission.location;
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

  // Observe DOM changes for dynamic success indicators
  function observeDOMChanges() {
    const observer = new MutationObserver(
      debounce(() => {
        checkForSuccess();
      }, CONFIG.debounceMs)
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Intercept form submissions
  function interceptFormSubmissions() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (isJobApplicationForm(form)) {
        // Store current job info before form submission
        pendingSubmission = extractJobInfo();

        // Check for success after form processes
        setTimeout(() => {
          checkForSuccess();
        }, CONFIG.formSubmitCheckDelayMs);
      }
    }, true);

    // Also handle click on submit buttons (some forms use JS submission)
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button[type="submit"], input[type="submit"], [class*="submit"]');
      if (button) {
        const form = button.closest('form');
        if (form && isJobApplicationForm(form)) {
          pendingSubmission = extractJobInfo();
          setTimeout(() => {
            checkForSuccess();
          }, CONFIG.formSubmitCheckDelayMs);
        }
      }
    }, true);
  }

  // Check if form is a job application form
  function isJobApplicationForm(form) {
    const formText = [
      form.id,
      form.className,
      form.getAttribute('name'),
      form.getAttribute('action'),
      form.getAttribute('data-testid')
    ].join(' ').toLowerCase();

    // Check form attributes
    if (JOB_FORM_INDICATORS.some(p => p.test(formText))) {
      return true;
    }

    // Check for resume/file upload
    if (form.querySelector('input[type="file"]')) {
      return true;
    }

    // Check for job-related input fields
    const inputs = form.querySelectorAll('input, textarea');
    let score = 0;
    for (const input of inputs) {
      const inputText = [input.name, input.id, input.placeholder].join(' ').toLowerCase();
      if (/resume|cv|cover|linkedin|experience|education|skills/.test(inputText)) {
        score++;
      }
    }

    return score >= 2;
  }

  // Watch for URL changes (SPA navigation)
  function observeUrlChanges() {
    let lastUrl = window.location.href;

    // Override pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
      originalPushState.apply(this, arguments);
      handleUrlChange();
    };

    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      handleUrlChange();
    };

    // Listen for popstate
    window.addEventListener('popstate', handleUrlChange);

    function handleUrlChange() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        hasDetectedSuccess = false; // Reset for new page
        setTimeout(() => {
          checkForSuccess();
        }, 500);
      }
    }
  }

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
