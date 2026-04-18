/**
 * Proximity-Based Extraction Strategy
 * Finds job information by proximity to known elements (Apply button, etc.)
 * Confidence: 0.55
 */

const SOURCE_NAME = 'proximity';
const BASE_CONFIDENCE = 0.55;

// Maximum distance in pixels to consider elements "nearby"
const MAX_DISTANCE = 500;

// Anchor patterns - elements we search near
const ANCHOR_PATTERNS = {
  applyButton: [
    'button[class*="apply"]',
    'a[class*="apply"]',
    'button:contains("Apply")',
    '[data-testid*="apply"]',
    'input[type="submit"][value*="Apply"]',
    '.apply-button',
    '#apply-button',
    'a[href*="apply"]'
  ],
  saveButton: [
    'button[class*="save"]',
    '[data-testid*="save"]',
    '.save-job'
  ],
  companyLogo: [
    'img[class*="logo"]',
    'img[alt*="logo"]',
    '[class*="company-logo"]',
    'header img'
  ],
  jobHeader: [
    '[class*="job-header"]',
    '[class*="posting-header"]',
    '.job-details-header',
    'header[class*="job"]'
  ]
};

// Elements to look for near anchors
const TARGET_ELEMENTS = {
  position: ['h1', 'h2', '[role="heading"]', '.title', '[class*="title"]'],
  company: ['a[href*="company"]', 'span', 'a', '[class*="company"]', '[class*="employer"]'],
  location: ['span', 'div', '[class*="location"]', 'address']
};

/**
 * Extract job data using proximity-based detection
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
    // Find all anchor elements
    const anchors = findAnchors(doc);

    // For each anchor type, find nearby job-related elements
    for (const [anchorType, elements] of Object.entries(anchors)) {
      for (const anchor of elements) {
        extractNearAnchor(doc, anchor, anchorType, results);
      }
    }

    // Also try document structure-based extraction
    extractByStructure(doc, results);

  } catch (e) {
    console.log('[Proximity] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Find all anchor elements on the page
 * @param {Document} doc - Document to search
 * @returns {Object} Object with arrays of anchor elements by type
 */
function findAnchors(doc) {
  const anchors = {};

  for (const [type, selectors] of Object.entries(ANCHOR_PATTERNS)) {
    anchors[type] = [];

    for (const selector of selectors) {
      try {
        // Handle :contains pseudo-selector specially
        if (selector.includes(':contains')) {
          const baseSelector = selector.replace(/:contains\("[^"]+"\)/, '');
          const textMatch = selector.match(/:contains\("([^"]+)"\)/);
          if (textMatch) {
            const elements = doc.querySelectorAll(baseSelector);
            for (const el of elements) {
              if (el.textContent.toLowerCase().includes(textMatch[1].toLowerCase())) {
                anchors[type].push(el);
              }
            }
          }
        } else {
          const elements = doc.querySelectorAll(selector);
          anchors[type].push(...elements);
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
  }

  return anchors;
}

/**
 * Extract job info near a specific anchor element
 * @param {Document} doc - Document
 * @param {Element} anchor - Anchor element
 * @param {string} anchorType - Type of anchor
 * @param {Object} results - Results to populate
 */
function extractNearAnchor(doc, anchor, anchorType, results) {
  const anchorRect = anchor.getBoundingClientRect();

  // Find position (usually in a heading near the apply button)
  if (anchorType === 'applyButton' || anchorType === 'jobHeader') {
    const positionCandidates = findNearbyElements(
      doc,
      anchorRect,
      TARGET_ELEMENTS.position,
      MAX_DISTANCE
    );

    for (const { element, distance } of positionCandidates) {
      const text = element.textContent?.trim();
      if (text && isLikelyJobTitle(text)) {
        // Confidence decreases with distance
        const distanceMultiplier = 1 - (distance / MAX_DISTANCE) * 0.3;
        results.position.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * distanceMultiplier,
          selector: `proximity:${anchorType}`,
          metadata: { distance, anchorType }
        });
      }
    }
  }

  // Find company name near logo
  if (anchorType === 'companyLogo') {
    // For logos, also check alt text
    if (anchor.alt && anchor.alt.length > 1 && anchor.alt.length < 100) {
      results.company.push({
        value: anchor.alt,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.85,
        selector: 'proximity:companyLogo[alt]'
      });
    }

    const companyCandidates = findNearbyElements(
      doc,
      anchorRect,
      TARGET_ELEMENTS.company,
      MAX_DISTANCE / 2  // Shorter distance for company near logo
    );

    for (const { element, distance } of companyCandidates) {
      const text = element.textContent?.trim();
      if (text && isLikelyCompanyName(text)) {
        const distanceMultiplier = 1 - (distance / MAX_DISTANCE) * 0.4;
        results.company.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * distanceMultiplier * 0.9,
          selector: 'proximity:companyLogo',
          metadata: { distance }
        });
      }
    }
  }

  // Find location near job header or apply button
  if (anchorType === 'jobHeader' || anchorType === 'applyButton') {
    const locationCandidates = findNearbyElements(
      doc,
      anchorRect,
      TARGET_ELEMENTS.location,
      MAX_DISTANCE
    );

    for (const { element, distance } of locationCandidates) {
      const text = element.textContent?.trim();
      if (text && isLikelyLocation(text)) {
        const distanceMultiplier = 1 - (distance / MAX_DISTANCE) * 0.3;
        results.location.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * distanceMultiplier * 0.85,
          selector: `proximity:${anchorType}`,
          metadata: { distance }
        });
      }
    }
  }
}

