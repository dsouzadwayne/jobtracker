/**
 * CSS Selectors Extraction Strategy
 * Extracts job information using heuristic CSS selectors
 * Confidence: 0.60-0.75
 */

const SOURCE_NAME = 'css-selectors';
const BASE_CONFIDENCE = 0.70;

// Selector definitions with confidence multipliers
const SELECTOR_CONFIGS = {
  position: {
    // High confidence selectors (specific job-related classes)
    high: [
      { selector: '.job-title', confidence: 0.95 },
      { selector: '.position-title', confidence: 0.95 },
      { selector: '[class*="jobTitle"]', confidence: 0.90 },
      { selector: '[class*="job-title"]', confidence: 0.90 },
      { selector: '[class*="positionTitle"]', confidence: 0.90 },
      { selector: '[class*="position-title"]', confidence: 0.90 },
      { selector: '[data-testid*="title"]', confidence: 0.85 },
      { selector: '[data-automation*="title"]', confidence: 0.85 },
      // ATS-specific
      { selector: '.ashby-job-posting-heading', confidence: 0.95 },
      { selector: '[class*="posting-headline"] h2', confidence: 0.90 },
      { selector: '[class*="_title_"]', confidence: 0.85 },
      { selector: '[class*="JobTitle"]', confidence: 0.90 },
      { selector: '[class*="posting-title"]', confidence: 0.90 }
    ],
    // Medium confidence (generic but common)
    medium: [
      { selector: 'h1', confidence: 0.65 },
      { selector: '[role="heading"][aria-level="1"]', confidence: 0.70 },
      { selector: 'main h1', confidence: 0.70 },
      { selector: 'article h1', confidence: 0.68 }
    ],
    // Low confidence (fallback)
    low: [
      { selector: 'h2', confidence: 0.40 },
      { selector: '.title', confidence: 0.45 }
    ]
  },
  company: {
    high: [
      { selector: '.company-name', confidence: 0.95 },
      { selector: '.employer-name', confidence: 0.95 },
      { selector: '[class*="companyName"]', confidence: 0.90 },
      { selector: '[class*="company-name"]', confidence: 0.90 },
      { selector: '[class*="employer"]', confidence: 0.85 },
      { selector: '[class*="organization"]', confidence: 0.85 },
      { selector: '[data-testid*="company"]', confidence: 0.85 },
      { selector: '[data-automation*="company"]', confidence: 0.85 },
      // ATS-specific
      { selector: '[class*="navLogo"] img[alt]', confidence: 0.80, useAlt: true },
      { selector: '[class*="posting-categories"] .company', confidence: 0.85 },
      { selector: '[class*="CompanyName"]', confidence: 0.90 },
      { selector: '[class*="hiringOrganization"]', confidence: 0.90 }
    ],
    medium: [
      { selector: 'header a[href*="/company"]', confidence: 0.60 },
      { selector: 'a[href*="about"]', confidence: 0.40 }
    ],
    low: []
  },
  location: {
    high: [
      { selector: '.job-location', confidence: 0.95 },
      { selector: '.location', confidence: 0.85 },
      { selector: '[class*="jobLocation"]', confidence: 0.90 },
      { selector: '[class*="job-location"]', confidence: 0.90 },
      { selector: '[class*="workLocation"]', confidence: 0.90 },
      { selector: '[data-testid*="location"]', confidence: 0.85 },
      { selector: '[data-automation*="location"]', confidence: 0.85 },
      // ATS-specific
      { selector: '[class*="posting-categories"] .location', confidence: 0.90 },
      { selector: '[class*="_location_"]', confidence: 0.85 },
      { selector: '[class*="JobLocation"]', confidence: 0.90 }
    ],
    medium: [
      { selector: 'address', confidence: 0.50 },
      { selector: '[class*="address"]', confidence: 0.55 }
    ],
    low: []
  },
  salary: {
    high: [
      { selector: '.salary', confidence: 0.95 },
      { selector: '.compensation', confidence: 0.95 },
      { selector: '[class*="salary"]', confidence: 0.90 },
      { selector: '[class*="compensation"]', confidence: 0.90 },
      { selector: '[class*="pay-range"]', confidence: 0.90 },
      { selector: '[data-testid*="salary"]', confidence: 0.85 },
      { selector: '[data-testid*="compensation"]', confidence: 0.85 }
    ],
    medium: [],
    low: []
  },
  jobDescription: {
    high: [
      { selector: '.job-description', confidence: 0.95 },
      { selector: '[class*="jobDescription"]', confidence: 0.90 },
      { selector: '[class*="job-description"]', confidence: 0.90 },
      { selector: '[class*="descriptionBody"]', confidence: 0.90 },
      { selector: '[data-testid*="description"]', confidence: 0.85 },
      { selector: '[data-automation*="description"]', confidence: 0.85 },
      // ATS-specific
      { selector: '.ashby-job-posting-description', confidence: 0.95 },
      { selector: '[class*="posting-description"]', confidence: 0.90 },
      { selector: '[class*="_content_"]', confidence: 0.75 }
    ],
    medium: [
      { selector: 'article', confidence: 0.55 },
      { selector: '[role="main"] section', confidence: 0.50 },
      { selector: '.content', confidence: 0.45 },
      { selector: '#job-description', confidence: 0.85 }
    ],
    low: []
  }
};

/**
 * Extract job data using CSS selectors
 * @param {Document} doc - The document to extract from
 * @returns {Object} Extraction results with candidates per field
 */
