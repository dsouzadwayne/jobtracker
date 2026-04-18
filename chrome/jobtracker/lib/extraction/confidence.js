/**
 * Confidence Scoring Module
 * Calculates confidence scores for extracted job data
 */

// Source reliability weights - higher means more trustworthy
const SOURCE_WEIGHTS = {
  'json-ld': 1.0,          // Structured data, most reliable
  'app-data': 0.95,        // __appData (Ashby-like ATS)
  'aria-labels': 0.85,     // ARIA accessibility labels
  'meta-tags': 0.80,       // Open Graph / meta tags
  'css-selectors': 0.70,   // Heuristic CSS selectors
  'proximity': 0.55,       // Proximity-based detection
  'title-parse': 0.50,     // Document title parsing
  'readability': 0.45,     // Readability.js extraction
  'ml-ner': 0.70,          // ML NER extraction
  'regex': 0.40,           // Basic regex patterns
  'llm': 0.90              // LLM extraction (high quality but expensive)
};

// Field-specific quality multipliers
const FIELD_QUALITY_FACTORS = {
  position: {
    minLength: 3,
    maxLength: 150,
    goodLength: { min: 5, max: 80 },
    penalizeAllCaps: true,
    penalizeAllLower: true,
    penalizeNumbers: false,
    expectedPattern: /^[A-Z][a-zA-Z0-9\s\-\/&,.()+]+$/
  },
  company: {
    minLength: 2,
    maxLength: 100,
    goodLength: { min: 2, max: 50 },
    penalizeAllCaps: false,  // Some companies use all caps
    penalizeAllLower: true,
    penalizeNumbers: false,
    expectedPattern: /^[A-Z0-9][a-zA-Z0-9\s\-&.,()]+$/
  },
  location: {
    minLength: 2,
    maxLength: 150,
    goodLength: { min: 3, max: 80 },
    penalizeAllCaps: true,
    penalizeAllLower: true,
    penalizeNumbers: false,
    expectedPattern: null
  },
  salary: {
    minLength: 3,
    maxLength: 100,
    goodLength: { min: 5, max: 50 },
    penalizeAllCaps: false,
    penalizeAllLower: false,
    penalizeNumbers: false,
    expectedPattern: /[$£€]\s*[\d,]+|[\d,]+\s*(k|K|per|annually)/
  }
};

/**
 * Calculate confidence score for a single extraction candidate
 * @param {Object} candidate - { value, source, selector?, metadata? }
 * @param {string} field - Field name (position, company, location, salary)
 * @returns {number} Confidence score between 0 and 1
 */
function calculateFieldConfidence(candidate, field) {
  if (!candidate || !candidate.value) return 0;

  const value = candidate.value.trim();
  const source = candidate.source || 'unknown';
  const factors = FIELD_QUALITY_FACTORS[field] || {};

  // Start with source weight
  let confidence = SOURCE_WEIGHTS[source] || 0.3;

  // Length checks
  if (value.length < (factors.minLength || 1)) {
    return 0; // Too short, invalid
  }
  if (value.length > (factors.maxLength || 500)) {
    confidence *= 0.3; // Too long, likely garbage
  }

  // Good length bonus
  if (factors.goodLength) {
    if (value.length >= factors.goodLength.min && value.length <= factors.goodLength.max) {
      confidence *= 1.1;
    }
  }

  // Capitalization penalties
  if (factors.penalizeAllCaps && value === value.toUpperCase() && value.length > 3) {
    confidence *= 0.7;
  }
  if (factors.penalizeAllLower && value === value.toLowerCase() && value.length > 3) {
    confidence *= 0.8;
  }

  // Pattern match bonus
  if (factors.expectedPattern && factors.expectedPattern.test(value)) {
    confidence *= 1.15;
  }

  // Special character penalties
  const specialCharRatio = (value.match(/[^a-zA-Z0-9\s\-&.,()\/+$£€]/g) || []).length / value.length;
  if (specialCharRatio > 0.2) {
    confidence *= 0.6;
  }

  // HTML/script detection - strong penalty
  if (/<[^>]+>|javascript:|onclick/i.test(value)) {
    return 0;
  }

  // Cap at 1.0
  return Math.min(1.0, confidence);
}