/**
 * Find elements near a reference point
 * @param {Document} doc - Document
 * @param {DOMRect} refRect - Reference element's bounding rect
 * @param {Array} selectors - CSS selectors to search
 * @param {number} maxDist - Maximum distance
 * @returns {Array} Array of { element, distance }
 */
function findNearbyElements(doc, refRect, selectors, maxDist) {
  const results = [];
  const centerX = refRect.left + refRect.width / 2;
  const centerY = refRect.top + refRect.height / 2;

  for (const selector of selectors) {
    try {
      const elements = doc.querySelectorAll(selector);

      for (const el of elements) {
        const rect = el.getBoundingClientRect();

        // Skip elements not in viewport
        if (rect.width === 0 || rect.height === 0) continue;

        // Calculate distance from centers
        const elCenterX = rect.left + rect.width / 2;
        const elCenterY = rect.top + rect.height / 2;
        const distance = Math.sqrt(
          Math.pow(elCenterX - centerX, 2) +
          Math.pow(elCenterY - centerY, 2)
        );

        if (distance <= maxDist) {
          results.push({ element: el, distance });
        }
      }
    } catch (e) {
      // Invalid selector
    }
  }

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance);

  return results;
}

/**
 * Extract based on document structure (hierarchical proximity)
 * @param {Document} doc - Document
 * @param {Object} results - Results to populate
 */
function extractByStructure(doc, results) {
  // Look for job title as the first prominent heading
  const mainContent = doc.querySelector('main, [role="main"], article, .content');
  if (mainContent) {
    // Find the first h1 that's likely a job title
    const h1s = mainContent.querySelectorAll('h1');
    for (const h1 of h1s) {
      const text = h1.textContent?.trim();
      if (text && isLikelyJobTitle(text)) {
        results.position.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.8,
          selector: 'structure:main>h1'
        });
        break;
      }
    }

    // Look for company in header or near title
    const header = mainContent.querySelector('header') || mainContent;
    const companyLinks = header.querySelectorAll('a');
    for (const link of companyLinks) {
      const text = link.textContent?.trim();
      if (text && isLikelyCompanyName(text) && !isLikelyJobTitle(text)) {
        results.company.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.7,
          selector: 'structure:header>a'
        });
        break;
      }
    }
  }
}

/**
 * Check if text looks like a job title
 */
function isLikelyJobTitle(text) {
  if (!text || text.length < 3 || text.length > 150) return false;

  // Positive patterns
  const titlePatterns = [
    /engineer/i, /developer/i, /designer/i, /manager/i, /director/i,
    /analyst/i, /specialist/i, /coordinator/i, /lead/i, /senior/i,
    /junior/i, /intern/i, /consultant/i, /architect/i, /scientist/i,
    /administrator/i, /executive/i, /associate/i, /officer/i
  ];

  // Negative patterns
  const notTitlePatterns = [
    /^(apply|submit|login|home|about|contact|search|menu)$/i,
    /cookie|privacy|terms/i,
    /^(view|read|click|see)\s/i,
    /^\d+\s*(jobs?|results?|matches)/i
  ];

  if (notTitlePatterns.some(p => p.test(text))) return false;
  return titlePatterns.some(p => p.test(text));
}

/**
 * Check if text looks like a company name
 */
function isLikelyCompanyName(text) {
  if (!text || text.length < 2 || text.length > 100) return false;

  // Negative patterns
  const notCompanyPatterns = [
    /^(apply|submit|login|home|about|contact|jobs?)$/i,
    /^(view|read|click|see)\s/i,
    /cookie|privacy|terms/i,
    /^\d+/  // Starts with numbers
  ];

  if (notCompanyPatterns.some(p => p.test(text))) return false;

  // Should start with capital letter or number
  return /^[A-Z0-9]/.test(text);
}

/**
 * Check if text looks like a location
 */
function isLikelyLocation(text) {
  if (!text || text.length < 2 || text.length > 150) return false;

  // Common location patterns
  const locationPatterns = [
    /,\s*[A-Z]{2}$/,  // City, ST
    /remote/i,
    /hybrid/i,
    /on-?site/i,
    /\b(usa|uk|canada|germany|india|australia)\b/i,
    /\b(new york|san francisco|london|berlin|paris|tokyo)\b/i
  ];

  return locationPatterns.some(p => p.test(text));
}

/**
 * Check if the strategy is applicable
 */
function isApplicable(doc = document) {
  // Check if we have any anchor elements
  for (const selectors of Object.values(ANCHOR_PATTERNS)) {
    for (const selector of selectors) {
      try {
        if (selector.includes(':contains')) continue;
        if (doc.querySelector(selector)) return true;
      } catch (e) {
        // Invalid selector
      }
    }
  }
  return false;
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  MAX_DISTANCE,
  findNearbyElements,
  isLikelyJobTitle,
  isLikelyCompanyName,
  isLikelyLocation
};
