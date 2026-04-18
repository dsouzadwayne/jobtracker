/**
 * JobTracker Autofill Configuration
 * Single source of truth for all configurable values
 * Centralizes thresholds, weights, and scoring parameters
 */

const JobTrackerConfig = {
  /**
   * Certainty levels for multi-stage matching
   * Higher values indicate more reliable matches
   */
  CERTAINTY: {
    EXACT_ATTRIBUTE: 1.0,      // Direct attribute match (data-automation-id, autocomplete)
    CUSTOM_RULE: 0.95,         // User-defined custom regex rule
    INPUT_TYPE: 0.9,           // Input type match (email, tel)
    DIRECT_PATTERN: 0.7,       // Pattern matches name/id directly
    LABEL_MATCH: 0.5,          // Pattern matches label text
    PARENT_LABEL: 0.3,         // Pattern matches parent container label
    PLACEHOLDER: 0.25,         // Pattern matches placeholder
    POSITION_FALLBACK: 0.15    // Position-based fallback
  },

  /**
   * Minimum confidence thresholds for various matchers
   */
  THRESHOLDS: {
    MIN_ENHANCED_DETECTION: 0.60,  // Minimum confidence for enhanced detection
    MIN_SMART_MATCHER: 0.30,       // Minimum confidence for smart field matcher
    MIN_NLP_SEMANTIC: 0.75,        // Minimum for NLP semantic mapping
    MIN_NLP_QUESTION: 0.70,        // Minimum for NLP question extraction
    MIN_NLP_KEYWORD: 0.55,         // Minimum for NLP keyword fallback
    MAX_CONFIDENCE_CAP: 0.95       // Maximum confidence cap (allows exact attributes to override)
  },

  /**
   * Signal weights for multi-signal scoring (SmartFieldMatcher)
   */
  SIGNAL_WEIGHTS: {
    autocomplete: 30,        // Autocomplete is most reliable
    id: 25,                  // Exact ID match is very strong
    formcontrolname: 22,     // Angular formControlName is very reliable
    name: 20,                // Name attribute is strong
    label: 20,               // Label text is important
    ariaLabel: 18,           // Accessibility labels
    dataTest: 18,            // data-test attributes are reliable
    placeholder: 15,         // Placeholder gives hints
    contextBonus: 10,        // Bonus for being in relevant section
    typeMatch: 8,            // Input type matches expected
    negativePenalty: -40     // Penalty for matching negative patterns
  },

  /**
   * Source weights for enhanced detection signal aggregation
   */
  SOURCE_WEIGHTS: {
    'json-ld': 1.2,              // JSON-LD structured data (highest)
    'semantic-mapping': 1.0,      // NLP semantic mapping
    'question-extraction': 1.0,   // NLP question extraction
    'keyword-fallback': 1.0,      // NLP keyword fallback
    'section-context': 0.6        // Readability section context
  },

  /**
   * Confidence ranges by detection source
   * Used for scoring and aggregation
   */
  CONFIDENCE_RANGES: {
    'json-ld': { min: 0.80, max: 0.90 },
    'semantic-mapping': { min: 0.75, max: 0.85 },
    'question-extraction': { min: 0.70, max: 0.80 },
    'section-context': { min: 0.50, max: 0.60 },
    'keyword-fallback': { min: 0.55, max: 0.65 }
  },

  /**
   * Attribute priority for identification (modern frameworks first)
   */
  ATTRIBUTE_PRIORITY: [
    'data-automation-id',
    'data-testid',
    'data-field',
    'name',
    'id',
    'autocomplete'
  ],

  /**
   * Patterns for detecting confirmation fields
   */
  CONFIRM_PATTERNS: [
    /confirm/i,
    /re-?enter/i,
    /re-?type/i,
    /repeat/i,
    /secondary/i,
    /verify/i,
    /validation/i
  ],

  /**
   * Field types that can have confirmation fields
   */
  CONFIRMABLE_FIELD_TYPES: ['email', 'phone', 'password'],

  /**
   * Timing configuration for autofill operations
   */
  TIMING: {
    FIELD_FILL_DELAY: 50,      // Delay between field fills (ms)
    INIT_RETRY_DELAY: 100,     // Delay before retrying initialization
    CACHE_EXPIRY: 300000       // Cache expiry time (5 minutes)
  },

  /**
   * Get a configuration value with fallback
   * @param {string} path - Dot-notation path (e.g., 'CERTAINTY.EXACT_ATTRIBUTE')
   * @param {*} fallback - Fallback value if not found
   * @returns {*} Configuration value or fallback
   */
  get(path, fallback = null) {
    const parts = path.split('.');
    let value = this;
    for (const part of parts) {
      if (value === null || value === undefined || !(part in value)) {
        return fallback;
      }
      value = value[part];
    }
    return value;
  },

  /**
   * Get user overrides from storage (if available)
   * @returns {Promise<Object>} User overrides
   */
  async getUserOverrides() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get('autofillConfig');
        return result.autofillConfig || {};
      } catch (e) {
        return {};
      }
    }
    return {};
  },

  /**
   * Apply user overrides to configuration
   * @param {Object} overrides - User configuration overrides
   */
  applyOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object') return;

    // Allow overriding thresholds
    if (overrides.THRESHOLDS) {
      Object.assign(this.THRESHOLDS, overrides.THRESHOLDS);
    }

    // Allow overriding timing
    if (overrides.TIMING) {
      Object.assign(this.TIMING, overrides.TIMING);
    }
  }
};

// Freeze configuration to prevent accidental modification
// (Users should use applyOverrides for customization)
Object.freeze(JobTrackerConfig.CERTAINTY);
Object.freeze(JobTrackerConfig.SIGNAL_WEIGHTS);
Object.freeze(JobTrackerConfig.SOURCE_WEIGHTS);
Object.freeze(JobTrackerConfig.ATTRIBUTE_PRIORITY);
Object.freeze(JobTrackerConfig.THRESHOLDS);
Object.freeze(JobTrackerConfig.TIMING);
Object.freeze(JobTrackerConfig.CONFIDENCE_RANGES);

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerConfig = JobTrackerConfig;

  // Register with namespace if available (may not be if loaded first)
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('config');
  }
}
