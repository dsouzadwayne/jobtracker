/**
 * App Data Extraction Strategy
 * Extracts job information from window.__appData (Ashby-like ATS systems)
 * Confidence: 0.95
 */

const SOURCE_NAME = 'app-data';
const BASE_CONFIDENCE = 0.95;

/**
 * Extract job data from __appData global variable
 * @param {Window} win - The window object to extract from
 * @returns {Object} Extraction results with candidates per field
 */
function extract(win = window) {
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
    // Check for __appData (Ashby-style)
    if (win.__appData) {
      extractFromAppData(win.__appData, results);
    }

    // Check for other common global variables
    const globalVars = [
      '__INITIAL_STATE__',
      '__PRELOADED_STATE__',
      '__NEXT_DATA__',
      '__NUXT__',
      'pageData',
      'jobData',
      '__JOB_DATA__'
    ];

    for (const varName of globalVars) {
      if (win[varName]) {
        extractFromGlobalData(win[varName], varName, results);
      }
    }

    // Check for Next.js __NEXT_DATA__ in script tag
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript.textContent);
        extractFromGlobalData(nextData, '__NEXT_DATA__', results);
      } catch (e) {
        console.debug('[AppData] Failed to parse __NEXT_DATA__ script');
      }
    }

  } catch (e) {
    console.warn('[AppData] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Extract from Ashby-style __appData
 * @param {Object} appData - The __appData object
 * @param {Object} results - Results object to populate
 */
function extractFromAppData(appData, results) {
  // Ashby structure: { posting: { title, ... }, organization: { name, ... } }
  const posting = appData.posting || appData.job || appData.jobPosting;

  if (posting) {
    // Position
    if (posting.title) {
      results.position.push({
        value: posting.title,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE,
        selector: 'window.__appData.posting.title'
      });
    }

    // Company - try multiple paths
    const companyName =
      appData.organization?.name ||
      appData.company?.name ||
      posting.companyName ||
      posting.hiringOrganization?.name ||
      posting.linkedData?.hiringOrganization?.name;

    if (companyName) {
      results.company.push({
        value: companyName,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE,
        selector: 'window.__appData.organization.name'
      });
    }

    // Location - multiple possible paths
    const location = extractLocationFromPosting(posting) ||
                    appData.location?.name ||
                    appData.location?.city;

    if (location) {
      results.location.push({
        value: location,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.9,
        selector: 'window.__appData.posting.location'
      });
    }

    // Salary
    const salary = posting.salary || posting.compensation || posting.salaryRange;
    if (salary) {
      const salaryStr = typeof salary === 'string' ? salary : formatSalaryObject(salary);
      if (salaryStr) {
        results.salary.push({
          value: salaryStr,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.9,
          selector: 'window.__appData.posting.salary'
        });
      }
    }

    // Job Description
    const description =
      posting.descriptionPlainText ||
      posting.description ||
      posting.jobDescription;

    if (description) {
      results.jobDescription.push({
        value: stripHtml(description),
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE,
        selector: 'window.__appData.posting.description'
      });
    }
  }
}

/**
 * Extract from generic global data structures
 * @param {Object} data - The global data object
 * @param {string} varName - Name of the global variable
 * @param {Object} results - Results object to populate
 */
function extractFromGlobalData(data, varName, results) {
  if (!data || typeof data !== 'object') return;

  // Search for job-related data in the structure
  const jobData = findJobData(data);

  if (jobData) {
    const selector = `window.${varName}`;

    // Position
    const position = jobData.title || jobData.jobTitle || jobData.position || jobData.name;
    if (position && typeof position === 'string') {
      results.position.push({
        value: position,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.85, // Lower confidence for generic extraction
        selector
      });
    }

    // Company
    const company =
      jobData.company || jobData.companyName || jobData.employer ||
      jobData.hiringOrganization?.name || jobData.organization?.name;
    if (company && typeof company === 'string') {
      results.company.push({
        value: company,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.85,
        selector
      });
    }

    // Location
    const location =
      jobData.location || jobData.jobLocation || jobData.city ||
      (jobData.locations && jobData.locations[0]);
    if (location) {
      const locStr = typeof location === 'string' ? location : extractLocationString(location);
      if (locStr) {
        results.location.push({
          value: locStr,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.8,
          selector
        });
      }
    }
  }
}

/**
 * Recursively search for job-related data in an object
 * @param {Object} obj - Object to search
 * @param {number} depth - Current recursion depth
 * @returns {Object|null} Job data object if found
 */
function findJobData(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;

  // Check if this object looks like job data
  const jobIndicators = ['title', 'jobTitle', 'position', 'company', 'companyName', 'hiringOrganization'];
  const hasJobIndicator = jobIndicators.some(key => obj[key]);

  if (hasJobIndicator) {
    return obj;
  }

  // Check common nested paths
  const nestedPaths = [
    'props', 'pageProps', 'data', 'job', 'posting', 'jobPosting',
    'initialData', 'content', 'result', 'payload'
  ];

  for (const path of nestedPaths) {
    if (obj[path]) {
      const found = findJobData(obj[path], depth + 1);
      if (found) return found;
    }
  }

  // Check arrays
  if (Array.isArray(obj) && obj.length > 0) {
    for (const item of obj.slice(0, 5)) { // Limit array search
      const found = findJobData(item, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract location from posting object
 * @param {Object} posting - Job posting object
 * @returns {string|null} Location string
 */
function extractLocationFromPosting(posting) {
  // Try different location fields
  if (posting.locationName) return posting.locationName;

  if (posting.address) {
    const addr = posting.address.postalAddress || posting.address;
    const parts = [
      addr.addressLocality,
      addr.addressRegion,
      addr.addressCountry
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }

  if (posting.location) {
    if (typeof posting.location === 'string') return posting.location;
    return extractLocationString(posting.location);
  }

  return null;
}

/**
 * Extract location string from location object
 * @param {Object} loc - Location object
 * @returns {string|null} Location string
 */
function extractLocationString(loc) {
  if (!loc) return null;
  if (typeof loc === 'string') return loc;

  const parts = [
    loc.city,
    loc.state || loc.region,
    loc.country
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : loc.name || null;
}

/**
 * Format salary object to string
 * @param {Object} salary - Salary object
 * @returns {string|null} Formatted salary string
 */
function formatSalaryObject(salary) {
  if (!salary) return null;

  const currency = salary.currency || '$';
  const min = salary.min || salary.minimum || salary.minValue;
  const max = salary.max || salary.maximum || salary.maxValue;

  if (min && max) {
    return `${currency}${formatNumber(min)} - ${currency}${formatNumber(max)}`;
  }
  if (min) return `${currency}${formatNumber(min)}+`;
  if (max) return `Up to ${currency}${formatNumber(max)}`;

  return null;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString('en-US');
}

/**
 * Strip HTML tags
 */
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if the strategy is applicable
 * @param {Window} win - Window to check
 * @returns {boolean} True if app data exists
 */
function isApplicable(win = window) {
  return !!(
    win.__appData ||
    win.__INITIAL_STATE__ ||
    win.__PRELOADED_STATE__ ||
    win.__NEXT_DATA__ ||
    win.__NUXT__ ||
    document.getElementById('__NEXT_DATA__')
  );
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  extractFromAppData,
  findJobData
};
