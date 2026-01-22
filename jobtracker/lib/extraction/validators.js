/**
 * Content Validation Module
 * Filters garbage values and validates extracted content
 */

// Garbage patterns for job titles (things that are NOT job titles)
const GARBAGE_POSITION_PATTERNS = [
  // Action buttons/links
  /^(apply|submit|login|sign\s*(in|up)|register|continue|next|back|cancel|close|save|share)$/i,
  /^(view|see)\s+(all|more|details)/i,
  /^(learn|read)\s+more$/i,
  /^click\s+here$/i,

  // Navigation elements
  /^(home|about|contact|careers?|jobs?|search|menu|nav|header|footer)$/i,
  /^(skip|jump)\s+to/i,

  // Generic placeholders
  /^(loading|please\s+wait|error|untitled|n\/a|none|tbd|tba)$/i,
  /^\[.*\]$/,  // [placeholder]
  /^(job|position|role|title)$/i,  // Just the word itself

  // Too short or just symbols
  /^.{1,2}$/,  // 1-2 characters
  /^[\s\-–—_.,:;!?@#$%^&*()+=]+$/,  // Only punctuation

  // Numbers only
  /^\d+$/,

  // URLs and emails
  /^(https?:\/\/|www\.|mailto:)/i,
  /@.*\.(com|org|net|io)/i,

  // Cookie/privacy notices
  /cookie|privacy|gdpr|consent/i,

  // Common website boilerplate
  /^(copyright|all\s+rights|terms|conditions)$/i,
  /\d{4}\s*[-–]\s*\d{4}/,  // Year ranges like "2020 - 2024"
];

// Garbage patterns for company names
const GARBAGE_COMPANY_PATTERNS = [
  // Generic words that aren't company names
  /^(company|employer|organization|business|firm|hiring|recruiter)$/i,
  /^(apply|submit|login|home|careers?|jobs?)$/i,

  // Placeholders
  /^(n\/a|none|unknown|confidential|anonymous|stealth)$/i,
  /^(loading|error|untitled)$/i,

  // Too short
  /^.{1}$/,

  // Only punctuation/numbers
  /^[\s\-–—_.,:;!?@#$%^&*()+=\d]+$/,

  // URLs
  /^(https?:\/\/|www\.)/i,

  // Common boilerplate
  /^(copyright|all\s+rights)/i,
];

// Garbage patterns for locations
const GARBAGE_LOCATION_PATTERNS = [
  /^(n\/a|none|unknown|remote\s+only|anywhere)$/i,
  /^(loading|error)$/i,
  /^.{1}$/,
  /^[\s\-–—_.,:;!?@#$%^&*()+=]+$/,
  /^(https?:\/\/|www\.)/i,
];

// Garbage prefixes commonly found at the start of job descriptions
const GARBAGE_DESCRIPTION_PREFIXES = [
  /^🍪?\s*(privacy\s+notice|cookie\s+(policy|notice|consent))[^\n]*\n?/i,
  /^(this\s+(website|site)\s+uses\s+cookies)[^\n]*\n?/i,
  /^(by\s+using\s+(this\s+)?(site|website),?\s+you\s+(agree|consent))[^\n]*\n?/i,
  /^(we\s+use\s+cookies)[^\n]*\n?/i,
  /^(accept\s+(all\s+)?cookies)[^\n]*\n?/i,
  /^(manage\s+cookie\s+preferences)[^\n]*\n?/i,
  /^(cookie\s+settings)[^\n]*\n?/i,
];

// Min/max length constraints per field
const LENGTH_CONSTRAINTS = {
  position: { min: 3, max: 200 },
  company: { min: 2, max: 150 },
  location: { min: 2, max: 200 },
  salary: { min: 3, max: 100 },
  jobDescription: { min: 50, max: 50000 }
};

/**
 * Validate a position/job title
 * @param {string} value - The value to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
function validatePosition(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'empty' };
  }

  const trimmed = value.trim();
  const constraints = LENGTH_CONSTRAINTS.position;

  // Length checks
  if (trimmed.length < constraints.min) {
    return { valid: false, reason: 'too_short' };
  }
  if (trimmed.length > constraints.max) {
    return { valid: false, reason: 'too_long' };
  }

  // Garbage pattern check
  for (const pattern of GARBAGE_POSITION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'garbage_pattern' };
    }
  }

  // Check for excessive repetition
  if (hasExcessiveRepetition(trimmed)) {
    return { valid: false, reason: 'repetition' };
  }

  // Check for HTML/script content
  if (containsHTML(trimmed)) {
    return { valid: false, reason: 'html_content' };
  }

  return { valid: true };
}

/**
 * Validate a company name
 * @param {string} value - The value to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateCompany(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'empty' };
  }

  const trimmed = value.trim();
  const constraints = LENGTH_CONSTRAINTS.company;

  // Length checks
  if (trimmed.length < constraints.min) {
    return { valid: false, reason: 'too_short' };
  }
  if (trimmed.length > constraints.max) {
    return { valid: false, reason: 'too_long' };
  }

  // Garbage pattern check
  for (const pattern of GARBAGE_COMPANY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'garbage_pattern' };
    }
  }

  // Check for excessive repetition
  if (hasExcessiveRepetition(trimmed)) {
    return { valid: false, reason: 'repetition' };
  }

  // Check for HTML/script content
  if (containsHTML(trimmed)) {
    return { valid: false, reason: 'html_content' };
  }

  return { valid: true };
}

/**
 * Validate a location
 * @param {string} value - The value to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateLocation(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'empty' };
  }

  const trimmed = value.trim();
  const constraints = LENGTH_CONSTRAINTS.location;

  // Length checks
  if (trimmed.length < constraints.min) {
    return { valid: false, reason: 'too_short' };
  }
  if (trimmed.length > constraints.max) {
    return { valid: false, reason: 'too_long' };
  }

  // Garbage pattern check
  for (const pattern of GARBAGE_LOCATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'garbage_pattern' };
    }
  }

  // Check for HTML/script content
  if (containsHTML(trimmed)) {
    return { valid: false, reason: 'html_content' };
  }

  return { valid: true };
}

/**
 * Validate salary information
 * @param {string} value - The value to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateSalary(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'empty' };
  }

  const trimmed = value.trim();
  const constraints = LENGTH_CONSTRAINTS.salary;

  // Length checks
  if (trimmed.length < constraints.min) {
    return { valid: false, reason: 'too_short' };
  }
  if (trimmed.length > constraints.max) {
    return { valid: false, reason: 'too_long' };
  }

  // Should contain currency symbol or number
  if (!/[$£€¥₹\d]/.test(trimmed)) {
    return { valid: false, reason: 'no_currency_or_number' };
  }

  return { valid: true };
}

/**
 * Clean job description by removing cookie/privacy notice prefixes
 * @param {string} value - The raw job description
 * @returns {string} Cleaned job description
 */
function cleanJobDescription(value) {
  if (!value) return '';
  let cleaned = value;

  // Strip common cookie/privacy prefixes (may need multiple passes)
  let prevLength;
  do {
    prevLength = cleaned.length;
    for (const pattern of GARBAGE_DESCRIPTION_PREFIXES) {
      cleaned = cleaned.replace(pattern, '');
    }
    // Remove leading/trailing navigation elements
    cleaned = cleaned
      .replace(/^(home|menu|navigation|breadcrumb)[^\n]*\n/gi, '')
      .replace(/^[\s\n]+/, '')
      .trim();
  } while (cleaned.length < prevLength && cleaned.length > 0);

  return cleaned;
}

/**
 * Validate job description
 * @param {string} value - The value to validate
 * @returns {{ valid: boolean, reason?: string, cleaned?: string }}
 */
function validateJobDescription(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'empty' };
  }

  // Clean the description before validation
  const cleaned = cleanJobDescription(value.trim());
  const constraints = LENGTH_CONSTRAINTS.jobDescription;

  if (cleaned.length < constraints.min) {
    return { valid: false, reason: 'too_short' };
  }
  if (cleaned.length > constraints.max) {
    return { valid: false, reason: 'too_long' };
  }

  return { valid: true, cleaned };
}

/**
 * Check for excessive character repetition
 * @param {string} value - String to check
 * @returns {boolean} True if excessive repetition detected
 */
function hasExcessiveRepetition(value) {
  // Check for same character repeated more than 4 times
  if (/(.)\1{4,}/.test(value)) {
    return true;
  }

  // Check for same word repeated
  const words = value.toLowerCase().split(/\s+/);
  if (words.length > 3) {
    const wordCounts = {};
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
      if (wordCounts[word] > 3) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if string contains HTML or script content
 * @param {string} value - String to check
 * @returns {boolean} True if HTML detected
 */
function containsHTML(value) {
  return /<[^>]+>|<script|<style|javascript:|onclick|onerror/i.test(value);
}

/**
 * Clean and normalize extracted text
 * @param {string} value - Raw extracted text
 * @returns {string} Cleaned text
 */
function cleanText(value) {
  if (!value || typeof value !== 'string') return '';

  return value
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim
    .trim();
}

/**
 * Sanitize text to prevent XSS
 * @param {string} value - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(value) {
  if (!value || typeof value !== 'string') return '';

  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validate a candidate extraction
 * @param {Object} candidate - { value, source, field }
 * @returns {{ valid: boolean, reason?: string, cleaned?: string }}
 */
function validateCandidate(candidate) {
  if (!candidate || !candidate.value) {
    return { valid: false, reason: 'empty' };
  }

  const cleaned = cleanText(candidate.value);
  const field = candidate.field || 'unknown';

  let validation;
  switch (field) {
    case 'position':
      validation = validatePosition(cleaned);
      break;
    case 'company':
      validation = validateCompany(cleaned);
      break;
    case 'location':
      validation = validateLocation(cleaned);
      break;
    case 'salary':
      validation = validateSalary(cleaned);
      break;
    case 'jobDescription':
      validation = validateJobDescription(cleaned);
      break;
    default:
      validation = { valid: cleaned.length > 0 };
  }

  return {
    ...validation,
    // Use validation's cleaned value if available (e.g., from validateJobDescription)
    cleaned: validation.valid ? (validation.cleaned || cleaned) : undefined
  };
}

/**
 * Filter and validate an array of candidates
 * @param {Array} candidates - Array of extraction candidates
 * @param {string} field - Field name
 * @returns {Array} Valid candidates with cleaned values
 */
function filterValidCandidates(candidates, field) {
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map(c => {
      const validation = validateCandidate({ ...c, field });
      if (validation.valid) {
        return {
          ...c,
          value: validation.cleaned,
          validationPassed: true
        };
      }
      return null;
    })
    .filter(Boolean);
}

export {
  validatePosition,
  validateCompany,
  validateLocation,
  validateSalary,
  validateJobDescription,
  validateCandidate,
  filterValidCandidates,
  cleanText,
  cleanJobDescription,
  sanitizeText,
  containsHTML,
  hasExcessiveRepetition,
  LENGTH_CONSTRAINTS,
  GARBAGE_POSITION_PATTERNS,
  GARBAGE_COMPANY_PATTERNS,
  GARBAGE_DESCRIPTION_PREFIXES
};
