/**
 * JobTracker LinkedIn Detection
 * Extracts job information from LinkedIn job pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerLinkedInDetectInitialized) return;
  window.__jobTrackerLinkedInDetectInitialized = true;

  // LinkedIn-specific selectors
  // Target the job details container first (right pane in two-pane view), then find elements within it
  const SELECTORS = {
    jobDetailsPane: '.jobs-search__job-details, .job-view-layout, .jobs-details, .jobs-unified-top-card',

    jobTitle: [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title a',
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title',
      '.jobs-details h1.t-24',
      'h1.t-24'
    ],

    company: [
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a',
      '.jobs-details-top-card__company-url',
      '.hirer-card__hirer-information a[href*="/company/"]',
      '.job-details-jobs-unified-top-card__primary-description-container a[href*="/company/"]'
    ],

    location: [
      '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text--low-emphasis:first-child',
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text'
    ],

    jobDescription: '#job-details, .jobs-description__content, .jobs-description, .jobs-box__html-content',

    // Work arrangement tags (Full-time, Remote, etc.)
    workArrangementTags: '.job-details-fit-level-preferences button .tvm__text--low-emphasis strong',

    // Post metadata (date, applicant count, etc.)
    postMetadata: '.job-details-jobs-unified-top-card__tertiary-description-container',

    // Salary insight selectors
    salaryInsight: [
      '.salary-main-rail__salary-range',
      '.job-details-jobs-unified-top-card__job-insight--highlight'
    ],

    // Active job card in search results
    activeCard: {
      container: '.jobs-search-results-list__list-item--active, [data-job-id][aria-current="page"]',
      footerStatus: '.job-card-container__footer-job-state',
      connectionInsight: '.job-card-container__job-insight-text'
    }
  };

  // Valid LinkedIn job page patterns
  const LINKEDIN_JOB_PATTERNS = [
    /linkedin\.com\/jobs\/view/i,
    /linkedin\.com\/jobs\/collections/i,
    /linkedin\.com\/jobs\/search/i,
    /linkedin\.com\/jobs.*currentJobId=/i,
    /linkedin\.com\/jobs\/?$/i,           // Jobs home
    /linkedin\.com\/jobs\/?[\?#]/i        // Jobs home with query/hash
  ];

  // Check if we're on a LinkedIn job page
  function isLinkedInJobPage() {
    return LINKEDIN_JOB_PATTERNS.some(p => p.test(window.location.href));
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isLinkedInJobPage()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: LinkedIn detection module loaded (manual mode)');
  }

  // Known job type values from LinkedIn tags
  const JOB_TYPE_MAP = {
    'full-time': 'full-time',
    'part-time': 'part-time',
    'contract': 'contract',
    'internship': 'internship',
    'temporary': 'contract',
    'volunteer': '',
    'other': ''
  };

  // Known work arrangement values from LinkedIn tags
  const REMOTE_MAP = {
    'remote': 'remote',
    'on-site': 'onsite',
    'hybrid': 'hybrid'
  };

  /**
   * Parse work arrangement tag buttons for jobType and remote values
   * LinkedIn shows tags like "Full-time", "Remote", "Mid-Senior level" in the detail pane
   */
  function parseWorkArrangementTags(detailsPane) {
    const result = { jobType: '', remote: '' };
    try {
      const tagEls = detailsPane.querySelectorAll(SELECTORS.workArrangementTags);
      for (const el of tagEls) {
        const text = el.textContent.trim().toLowerCase();
        if (!result.jobType && JOB_TYPE_MAP[text] !== undefined) {
          result.jobType = JOB_TYPE_MAP[text];
        }
        if (!result.remote && REMOTE_MAP[text] !== undefined) {
          result.remote = REMOTE_MAP[text];
        }
      }
    } catch (e) {
      // Graceful degradation
    }
    return result;
  }

  /**
   * Extract posting metadata (date, applicant count, promoted, off-platform)
   * from the tertiary description container
   */
  function extractPostMetadata(detailsPane) {
    const meta = {};
    try {
      const container = detailsPane.querySelector(SELECTORS.postMetadata);
      if (!container) return meta;

      const spans = container.querySelectorAll('.tvm__text--low-emphasis');
      const fullText = container.textContent || '';

      for (const span of spans) {
        const text = span.textContent.trim();
        // Posted/reposted date - e.g., "Reposted 1 day ago", "2 weeks ago"
        if (/\d+\s+(?:second|minute|hour|day|week|month)s?\s+ago/i.test(text) ||
            /^reposted/i.test(text)) {
          meta.postedDate = text;
        }
        // Applicant count - e.g., "66 people clicked apply", "Over 100 applicants"
        if (/\d+\s+(?:people|applicant)/i.test(text) || /clicked\s+apply/i.test(text)) {
          meta.applicantCount = text;
        }
      }

      // Check for promoted badge
      if (/promoted/i.test(fullText)) {
        meta.isPromoted = true;
      }

      // Check for off-platform responses
      if (/managed\s+off\s+linkedin/i.test(fullText) ||
          /responses?\s+(?:will\s+be\s+)?(?:managed\s+)?off/i.test(fullText)) {
        meta.offPlatform = true;
      }
    } catch (e) {
      // Graceful degradation
    }
    return meta;
  }

  // Currency/range regex to validate salary-like text
  const SALARY_REGEX = /[\$£€¥₹][\d,]+|[\d,]+\s*[-–to]+\s*[\d,]+|(?:USD|EUR|GBP|INR|CAD|AUD)\s*[\d,]+|\d+[kK]\s*[-–]/;

  /**
   * Extract salary from insight sections in the detail pane
   */
  function extractSalary(detailsPane) {
    try {
      for (const selector of SELECTORS.salaryInsight) {
        const el = detailsPane.querySelector(selector);
        if (el) {
          const text = el.textContent.trim();
          if (SALARY_REGEX.test(text)) {
            return text;
          }
        }
      }
    } catch (e) {
      // Graceful degradation
    }
    return '';
  }

  /**
   * Extract info from the highlighted/active job card in the search results list
   * (footer status badge and connection insight)
   */
  function extractActiveCardInfo() {
    const result = {};
    try {
      const selectors = SELECTORS.activeCard.container.split(', ');
      let card = null;
      for (const sel of selectors) {
        card = document.querySelector(sel);
        if (card) break;
      }
      if (!card) return result;

      // Footer status - "Viewed", "Applied"
      const statusEl = card.querySelector(SELECTORS.activeCard.footerStatus);
      if (statusEl?.textContent?.trim()) {
        result.cardStatus = statusEl.textContent.trim();
      }

      // Connection insight - "1 school alum works here"
      const insightEl = card.querySelector(SELECTORS.activeCard.connectionInsight);
      if (insightEl?.textContent?.trim()) {
        result.connectionInsight = insightEl.textContent.trim();
      }
    } catch (e) {
      // Graceful degradation
    }
    return result;
  }

  // Extract job information from page
  function extractJobInfo() {
    const info = {
      company: '',
      position: '',
      location: '',
      salary: '',
      jobType: '',
      remote: '',
      jobUrl: window.location.href,
      platform: 'linkedin',
      jobDescription: ''
    };

    // Find the job details pane (right pane in two-pane view)
    // This scopes our queries to avoid picking up headers like "Top job picks for you"
    const detailsPane = document.querySelector(SELECTORS.jobDetailsPane) || document;

    // Extract job title - search within details pane
    for (const selector of SELECTORS.jobTitle) {
      const titleEl = detailsPane.querySelector(selector);
      if (titleEl?.textContent?.trim()) {
        info.position = titleEl.textContent.trim();
        break;
      }
    }

    // Extract company - search within details pane
    for (const selector of SELECTORS.company) {
      const companyEl = detailsPane.querySelector(selector);
      if (companyEl?.textContent?.trim()) {
        info.company = companyEl.textContent.trim();
        // Clean up company name (remove extra text)
        info.company = info.company.split('\n')[0].trim();
        break;
      }
    }

    // Extract location - search within details pane
    for (const selector of SELECTORS.location) {
      const locationEl = detailsPane.querySelector(selector);
      if (locationEl?.textContent?.trim()) {
        info.location = locationEl.textContent.trim();
        break;
      }
    }

    // Extract job description
    const descSelectors = SELECTORS.jobDescription.split(', ');
    for (const selector of descSelectors) {
      const descEl = detailsPane.querySelector(selector);
      if (descEl && descEl.innerText?.trim()) {
        info.jobDescription = descEl.innerText.trim();
        break;
      }
    }

    // Extract work arrangement tags (jobType, remote)
    const arrangementTags = parseWorkArrangementTags(detailsPane);
    info.jobType = arrangementTags.jobType;
    info.remote = arrangementTags.remote;

    // Extract salary
    info.salary = extractSalary(detailsPane);

    // Build linkedInMeta from supplementary data
    const postMeta = extractPostMetadata(detailsPane);
    const cardInfo = extractActiveCardInfo();
    const linkedInMeta = { ...postMeta, ...cardInfo };

    // Only attach linkedInMeta if it has at least one property
    if (Object.keys(linkedInMeta).length > 0) {
      info.linkedInMeta = linkedInMeta;
    }

    // Try to get job ID from URL - handle both /jobs/view/ and currentJobId parameter
    let jobId = null;

    // First try /jobs/view/{id} pattern
    const jobIdMatch = window.location.href.match(/\/jobs\/view\/(\d+)/);
    if (jobIdMatch) {
      jobId = jobIdMatch[1];
    }

    // Also check for currentJobId query parameter (used on collections/search pages)
    if (!jobId) {
      const urlParams = new URLSearchParams(window.location.search);
      const currentJobId = urlParams.get('currentJobId');
      if (currentJobId) {
        jobId = currentJobId;
      }
    }

    // Also check for data-job-id attribute on active job card
    if (!jobId) {
      // Try to find the active job card with data-job-id attribute
      const activeJobCard = document.querySelector('[data-job-id].jobs-search-results-list__list-item--active, [data-job-id][aria-current="page"]');
      if (activeJobCard) {
        jobId = activeJobCard.getAttribute('data-job-id');
      }
      // Also check parent li elements with data-occludable-job-id
      // Note: Using fallback approach since :has() isn't supported in all browsers
      if (!jobId) {
        const activeElement = document.querySelector('.jobs-search-results-list__list-item--active');
        if (activeElement) {
          const activeListItem = activeElement.closest('li[data-occludable-job-id]');
          if (activeListItem) {
            jobId = activeListItem.getAttribute('data-occludable-job-id');
          }
        }
      }
    }

    if (jobId) {
      info.jobId = jobId;
      info.jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
    }

    return info;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
