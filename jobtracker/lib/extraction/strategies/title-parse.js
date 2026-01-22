/**
 * Title Parse Extraction Strategy
 * Extracts job information from document title
 * Confidence: 0.50
 */

const SOURCE_NAME = 'title-parse';
const BASE_CONFIDENCE = 0.50;

// Common title separators
const TITLE_SEPARATORS = [
  ' | ',
  ' - ',
  ' – ',  // en-dash
  ' — ',  // em-dash
  ' :: ',
  ' : ',
  ' at ',
  ' @ ',
  ' · ',  // middle dot
  ' / ',
  ' • '   // bullet
];

// Common suffixes to remove
const COMMON_SUFFIXES = [
  'careers',
  'jobs',
  'career',
  'job',
  'hiring',
  'work with us',
  'join us',
  'join our team',
  'we\'re hiring',
  'apply now',
  'job application',
  'employment',
  'vacancy',
  'openings',
  'opportunities',
  'linkedin',
  'glassdoor',
  'indeed',
  'monster',
  'ziprecruiter',
  'angellist',
  'wellfound'
];

// Patterns that indicate the title contains job info
const JOB_TITLE_INDICATORS = [
  /\b(engineer|developer|designer|manager|director|analyst|specialist|coordinator|lead|senior|junior|intern|consultant)\b/i,
  /\b(remote|hybrid|full[- ]?time|part[- ]?time|contract)\b/i,
  /\b(job|position|role|opening|opportunity|career)\b/i
];

/**
 * Extract job data from document title
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
      timing: 0,
      originalTitle: ''
    }
  };

  const startTime = performance.now();

  try {
    const title = doc.title?.trim() || '';
    results.metadata.originalTitle = title;

    if (!title || title.length < 3) {
      results.metadata.timing = performance.now() - startTime;
      return results;
    }

    // Check if title looks like it contains job info
    if (!hasJobIndicators(title)) {
      results.metadata.timing = performance.now() - startTime;
      return results;
    }

    // Parse the title
    const parsed = parseTitle(title);

    if (parsed.position) {
      results.position.push({
        value: parsed.position,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * parsed.positionConfidence,
        selector: 'document.title'
      });
    }

    if (parsed.company) {
      results.company.push({
        value: parsed.company,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * parsed.companyConfidence,
        selector: 'document.title'
      });
    }

    if (parsed.location) {
      results.location.push({
        value: parsed.location,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * parsed.locationConfidence,
        selector: 'document.title'
      });
    }

  } catch (e) {
    console.warn('[Title Parse] Extraction error:', e.message);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Check if title has job-related indicators
 * @param {string} title - Document title
 * @returns {boolean} True if title looks job-related
 */
function hasJobIndicators(title) {
  return JOB_TITLE_INDICATORS.some(p => p.test(title));
}

/**
 * Parse document title into components
 * @param {string} title - Document title
 * @returns {Object} Parsed components
 */
function parseTitle(title) {
  const result = {
    position: null,
    company: null,
    location: null,
    positionConfidence: 1.0,
    companyConfidence: 1.0,
    locationConfidence: 1.0
  };

  let cleanTitle = title;

  // Remove common suffixes
  for (const suffix of COMMON_SUFFIXES) {
    const suffixRegex = new RegExp(`\\s*[|\\-–—]\\s*${escapeRegex(suffix)}\\s*$`, 'i');
    cleanTitle = cleanTitle.replace(suffixRegex, '');
  }

  // Try "Position @ Company" format (Ashby, some startups)
  const atMatch = cleanTitle.match(/^(.+?)\s+@\s+(.+)$/);
  if (atMatch) {
    result.position = cleanPart(atMatch[1]);
    result.company = cleanPart(atMatch[2]);
    result.positionConfidence = 0.95;
    result.companyConfidence = 0.95;
    return result;
  }

  // Try "Position at Company" format
  const atWordMatch = cleanTitle.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atWordMatch) {
    const position = cleanPart(atWordMatch[1]);
    const company = cleanPart(atWordMatch[2]);

    // Make sure "at" wasn't part of something like "Data Scientist"
    if (looksLikePosition(position) && !looksLikePosition(company)) {
      result.position = position;
      result.company = company;
      result.positionConfidence = 0.90;
      result.companyConfidence = 0.90;
      return result;
    }
  }

  // Try separator-based parsing
  for (const sep of TITLE_SEPARATORS) {
    if (cleanTitle.includes(sep)) {
      const parts = cleanTitle.split(sep).map(p => cleanPart(p)).filter(Boolean);

      if (parts.length >= 2) {
        // Determine which part is position vs company
        const parsed = identifyParts(parts);
        if (parsed.position) {
          result.position = parsed.position;
          result.positionConfidence = 0.85;
        }
        if (parsed.company) {
          result.company = parsed.company;
          result.companyConfidence = 0.80;
        }
        if (parsed.location) {
          result.location = parsed.location;
          result.locationConfidence = 0.75;
        }
        if (result.position || result.company) {
          return result;
        }
      }
    }
  }

  // Fallback: if title looks like a position, use it
  if (looksLikePosition(cleanTitle) && cleanTitle.length < 100) {
    result.position = cleanTitle;
    result.positionConfidence = 0.60;
  }

  return result;
}

