/**
 * JSON-LD Extraction Strategy
 * Extracts job information from structured data (schema.org JobPosting)
 * Confidence: 1.0 (most reliable source)
 */

const SOURCE_NAME = 'json-ld';
const BASE_CONFIDENCE = 1.0;

/**
 * Extract job data from JSON-LD scripts
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
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const jobPostings = findJobPostings(data);

        for (const job of jobPostings) {
          // Position/Title
          if (job.title) {
            results.position.push({
              value: job.title,
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE,
              selector: 'script[type="application/ld+json"]'
            });
          }

          // Company
          const companyName = extractCompanyName(job);
          if (companyName) {
            results.company.push({
              value: companyName,
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE,
              selector: 'script[type="application/ld+json"]'
            });
          }

          // Location
          const location = extractLocation(job);
          if (location) {
            results.location.push({
              value: location,
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE,
              selector: 'script[type="application/ld+json"]'
            });
          }

          // Salary
          const salary = extractSalary(job);
          if (salary) {
            results.salary.push({
              value: salary,
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE * 0.95, // Slightly lower as format varies
              selector: 'script[type="application/ld+json"]'
            });
          }

          // Job Description
          if (job.description) {
            results.jobDescription.push({
              value: stripHtml(job.description),
              source: SOURCE_NAME,
              confidence: BASE_CONFIDENCE,
              selector: 'script[type="application/ld+json"]'
            });
          }
        }
      } catch (e) {
        // Individual script parsing failed, continue with others
        console.debug('[JSON-LD] Failed to parse script:', e.message);
      }
    }
  } catch (e) {
    console.warn('[JSON-LD] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Find all JobPosting objects in JSON-LD data
 * @param {*} data - Parsed JSON-LD data
 * @returns {Array} Array of JobPosting objects
 */
function findJobPostings(data) {
  const postings = [];

  if (!data) return postings;

  // Direct JobPosting
  if (data['@type'] === 'JobPosting') {
    postings.push(data);
    return postings;
  }

  // Array of items
  if (Array.isArray(data)) {
    for (const item of data) {
      postings.push(...findJobPostings(item));
    }
    return postings;
  }

  // @graph array
  if (data['@graph'] && Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      postings.push(...findJobPostings(item));
    }
  }

  return postings;
}

/**
 * Extract company name from JobPosting
 * @param {Object} job - JobPosting object
 * @returns {string|null} Company name
 */
function extractCompanyName(job) {
  // hiringOrganization can be object or string
  if (job.hiringOrganization) {
    if (typeof job.hiringOrganization === 'string') {
      return job.hiringOrganization;
    }
    if (job.hiringOrganization.name) {
      return job.hiringOrganization.name;
    }
  }
  return null;
}

/**
 * Extract location from JobPosting
 * @param {Object} job - JobPosting object
 * @returns {string|null} Location string
 */
function extractLocation(job) {
  const loc = job.jobLocation;
  if (!loc) return null;

  // String location
  if (typeof loc === 'string') return loc;

  // Array of locations
  if (Array.isArray(loc)) {
    const locations = loc
      .map(l => extractSingleLocation(l))
      .filter(Boolean);
    return locations.join(', ') || null;
  }

  return extractSingleLocation(loc);
}

/**
 * Extract a single location object
 * @param {Object} loc - Location object
 * @returns {string|null} Location string
 */
function extractSingleLocation(loc) {
  if (!loc) return null;
  if (typeof loc === 'string') return loc;

  // Place with address
  if (loc.address) {
    const addr = loc.address;
    if (typeof addr === 'string') return addr;

    const parts = [
      addr.streetAddress,
      addr.addressLocality,
      addr.addressRegion,
      addr.postalCode,
      addr.addressCountry
    ].filter(Boolean);

    return parts.join(', ') || null;
  }

  // Just name
  if (loc.name) return loc.name;

  return null;
}

/**
 * Extract salary information from JobPosting
 * @param {Object} job - JobPosting object
 * @returns {string|null} Salary string
 */
function extractSalary(job) {
  const salary = job.baseSalary || job.estimatedSalary;
  if (!salary) return null;

  // String salary
  if (typeof salary === 'string') return salary;

  // MonetaryAmount or QuantitativeValue
  const currency = salary.currency || 'USD';

  if (salary.value) {
    const value = salary.value;

    // Range
    if (typeof value === 'object') {
      if (value.minValue !== undefined && value.maxValue !== undefined) {
        return `${currency} ${formatNumber(value.minValue)} - ${formatNumber(value.maxValue)}${salary.unitText ? ' ' + salary.unitText : ''}`;
      }
      if (value.value !== undefined) {
        return `${currency} ${formatNumber(value.value)}${salary.unitText ? ' ' + salary.unitText : ''}`;
      }
    }

    // Direct value
    if (typeof value === 'number' || typeof value === 'string') {
      return `${currency} ${formatNumber(value)}${salary.unitText ? ' ' + salary.unitText : ''}`;
    }
  }

  // minValue/maxValue at top level
  if (salary.minValue !== undefined || salary.maxValue !== undefined) {
    if (salary.minValue !== undefined && salary.maxValue !== undefined) {
      return `${currency} ${formatNumber(salary.minValue)} - ${formatNumber(salary.maxValue)}`;
    }
    if (salary.minValue !== undefined) {
      return `${currency} ${formatNumber(salary.minValue)}+`;
    }
    if (salary.maxValue !== undefined) {
      return `Up to ${currency} ${formatNumber(salary.maxValue)}`;
    }
  }

  return null;
}

/**
 * Format number with commas
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString('en-US');
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  // Create a temporary element to extract text
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch (e) {
      // Fallback to regex
    }
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if the strategy is applicable to the current page
 * @param {Document} doc - Document to check
 * @returns {boolean} True if JSON-LD scripts exist
 */
function isApplicable(doc = document) {
  return doc.querySelectorAll('script[type="application/ld+json"]').length > 0;
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  findJobPostings,
  extractCompanyName,
  extractLocation,
  extractSalary
};
