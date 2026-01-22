/**
 * ARIA Labels Extraction Strategy
 * Extracts job information from accessibility attributes
 * Confidence: 0.85
 */

const SOURCE_NAME = 'aria-labels';
const BASE_CONFIDENCE = 0.85;

// Patterns to identify job-related ARIA labels
const ARIA_PATTERNS = {
  position: [
    /job\s*title/i,
    /position\s*title/i,
    /role\s*title/i,
    /job\s*name/i,
    /posting\s*title/i,
    /opening/i
  ],
  company: [
    /company\s*name/i,
    /employer/i,
    /organization/i,
    /hiring\s*company/i,
    /business\s*name/i
  ],
  location: [
    /job\s*location/i,
    /work\s*location/i,
    /office\s*location/i,
    /city/i,
    /location/i
  ],
  salary: [
    /salary/i,
    /compensation/i,
    /pay/i,
    /wage/i
  ]
};

/**
 * Extract job data from ARIA labels
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
    // Find elements with aria-label
    const ariaLabelElements = doc.querySelectorAll('[aria-label]');
    processAriaElements(ariaLabelElements, 'aria-label', results);

    // Find elements with aria-labelledby
    const ariaLabelledByElements = doc.querySelectorAll('[aria-labelledby]');
    processAriaLabelledByElements(ariaLabelledByElements, doc, results);

    // Find elements with aria-describedby (for descriptions)
    const ariaDescribedByElements = doc.querySelectorAll('[aria-describedby]');
    processAriaDescribedByElements(ariaDescribedByElements, doc, results);

    // Find elements with role="heading" that might contain job info
    const headings = doc.querySelectorAll('[role="heading"]');
    processRoleHeadings(headings, results);

    // Find elements with specific ARIA roles that might contain job data
    const mainContent = doc.querySelector('[role="main"]');
    if (mainContent) {
      processMainContent(mainContent, results);
    }

  } catch (e) {
    console.warn('[ARIA Labels] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Process elements with aria-label attribute
 * @param {NodeList} elements - Elements to process
 * @param {string} attrName - Attribute name
 * @param {Object} results - Results object to populate
 */
function processAriaElements(elements, attrName, results) {
  for (const el of elements) {
    const label = el.getAttribute(attrName);
    if (!label) continue;

    // Check which field this label matches
    for (const [field, patterns] of Object.entries(ARIA_PATTERNS)) {
      if (patterns.some(p => p.test(label))) {
        // Get the value from the element content or associated input
        const value = getElementValue(el);
        if (value && value.length > 1 && value.length < 200) {
          results[field].push({
            value,
            source: SOURCE_NAME,
            confidence: BASE_CONFIDENCE,
            selector: `[${attrName}="${label}"]`
          });
        }
      }
    }

    // Also check if the aria-label itself IS the job title (common pattern)
    if (el.tagName === 'H1' || el.getAttribute('role') === 'heading') {
      const content = el.textContent?.trim();
      if (content && content.length > 3 && content.length < 150) {
        // Check if label indicates this is a job title
        if (/job|position|role|title|opening/i.test(label)) {
          results.position.push({
            value: content,
            source: SOURCE_NAME,
            confidence: BASE_CONFIDENCE * 0.9,
            selector: `[${attrName}="${label}"]`
          });
        }
      }
    }
  }
}

/**
 * Process elements with aria-labelledby
 * @param {NodeList} elements - Elements to process
 * @param {Document} doc - Document context
 * @param {Object} results - Results object to populate
 */
function processAriaLabelledByElements(elements, doc, results) {
  for (const el of elements) {
    const labelId = el.getAttribute('aria-labelledby');
    if (!labelId) continue;

    const labelEl = doc.getElementById(labelId);
    if (!labelEl) continue;

    const label = labelEl.textContent?.trim()?.toLowerCase() || '';

    for (const [field, patterns] of Object.entries(ARIA_PATTERNS)) {
      if (patterns.some(p => p.test(label))) {
        const value = getElementValue(el);
        if (value && value.length > 1 && value.length < 200) {
          results[field].push({
            value,
            source: SOURCE_NAME,
            confidence: BASE_CONFIDENCE * 0.95,
            selector: `[aria-labelledby="${labelId}"]`
          });
        }
      }
    }
  }
}

