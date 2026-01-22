/**
 * Meta Tags Extraction Strategy
 * Extracts job information from Open Graph and meta tags
 * Confidence: 0.80
 */

const SOURCE_NAME = 'meta-tags';
const BASE_CONFIDENCE = 0.80;

// Meta tag mappings for job fields
const META_MAPPINGS = {
  position: [
    // Open Graph
    { property: 'og:title', confidence: 0.80 },
    // Twitter
    { name: 'twitter:title', confidence: 0.75 },
    // Standard
    { name: 'title', confidence: 0.70 },
    // Job-specific
    { property: 'job:title', confidence: 0.95 },
    { name: 'job-title', confidence: 0.95 },
    { itemprop: 'title', confidence: 0.85 }
  ],
  company: [
    // Open Graph
    { property: 'og:site_name', confidence: 0.85 },
    // Job-specific
    { property: 'job:company', confidence: 0.95 },
    { name: 'company', confidence: 0.90 },
    { name: 'author', confidence: 0.60 },
    { property: 'article:author', confidence: 0.55 },
    { itemprop: 'hiringOrganization', confidence: 0.90 }
  ],
  location: [
    // Job-specific
    { property: 'job:location', confidence: 0.95 },
    { name: 'geo.placename', confidence: 0.85 },
    { name: 'geo.region', confidence: 0.80 },
    { property: 'place:location:latitude', confidence: 0.40 }, // Less useful
    { itemprop: 'jobLocation', confidence: 0.90 }
  ],
  salary: [
    { property: 'job:salary', confidence: 0.95 },
    { name: 'salary', confidence: 0.90 },
    { itemprop: 'baseSalary', confidence: 0.90 }
  ],
  jobDescription: [
    { property: 'og:description', confidence: 0.70 },
    { name: 'description', confidence: 0.65 },
    { name: 'twitter:description', confidence: 0.65 },
    { itemprop: 'description', confidence: 0.75 }
  ]
};

/**
 * Extract job data from meta tags
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
    // Process all meta tags at once for efficiency
    const metaTags = doc.querySelectorAll('meta');
    const metaMap = buildMetaMap(metaTags);

    // Extract each field using mappings
    for (const [field, mappings] of Object.entries(META_MAPPINGS)) {
      for (const mapping of mappings) {
        const value = getMetaValue(metaMap, mapping);
        if (value && isValidValue(value, field)) {
          results[field].push({
            value: cleanMetaValue(value, field),
            source: SOURCE_NAME,
            confidence: mapping.confidence,
            selector: getMetaSelector(mapping)
          });
        }
      }
    }

    // Also check for data-* attributes on html/body
    extractDataAttributes(doc, results);

    // Check for link[rel="canonical"] which might help with deduplication
    const canonical = doc.querySelector('link[rel="canonical"]');
    if (canonical) {
      results.metadata.canonicalUrl = canonical.href;
    }

  } catch (e) {
    console.warn('[Meta Tags] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Build a map of meta tag values for quick lookup
 * @param {NodeList} metaTags - Meta tag elements
 * @returns {Object} Map of meta values
 */
function buildMetaMap(metaTags) {
  const map = {
    byName: {},
    byProperty: {},
    byItemprop: {}
  };

  for (const meta of metaTags) {
    const content = meta.content || meta.getAttribute('content');
    if (!content) continue;

    const name = meta.name || meta.getAttribute('name');
    const property = meta.getAttribute('property');
    const itemprop = meta.getAttribute('itemprop');

    if (name) map.byName[name.toLowerCase()] = content;
    if (property) map.byProperty[property.toLowerCase()] = content;
    if (itemprop) map.byItemprop[itemprop.toLowerCase()] = content;
  }

  return map;
}

/**
 * Get meta value using mapping definition
 * @param {Object} metaMap - Meta value map
 * @param {Object} mapping - Mapping definition
 * @returns {string|null} Meta value
 */
function getMetaValue(metaMap, mapping) {
  if (mapping.name) {
    return metaMap.byName[mapping.name.toLowerCase()] || null;
  }
  if (mapping.property) {
    return metaMap.byProperty[mapping.property.toLowerCase()] || null;
  }
  if (mapping.itemprop) {
    return metaMap.byItemprop[mapping.itemprop.toLowerCase()] || null;
  }
  return null;
}

/**
 * Get CSS selector for a mapping
 * @param {Object} mapping - Mapping definition
 * @returns {string} CSS selector
 */
function getMetaSelector(mapping) {
  if (mapping.name) return `meta[name="${mapping.name}"]`;
  if (mapping.property) return `meta[property="${mapping.property}"]`;
  if (mapping.itemprop) return `meta[itemprop="${mapping.itemprop}"]`;
  return 'meta';
}

/**
 * Check if value is valid for field
 * @param {string} value - Value to check
 * @param {string} field - Field name
 * @returns {boolean} True if valid
 */
function isValidValue(value, field) {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  // Field-specific length checks
  const maxLengths = {
    position: 200,
    company: 150,
    location: 200,
    salary: 100,
    jobDescription: 5000
  };

  if (trimmed.length > (maxLengths[field] || 500)) return false;

  // Check for common non-values
  const nonValues = [
    'undefined',
    'null',
    'none',
    'n/a',
    'na',
    '',
    'loading...'
  ];

  if (nonValues.includes(trimmed.toLowerCase())) return false;

  return true;
}

/**
 * Clean and normalize meta value
 * @param {string} value - Raw value
 * @param {string} field - Field name
 * @returns {string} Cleaned value
 */
function cleanMetaValue(value, field) {
  let cleaned = value.trim();

  // Remove common suffixes/prefixes for titles
  if (field === 'position') {
    // Remove "| Company Name" or "- Company Name" suffixes
    cleaned = cleaned.replace(/\s*[|–—-]\s*[^|–—-]+$/, '').trim();

    // Remove "Job: " or "Position: " prefixes
    cleaned = cleaned.replace(/^(job|position|role|opening):\s*/i, '').trim();
  }

  // Remove "at Company" for position (will be extracted separately)
  if (field === 'position') {
    cleaned = cleaned.replace(/\s+at\s+[A-Z][^,]+$/i, '').trim();
  }

  // Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned);

  return cleaned;
}

/**
 * Decode HTML entities in a string
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/'
  };

  return text.replace(/&[#\w]+;/g, match => entities[match] || match);
}

/**
 * Extract from data-* attributes on html/body
 * @param {Document} doc - Document
 * @param {Object} results - Results to populate
 */
function extractDataAttributes(doc, results) {
  const elements = [doc.documentElement, doc.body];

  for (const el of elements) {
    if (!el) continue;

    // Common data attributes for job info
    const dataAttrs = {
      'data-job-title': 'position',
      'data-company': 'company',
      'data-company-name': 'company',
      'data-location': 'location',
      'data-job-location': 'location',
      'data-salary': 'salary'
    };

    for (const [attr, field] of Object.entries(dataAttrs)) {
      const value = el.getAttribute(attr);
      if (value && isValidValue(value, field)) {
        results[field].push({
          value: cleanMetaValue(value, field),
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.9,
          selector: `[${attr}]`
        });
      }
    }
  }
}

/**
 * Check if the strategy is applicable
 * @param {Document} doc - Document to check
 * @returns {boolean} True if meta tags exist
 */
function isApplicable(doc = document) {
  return doc.querySelectorAll('meta[property^="og:"], meta[name="description"]').length > 0;
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  META_MAPPINGS,
  cleanMetaValue,
  decodeHtmlEntities
};