function extract(doc = document) {
  const results = {
    position: [],
    company: [],
    location: [],
    salary: [],
    jobDescription: [],
    metadata: {
      source: SOURCE_NAME,
      confidence: BASE_CONFIDENCE,
      timing: 0
    }
  };

  const startTime = performance.now();

  try {
    // Extract each field using priority-ordered selectors
    for (const [field, configs] of Object.entries(SELECTOR_CONFIGS)) {
      // Try high confidence selectors first
      for (const config of configs.high) {
        const candidates = extractWithSelector(doc, config, field);
        results[field].push(...candidates);
      }

      // If no high confidence results, try medium
      if (results[field].length === 0) {
        for (const config of configs.medium) {
          const candidates = extractWithSelector(doc, config, field);
          results[field].push(...candidates);
        }
      }

      // If still nothing, try low confidence
      if (results[field].length === 0) {
        for (const config of configs.low) {
          const candidates = extractWithSelector(doc, config, field);
          results[field].push(...candidates);
        }
      }
    }

    // Platform-specific extraction
    extractPlatformSpecific(doc, results);

  } catch (e) {
    console.log('[CSS Selectors] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Extract using a single selector config
 * @param {Document} doc - Document to extract from
 * @param {Object} config - Selector configuration
 * @param {string} field - Field name
 * @returns {Array} Array of candidates
 */
function extractWithSelector(doc, config, field) {
  const candidates = [];

  try {
    const elements = doc.querySelectorAll(config.selector);

    for (const el of elements) {
      let value;

      // Use alt attribute for images
      if (config.useAlt && el.tagName === 'IMG') {
        value = el.alt;
      } else {
        value = el.textContent;
      }

      if (!value) continue;

      value = cleanText(value);

      // Validate length based on field
      if (!isValidLength(value, field)) continue;

      // Skip if looks like navigation/button text
      if (isNavigationText(value, field)) continue;

      candidates.push({
        value,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * config.confidence,
        selector: config.selector
      });

      // Only take first valid match per selector for most fields
      if (field !== 'location') break;
    }
  } catch (e) {
    // Selector may be invalid, skip silently
    console.debug(`[CSS Selectors] Invalid selector: ${config.selector}`);
  }

  return candidates;
}

/**
 * Platform-specific extraction for known job sites
 * @param {Document} doc - Document
 * @param {Object} results - Results to populate
 */
function extractPlatformSpecific(doc, results) {
  const url = window.location?.href || '';

  // LinkedIn
  if (url.includes('linkedin.com')) {
    extractLinkedIn(doc, results);
  }
  // Naukri
  else if (url.includes('naukri.com')) {
    extractNaukri(doc, results);
  }
}

/**
 * LinkedIn-specific extraction
 */
function extractLinkedIn(doc, results) {
  const linkedInSelectors = {
    position: [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title a',
      '.jobs-unified-top-card__job-title h1',
      '.t-24.job-details-jobs-unified-top-card__job-title'
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a'
    ],
    location: [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet'
    ]
  };

  for (const [field, selectors] of Object.entries(linkedInSelectors)) {
    for (const selector of selectors) {
      try {
        const el = doc.querySelector(selector);
        if (el) {
          const value = cleanText(el.textContent);
          if (value && isValidLength(value, field)) {
            results[field].push({
              value,
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE * 0.9,
              selector
            });
            break;
          }
        }
      } catch (e) {
        // Skip invalid selector
      }
    }
  }
}

/**
 * Naukri-specific extraction
 */
function extractNaukri(doc, results) {
  const naukriSelectors = {
    position: [
      'h1.styles_jd-header-title__rZwM1',
      '.styles_jd-header-title__rZwM1',
      'h1[class*="jd-header-title"]'
    ],
    company: [
      '.styles_jd-header-comp-name__MvqAI > a',
      '[class*="jd-header-comp-name"] > a'
    ],
    location: [
      '.styles_jhc__location__W_pVs a',
      '[class*="jhc__location"] a'
    ]
  };

  for (const [field, selectors] of Object.entries(naukriSelectors)) {
    for (const selector of selectors) {
      try {
        const el = doc.querySelector(selector);
        if (el) {
          const value = cleanText(el.textContent);
          if (value && isValidLength(value, field)) {
            results[field].push({
              value,
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE * 0.9,
              selector
            });
            break;
          }
        }
      } catch (e) {
        // Skip invalid selector
      }
    }
  }
}

/**
 * Clean extracted text
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r\t]/g, ' ')
    .trim();
}

/**
 * Check if value length is valid for field
 */
function isValidLength(value, field) {
  const limits = {
    position: { min: 3, max: 200 },
    company: { min: 2, max: 150 },
    location: { min: 2, max: 150 },
    salary: { min: 3, max: 100 },
    jobDescription: { min: 100, max: 50000 }
  };

  const limit = limits[field] || { min: 1, max: 1000 };
  return value.length >= limit.min && value.length <= limit.max;
}

/**
 * Check if text looks like navigation/button text
 */
function isNavigationText(text, field) {
  const navPatterns = [
    /^(apply|submit|login|sign\s*(in|up)|search|home|menu)$/i,
    /^(view|see|read)\s+(all|more)$/i,
    /^(back|next|continue|cancel)$/i
  ];

  // Only filter for position/company fields
  if (field !== 'position' && field !== 'company') return false;

  return navPatterns.some(p => p.test(text));
}

/**
 * Check if the strategy is applicable
 */
function isApplicable(doc = document) {
  // This strategy is always applicable as a fallback
  return true;
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  SELECTOR_CONFIGS,
  cleanText,
  isValidLength
};