/**
 * Identify which parts of a split title are position, company, location
 * @param {Array} parts - Array of title parts
 * @returns {Object} Identified parts
 */
function identifyParts(parts) {
  const result = { position: null, company: null, location: null };

  if (parts.length === 0) return result;

  // Score each part
  const scored = parts.map((part, index) => ({
    part,
    index,
    positionScore: scoreAsPosition(part),
    companyScore: scoreAsCompany(part),
    locationScore: scoreAsLocation(part)
  }));

  // Find best position candidate (usually first part)
  const positionCandidate = scored.find(s => s.positionScore > 0.5 && s.index === 0) ||
                           scored.find(s => s.positionScore > 0.7);
  if (positionCandidate) {
    result.position = positionCandidate.part;
  }

  // Find best company candidate (usually second part)
  const companyCandidate = scored.find(s =>
    s.companyScore > 0.5 &&
    s.index !== positionCandidate?.index &&
    s.locationScore < 0.5
  );
  if (companyCandidate) {
    result.company = companyCandidate.part;
  }

  // Find location candidate
  const locationCandidate = scored.find(s =>
    s.locationScore > 0.5 &&
    s.index !== positionCandidate?.index &&
    s.index !== companyCandidate?.index
  );
  if (locationCandidate) {
    result.location = locationCandidate.part;
  }

  return result;
}

/**
 * Score how likely a string is a job position
 */
function scoreAsPosition(text) {
  if (!text || text.length < 3 || text.length > 100) return 0;

  let score = 0.3;  // Base score

  // Job title keywords
  const keywords = [
    /engineer/i, /developer/i, /designer/i, /manager/i, /director/i,
    /analyst/i, /specialist/i, /lead/i, /senior/i, /junior/i,
    /architect/i, /consultant/i, /coordinator/i, /administrator/i
  ];

  for (const kw of keywords) {
    if (kw.test(text)) score += 0.3;
  }

  // Level indicators
  if (/\b(I{1,3}|[1-3])\b/.test(text)) score += 0.1;  // I, II, III
  if (/\b(sr|jr)\b/i.test(text)) score += 0.1;

  // Negative: looks like company
  if (/\b(Inc|LLC|Ltd|Corp|Company|Co)\b/i.test(text)) score -= 0.5;
  // Negative: looks like location
  if (/,\s*[A-Z]{2}$/.test(text)) score -= 0.3;

  return Math.max(0, Math.min(1, score));
}

/**
 * Score how likely a string is a company name
 */
function scoreAsCompany(text) {
  if (!text || text.length < 2 || text.length > 100) return 0;

  let score = 0.3;  // Base score

  // Company suffixes
  if (/\b(Inc|LLC|Ltd|Corp|Company|Co|GmbH|SA|BV|PLC)\b/i.test(text)) score += 0.4;

  // Starts with capital
  if (/^[A-Z]/.test(text)) score += 0.1;

  // Single capitalized word (common for company names)
  if (/^[A-Z][a-z]+$/.test(text)) score += 0.2;

  // Negative: job title keywords
  const jobKeywords = [/engineer/i, /developer/i, /manager/i, /director/i, /analyst/i];
  for (const kw of jobKeywords) {
    if (kw.test(text)) score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Score how likely a string is a location
 */
function scoreAsLocation(text) {
  if (!text || text.length < 2 || text.length > 100) return 0;

  let score = 0.2;  // Base score

  // City, ST format
  if (/,\s*[A-Z]{2}$/.test(text)) score += 0.5;

  // Country names
  if (/\b(USA|UK|Canada|Germany|France|India|Australia|Singapore|Remote)\b/i.test(text)) score += 0.4;

  // Common cities
  if (/\b(New York|San Francisco|Los Angeles|London|Berlin|Paris|Tokyo|Sydney)\b/i.test(text)) score += 0.3;

  // Remote/Hybrid keywords
  if (/\b(remote|hybrid|on-?site)\b/i.test(text)) score += 0.4;

  return Math.max(0, Math.min(1, score));
}

/**
 * Check if text looks like a job position
 */
function looksLikePosition(text) {
  return scoreAsPosition(text) > 0.5;
}

/**
 * Clean a title part
 */
function cleanPart(part) {
  if (!part) return '';
  return part
    .replace(/^\s*[-–—|:·•\/]\s*/, '')
    .replace(/\s*[-–—|:·•\/]\s*$/, '')
    .trim();
}

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if the strategy is applicable
 */
function isApplicable(doc = document) {
  const title = doc.title?.trim() || '';
  return title.length > 5 && hasJobIndicators(title);
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  parseTitle,
  hasJobIndicators,
  scoreAsPosition,
  scoreAsCompany,
  scoreAsLocation
};
