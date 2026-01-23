/**
 * JobTracker Matching Strategies
 * Individual matching strategies for field identification
 * Each strategy returns a match object or null
 */

const JobTrackerMatchingStrategies = {
  /**
   * Get dependencies (loaded lazily to avoid circular dependencies)
   */
  _getPatterns() {
    return window.JobTrackerFieldPatterns;
  },

  _getLabelDetector() {
    return window.JobTrackerLabelDetector;
  },

  _getAutocompleteMap() {
    return window.JobTrackerAutocompleteMap;
  },

  _getEnhancedDetection() {
    return window.EnhancedDetection;
  },

  /**
   * Match by enhanced detection (JSON-LD + NLP + Readability)
   * Uses semantic analysis for improved field recognition on unsupported sites
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByEnhancedDetection(input, profile) {
    const enhancedDetection = this._getEnhancedDetection();
    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Check if enhanced detection is available
    if (!enhancedDetection || !enhancedDetection.isAvailable()) {
      return null;
    }

    // Ensure enhanced detection is initialized
    if (!enhancedDetection._initialized) {
      enhancedDetection.init().catch(() => {});
      return null; // Will work on next attempt after init
    }

    // Get label text
    const labelText = labelDetector ? labelDetector.getLabelText(input) : '';

    // Analyze field using enhanced detection
    const result = enhancedDetection.analyzeField(input, labelText);

    if (!result || !result.fieldType) {
      return null;
    }

    // Minimum confidence threshold (0.6)
    if (result.confidence < 0.60) {
      return null;
    }

    // Verify field type exists in patterns
    if (patterns?.FIELD_PATTERNS && !patterns.FIELD_PATTERNS[result.fieldType]) {
      return null;
    }

    return {
      fieldType: result.fieldType,
      certainty: result.confidence,
      source: `enhanced-${result.source}`,
      signals: result.signals
    };
  },

  /**
   * Match by exact attributes (data-automation-id, autocomplete, data-testid)
   * Highest certainty matching
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByExactAttribute(input, profile) {
    const patterns = this._getPatterns();
    const autocompleteMap = this._getAutocompleteMap();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS) return null;

    const autocomplete = input.getAttribute('autocomplete');
    const automationId = input.getAttribute('data-automation-id');
    const testId = input.getAttribute('data-testid');

    // Check autocomplete first using the autocomplete map
    if (autocomplete && autocompleteMap) {
      const fieldType = autocompleteMap.getFieldTypeFromAutocomplete(autocomplete);
      if (fieldType && patterns.FIELD_PATTERNS[fieldType]) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.EXACT_ATTRIBUTE,
          source: 'autocomplete'
        };
      }
    }

    // Check patterns
    for (const [fieldType, config] of Object.entries(patterns.FIELD_PATTERNS)) {
      // Check autocomplete attribute against pattern config
      if (autocomplete && config.autocomplete?.includes(autocomplete)) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.EXACT_ATTRIBUTE,
          source: 'autocomplete'
        };
      }

      // Check data-automation-id
      if (automationId && config.patterns.some(p => p.test(automationId))) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.EXACT_ATTRIBUTE,
          source: 'automation-id'
        };
      }

      // Check data-testid
      if (testId && config.patterns.some(p => p.test(testId))) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.EXACT_ATTRIBUTE,
          source: 'testid'
        };
      }
    }

    return null;
  },

  /**
   * Match by user-defined custom regex rules
   * High priority to allow users to override default behavior
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @param {Array} customRules - Array of custom rule objects
   * @returns {Object|null} Match object or null
   */
  matchByCustomRules(input, profile, customRules) {
    if (!customRules || !Array.isArray(customRules) || customRules.length === 0) {
      return null;
    }

    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Null check for required dependencies
    if (!patterns?.CERTAINTY_LEVELS || !labelDetector) return null;

    const identifiers = labelDetector.getFieldIdentifiers(input);

    for (const rule of customRules) {
      // Skip disabled or invalid rules
      if (!rule.enabled || !rule.pattern || !rule.profilePath) continue;

      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(identifiers)) {
          return {
            fieldType: rule.name || 'customRule',
            certainty: patterns.CERTAINTY_LEVELS.CUSTOM_RULE,
            profilePath: rule.profilePath,
            isCustomRule: true,
            source: 'custom-rule'
          };
        }
      } catch (e) {
        // Invalid regex pattern, skip this rule
        console.log('JobTracker: Invalid custom rule regex:', rule.pattern, e);
      }
    }

    return null;
  },

  /**
   * Match by input type (email, tel)
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByInputType(input, profile) {
    const patterns = this._getPatterns();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS) return null;

    const inputType = input.type?.toLowerCase();
    if (!inputType) return null;

    for (const [fieldType, config] of Object.entries(patterns.FIELD_PATTERNS)) {
      if (config.inputType === inputType) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.INPUT_TYPE,
          source: 'input-type'
        };
      }
    }

    return null;
  },

  /**
   * Match by direct attributes (name, id)
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByDirectAttributes(input, profile) {
    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS || !labelDetector) return null;

    const directIdentifiers = labelDetector.getDirectIdentifiers(input);

    if (!directIdentifiers) return null;

    for (const [fieldType, config] of Object.entries(patterns.FIELD_PATTERNS)) {
      if (config.patterns.some(p => p.test(directIdentifiers))) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.DIRECT_PATTERN,
          source: 'direct-attributes'
        };
      }
    }

    return null;
  },

  /**
   * Match by label text
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByLabelText(input, profile) {
    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS || !labelDetector) return null;

    const labelText = labelDetector.getLabelText(input).toLowerCase();

    if (!labelText) return null;

    for (const [fieldType, config] of Object.entries(patterns.FIELD_PATTERNS)) {
      if (config.patterns.some(p => p.test(labelText))) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.LABEL_MATCH,
          source: 'label'
        };
      }
    }

    return null;
  },

  /**
   * Match by parent element text
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByParentText(input, profile) {
    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS || !labelDetector) return null;

    const parent = input.parentElement;

    if (!parent) return null;

    const parentText = labelDetector.getParentTextContent(parent, input).toLowerCase();
    if (!parentText) return null;

    for (const [fieldType, config] of Object.entries(patterns.FIELD_PATTERNS)) {
      if (config.patterns.some(p => p.test(parentText))) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.PARENT_LABEL,
          source: 'parent'
        };
      }
    }

    return null;
  },

  /**
   * Match by placeholder
   * @param {HTMLElement} input - Input element
   * @param {Object} profile - User profile
   * @returns {Object|null} Match object or null
   */
  matchByPlaceholder(input, profile) {
    const patterns = this._getPatterns();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS) return null;

    const placeholder = input.placeholder?.toLowerCase();

    if (!placeholder) return null;

    for (const [fieldType, config] of Object.entries(patterns.FIELD_PATTERNS)) {
      if (config.patterns.some(p => p.test(placeholder))) {
        return {
          fieldType,
          certainty: patterns.CERTAINTY_LEVELS.PLACEHOLDER,
          source: 'placeholder'
        };
      }
    }

    return null;
  },

  /**
   * Match confirmation fields (confirm email, confirm password, etc.)
   * Detects fields that ask user to re-enter a previous value
   * @param {HTMLElement} input - Input element
   * @param {Object} previousValues - Map of field types to their filled values
   * @returns {Object|null} Match object or null
   */
  matchByConfirmField(input, previousValues) {
    if (!previousValues || Object.keys(previousValues).length === 0) {
      return null;
    }

    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Null check for required dependencies
    if (!patterns?.CONFIRM_PATTERNS || !labelDetector) return null;

    const identifiers = labelDetector.getFieldIdentifiers(input);

    // Check if this looks like a confirmation field
    const isConfirmField = patterns.CONFIRM_PATTERNS.some(p => p.test(identifiers));
    if (!isConfirmField) return null;

    // Determine what field this confirms
    const baseType = this._inferConfirmFieldType(identifiers, previousValues);
    if (baseType && previousValues[baseType]) {
      return {
        fieldType: baseType,
        value: previousValues[baseType],
        certainty: patterns.CERTAINTY_LEVELS.DIRECT_PATTERN,
        isConfirm: true,
        source: 'confirm-field'
      };
    }

    return null;
  },

  /**
   * Infer what field type a confirmation field is confirming
   * @param {string} identifiers - Combined field identifiers
   * @param {Object} previousValues - Map of available previous values
   * @returns {string|null} Field type or null
   */
  _inferConfirmFieldType(identifiers, previousValues) {
    // Check common confirmation field types
    const confirmableTypes = ['email', 'phone', 'password'];

    for (const type of confirmableTypes) {
      if (identifiers.includes(type) && previousValues[type]) {
        return type;
      }
    }

    // If no specific type found but email was filled, assume email confirmation
    if (previousValues.email) {
      return 'email';
    }

    return null;
  },

  /**
   * Match terms/agreement checkboxes that should be auto-checked
   * @param {HTMLElement} input - Input element (should be checkbox)
   * @returns {Object|null} Match object or null
   */
  matchByTermsCheckbox(input) {
    if (input.type !== 'checkbox') return null;

    const patterns = this._getPatterns();
    const labelDetector = this._getLabelDetector();

    // Null check for required dependencies
    if (!patterns?.FIELD_PATTERNS || !labelDetector) return null;

    // Get all relevant text around the checkbox
    const identifiers = labelDetector.getFieldIdentifiers(input);
    const labelText = labelDetector.getLabelText(input).toLowerCase();
    const combinedText = identifiers + ' ' + labelText;

    // Check if this is a terms/agreement checkbox
    const termsConfig = patterns.FIELD_PATTERNS.agreeTerms;
    if (termsConfig && termsConfig.patterns.some(p => p.test(combinedText))) {
      return {
        fieldType: 'agreeTerms',
        certainty: patterns.CERTAINTY_LEVELS.LABEL_MATCH,
        autoCheck: true,
        source: 'terms-checkbox'
      };
    }

    return null;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerMatchingStrategies = JobTrackerMatchingStrategies;
}