/**
 * Process elements with aria-describedby
 * @param {NodeList} elements - Elements to process
 * @param {Document} doc - Document context
 * @param {Object} results - Results object to populate
 */
function processAriaDescribedByElements(elements, doc, results) {
  for (const el of elements) {
    const descId = el.getAttribute('aria-describedby');
    if (!descId) continue;

    const descEl = doc.getElementById(descId);
    if (!descEl) continue;

    const content = descEl.textContent?.trim() || '';

    // Check if this might be a job description
    if (content.length > 200 && /responsibilities|requirements|qualifications|about\s+the\s+role/i.test(content)) {
      results.jobDescription.push({
        value: content.substring(0, 10000),
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.8,
        selector: `[aria-describedby="${descId}"]`
      });
    }
  }
}

/**
 * Process role="heading" elements
 * @param {NodeList} headings - Heading elements
 * @param {Object} results - Results object to populate
 */
function processRoleHeadings(headings, results) {
  for (const heading of headings) {
    const level = heading.getAttribute('aria-level');
    const content = heading.textContent?.trim();

    if (!content || content.length < 3 || content.length > 200) continue;

    // Level 1 headings often contain job title
    if (level === '1' || !level) {
      // Check if it looks like a job title
      if (looksLikeJobTitle(content)) {
        results.position.push({
          value: content,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.75,
          selector: '[role="heading"]'
        });
      }
    }
  }
}

/**
 * Process main content area for job info
 * @param {Element} main - Main content element
 * @param {Object} results - Results object to populate
 */
function processMainContent(main, results) {
  // Look for job title in the main content area
  const h1 = main.querySelector('h1');
  if (h1) {
    const content = h1.textContent?.trim();
    if (content && content.length > 3 && content.length < 150) {
      if (looksLikeJobTitle(content)) {
        results.position.push({
          value: content,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.7,
          selector: '[role="main"] h1'
        });
      }
    }
  }

  // Look for company name in header/nav within main
  const companyLinks = main.querySelectorAll('a[href*="/company"], a[href*="/about"], .company-name, [class*="company"]');
  for (const link of companyLinks) {
    const content = link.textContent?.trim();
    if (content && content.length > 1 && content.length < 100) {
      results.company.push({
        value: content,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.65,
        selector: '[role="main"] [class*="company"]'
      });
    }
  }
}

/**
 * Get the value from an element (text content or input value)
 * @param {Element} el - Element to get value from
 * @returns {string|null} Element value
 */
function getElementValue(el) {
  // Input/textarea/select
  if (el.value !== undefined && el.value !== '') {
    return el.value.trim();
  }

  // Regular element text content
  const text = el.textContent?.trim();
  return text || null;
}

/**
 * Check if text looks like a job title
 * @param {string} text - Text to check
 * @returns {boolean} True if it looks like a job title
 */
function looksLikeJobTitle(text) {
  // Common job title patterns
  const jobPatterns = [
    /engineer/i,
    /developer/i,
    /designer/i,
    /manager/i,
    /director/i,
    /analyst/i,
    /specialist/i,
    /coordinator/i,
    /consultant/i,
    /lead/i,
    /senior/i,
    /junior/i,
    /associate/i,
    /intern/i,
    /head\s+of/i,
    /vp\s+of/i
  ];

  // Negative patterns (not job titles)
  const notJobTitle = [
    /^(home|about|contact|login|sign\s+in|apply|search)$/i,
    /cookie|privacy|terms/i,
    /^(click|view|read)\s/i
  ];

  if (notJobTitle.some(p => p.test(text))) {
    return false;
  }

  return jobPatterns.some(p => p.test(text));
}

/**
 * Check if the strategy is applicable
 * @param {Document} doc - Document to check
 * @returns {boolean} True if ARIA attributes exist
 */
function isApplicable(doc = document) {
  return doc.querySelectorAll('[aria-label], [aria-labelledby], [role="main"]').length > 0;
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  ARIA_PATTERNS,
  looksLikeJobTitle
};