/**
 * Calculate cross-validation boost when multiple strategies agree
 * @param {Array} candidates - Array of candidates for the same field
 * @returns {number} Boost multiplier (1.0 = no boost, up to 1.3)
 */
function calculateCrossValidationBoost(candidates) {
  if (!candidates || candidates.length < 2) return 1.0;

  // Normalize values for comparison
  const normalize = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');

  const normalizedValues = candidates.map(c => normalize(c.value));
  const uniqueValues = [...new Set(normalizedValues)];

  if (uniqueValues.length === 1) {
    // All strategies agree - significant boost
    return 1.0 + Math.min(0.3, candidates.length * 0.1);
  }

  // Check for partial agreement (similar values)
  const agreementGroups = [];
  for (const value of normalizedValues) {
    let foundGroup = false;
    for (const group of agreementGroups) {
      if (areSimilar(value, group[0])) {
        group.push(value);
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      agreementGroups.push([value]);
    }
  }

  // Boost based on largest agreement group
  const largestGroup = Math.max(...agreementGroups.map(g => g.length));
  if (largestGroup >= 2) {
    return 1.0 + Math.min(0.2, (largestGroup - 1) * 0.08);
  }

  return 1.0;
}

/**
 * Check if two strings are similar (fuzzy match)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if similar
 */
function areSimilar(a, b) {
  if (a === b) return true;

  // One contains the other
  if (a.includes(b) || b.includes(a)) return true;

  // Levenshtein distance for short strings
  if (a.length < 30 && b.length < 30) {
    const distance = levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    return distance / maxLen < 0.3;
  }

  return false;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Select the best candidate from multiple extractions
 * @param {Array} candidates - Array of { value, confidence, source, ... }
 * @param {string} field - Field name
 * @returns {Object|null} Best candidate with final confidence
 */
function selectBestCandidate(candidates, field) {
  if (!candidates || candidates.length === 0) return null;

  // Calculate confidence for each candidate
  const scoredCandidates = candidates
    .filter(c => c && c.value)
    .map(c => ({
      ...c,
      confidence: c.confidence || calculateFieldConfidence(c, field)
    }))
    .filter(c => c.confidence > 0);

  if (scoredCandidates.length === 0) return null;

  // Apply cross-validation boost
  const boost = calculateCrossValidationBoost(scoredCandidates);

  // Sort by confidence (highest first)
  scoredCandidates.sort((a, b) => b.confidence - a.confidence);

  const best = scoredCandidates[0];
  return {
    ...best,
    confidence: Math.min(1.0, best.confidence * boost),
    alternates: scoredCandidates.slice(1, 3) // Keep top 2 alternates
  };
}

/**
 * Calculate overall extraction confidence from all fields
 * @param {Object} result - { position, company, location, salary, ... }
 * @returns {number} Overall confidence (0-1)
 */
function calculateOverallConfidence(result) {
  const weights = {
    position: 0.35,
    company: 0.35,
    location: 0.15,
    salary: 0.15
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [field, weight] of Object.entries(weights)) {
    if (result[field] && result[field].confidence > 0) {
      weightedSum += result[field].confidence * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;

  // Penalty if key fields are missing
  if (!result.position?.value || !result.company?.value) {
    return (weightedSum / totalWeight) * 0.7;
  }

  return weightedSum / totalWeight;
}

/**
 * Get human-readable confidence level
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Level description
 */
function getConfidenceLevel(confidence) {
  if (confidence >= 0.9) return 'very-high';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.6) return 'medium';
  if (confidence >= 0.4) return 'low';
  return 'very-low';
}

export {
  SOURCE_WEIGHTS,
  calculateFieldConfidence,
  calculateCrossValidationBoost,
  selectBestCandidate,
  calculateOverallConfidence,
  getConfidenceLevel,
  areSimilar,
  levenshteinDistance
};
