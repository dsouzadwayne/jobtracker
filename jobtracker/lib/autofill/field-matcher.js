/**
 * JobTracker Field Matcher
 * Main orchestrator for multi-stage field matching with certainty scoring
 * Coordinates matching strategies and value extraction
 */

const JobTrackerFieldMatcherModule = {
  /**
   * Default match settings - configurable sources to check
   */
  DEFAULT_MATCH_SETTINGS: {
    matchName: true,
    matchId: true,
    matchPlaceholder: true,
    matchClass: false,        // Noisy - disabled by default
    matchLabel: true,
    matchAriaLabel: true,
    matchAriaLabelledBy: true,
    matchDataAttributes: true
  },

  /**
   * Get dependencies
   */
  _getPatterns() {
    return window.JobTrackerFieldPatterns;
  },

  _getStrategies() {
    return window.JobTrackerMatchingStrategies;
  },

  /**
   * Multi-stage field matching with certainty scoring
   * Returns the best match with highest certainty
   * @param {HTMLElement} input - The input element to match
   * @param {Object} profile - User profile data
   * @param {Array} customRules - Optional custom regex rules from settings
   * @param {Object} matchSettings - Optional settings to control which sources to check
   * @returns {Object|null} Match object with fieldType, value, certainty, etc.
   */
  matchField(input, profile, customRules = [], matchSettings = null) {
    const strategies = this._getStrategies();
    const settings = matchSettings || this.DEFAULT_MATCH_SETTINGS;
    const matches = [];

    // Stage 0: Check custom rules first (highest priority for user rules)
    const customMatch = strategies.matchByCustomRules(input, profile, customRules);
    if (customMatch) {
      matches.push(this._enrichMatch(customMatch, profile));
    }

    // Stage 0.5: Enhanced detection (JSON-LD + NLP + Readability)
    // Runs before exact attributes to improve field recognition on unsupported sites
    if (strategies.matchByEnhancedDetection) {
      const enhancedMatch = strategies.matchByEnhancedDetection(input, profile);
      if (enhancedMatch) {
        matches.push(this._enrichMatch(enhancedMatch, profile));
      }
    }

    // Stage 1: Check data-automation-id and autocomplete (highest certainty)
    if (settings.matchDataAttributes) {
      const exactMatch = strategies.matchByExactAttribute(input, profile);
      if (exactMatch) {
        matches.push(this._enrichMatch(exactMatch, profile));
      }
    }

    // Stage 2: Check input type
    const typeMatch = strategies.matchByInputType(input, profile);
    if (typeMatch) {
      matches.push(this._enrichMatch(typeMatch, profile));
    }

    // Stage 3: Check direct attributes (name, id) with patterns
    if (settings.matchName || settings.matchId) {
      const directMatch = strategies.matchByDirectAttributes(input, profile);
      if (directMatch) {
        matches.push(this._enrichMatch(directMatch, profile));
      }
    }

    // Stage 4: Check label text
    if (settings.matchLabel || settings.matchAriaLabel || settings.matchAriaLabelledBy) {
      const labelMatch = strategies.matchByLabelText(input, profile);
      if (labelMatch) {
        matches.push(this._enrichMatch(labelMatch, profile));
      }
    }

    // Stage 5: Check parent element text
    const parentMatch = strategies.matchByParentText(input, profile);
    if (parentMatch) {
      matches.push(this._enrichMatch(parentMatch, profile));
    }

    // Stage 6: Check placeholder
    if (settings.matchPlaceholder) {
      const placeholderMatch = strategies.matchByPlaceholder(input, profile);
      if (placeholderMatch) {
        matches.push(this._enrichMatch(placeholderMatch, profile));
      }
    }

    // Return highest certainty match
    if (matches.length === 0) return null;

    matches.sort((a, b) => b.certainty - a.certainty);
    return matches[0];
  },

  /**
   * Async version of matchField - waits for enhanced detection initialization
   * Use this on first page load to avoid race conditions
   * @param {HTMLElement} input - The input element to match
   * @param {Object} profile - User profile data
   * @param {Array} customRules - Optional custom regex rules from settings
   * @param {Object} matchSettings - Optional settings to control which sources to check
   * @returns {Promise<Object|null>} Match object with fieldType, value, certainty, etc.
   */
  async matchFieldAsync(input, profile, customRules = [], matchSettings = null) {
    const strategies = this._getStrategies();
    const settings = matchSettings || this.DEFAULT_MATCH_SETTINGS;
    const matches = [];

    // Stage 0: Check custom rules first (highest priority for user rules)
    const customMatch = strategies.matchByCustomRules(input, profile, customRules);
    if (customMatch) {
      matches.push(this._enrichMatch(customMatch, profile));
    }

    // Stage 0.5: Enhanced detection (JSON-LD + NLP + Readability) - ASYNC
    // Waits for initialization to complete
    if (strategies.matchByEnhancedDetectionAsync) {
      const enhancedMatch = await strategies.matchByEnhancedDetectionAsync(input, profile);
      if (enhancedMatch) {
        matches.push(this._enrichMatch(enhancedMatch, profile));
      }
    }

    // Stage 1: Check data-automation-id and autocomplete (highest certainty)
    if (settings.matchDataAttributes) {
      const exactMatch = strategies.matchByExactAttribute(input, profile);
      if (exactMatch) {
        matches.push(this._enrichMatch(exactMatch, profile));
      }
    }

    // Stage 2: Check input type
    const typeMatch = strategies.matchByInputType(input, profile);
    if (typeMatch) {
      matches.push(this._enrichMatch(typeMatch, profile));
    }

    // Stage 3: Check direct attributes (name, id) with patterns
    if (settings.matchName || settings.matchId) {
      const directMatch = strategies.matchByDirectAttributes(input, profile);
      if (directMatch) {
        matches.push(this._enrichMatch(directMatch, profile));
      }
    }

    // Stage 4: Check label text
    if (settings.matchLabel || settings.matchAriaLabel || settings.matchAriaLabelledBy) {
      const labelMatch = strategies.matchByLabelText(input, profile);
      if (labelMatch) {
        matches.push(this._enrichMatch(labelMatch, profile));
      }
    }

    // Stage 5: Check parent element text
    const parentMatch = strategies.matchByParentText(input, profile);
    if (parentMatch) {
      matches.push(this._enrichMatch(parentMatch, profile));
    }

    // Stage 6: Check placeholder
    if (settings.matchPlaceholder) {
      const placeholderMatch = strategies.matchByPlaceholder(input, profile);
      if (placeholderMatch) {
        matches.push(this._enrichMatch(placeholderMatch, profile));
      }
    }

    // Return highest certainty match
    if (matches.length === 0) return null;

    matches.sort((a, b) => b.certainty - a.certainty);
    return matches[0];
  },

  /**
   * Enrich a match with value from profile
   * @param {Object} match - Basic match from strategy
   * @param {Object} profile - User profile
   * @returns {Object} Enriched match with value
   */
  _enrichMatch(match, profile) {
    const patterns = this._getPatterns();
    const config = patterns?.FIELD_PATTERNS?.[match.fieldType];

    // Handle autoCheck fields that don't need a value from profile (e.g., terms checkboxes)
    if (match.autoCheck) {
      return match;  // Return as-is, no value needed
    }

    // Use existing value if match already has one (e.g., confirm fields)
    if (match.value !== undefined) {
      return match;
    }

    // Use profilePath from match (custom rules) or from config
    const profilePath = match.profilePath || config?.profilePath;
    let value;

    if (config?.combineFields) {
      value = config.combineFields
        .map(path => this.getValueFromProfile(path, profile))
        .filter(Boolean)
        .join(' ');
    } else if (config?.formatter === 'arrayJoin') {
      const arr = this.getValueFromProfile(profilePath, profile);
      value = Array.isArray(arr) ? arr.join(', ') : '';
    } else if (config?.formatter === 'skillsAll') {
      value = this.formatAllSkills(profile.skills);
    } else {
      value = this.getValueFromProfile(profilePath, profile);
    }

    // Apply CTC formatting if specified
    if (config?.format === 'ctc' && value && window.JobTrackerFormat) {
      const currency = profile?.personal?.ctcCurrency;
      value = window.JobTrackerFormat.formatCtc(value, currency) || value;
    }

    return {
      ...match,
      value,
      profilePath
    };
  },

  /**
   * Format all skills into a single comma-separated string
   * @param {Object} skills - Skills object from profile
   * @returns {string} Formatted skills string
   */
  formatAllSkills(skills) {
    if (!skills) return '';
    const all = [
      ...(skills.languages || []),
      ...(skills.frameworks || []),
      ...(skills.tools || []),
      ...(skills.soft || [])
    ];
    return all.join(', ');
  },

  /**
   * Get value from profile using path notation
   * Supports: "personal.firstName", "workHistory[0].company", etc.
   * @param {string} path - Dot notation path with optional array indices
   * @param {Object} profile - User profile object
   * @returns {*} Value at path or empty string
   */
  getValueFromProfile(path, profile) {
    if (!path || !profile) return '';

    // Special handling for cover letter - get default cover letter
    if (path === 'coverLetters.default') {
      const coverLetters = profile.coverLetters || [];
      const defaultCL = coverLetters.find(cl => cl.isDefault) || coverLetters[0];
      return defaultCL?.content || '';
    }

    // Handle array notation like workHistory[0].company
    const arrayMatch = path.match(/^(\w+)\[(\d+)\]\.(.+)$/);
    if (arrayMatch) {
      const [, arrayName, index, subPath] = arrayMatch;
      const array = profile[arrayName];
      if (!Array.isArray(array) || !array[index]) return '';
      return this.getValueFromProfile(subPath, array[index]);
    }

    // Handle simple dot notation
    return path.split('.').reduce((obj, key) => obj?.[key], profile) || '';
  },

  /**
   * Match all fields in a form with certainty scoring
   * @param {HTMLElement} form - The form/container element to match fields in
   * @param {Object} profile - User profile data
   * @param {Array} customRules - Optional custom regex rules from settings
   * @returns {Array} Array of match objects with input elements
   */
  matchFormFields(form, profile, customRules = []) {
    const matches = [];
    const processedFields = new Set();
    const inputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    );

    inputs.forEach(input => {
      // Skip already filled or processed fields
      if (input.value && input.value.trim()) return;
      if (processedFields.has(input)) return;

      const match = this.matchField(input, profile, customRules);
      if (match && match.value) {
        matches.push({
          input,
          ...match
        });
        processedFields.add(input);
      }
    });

    // Sort by certainty (highest first)
    matches.sort((a, b) => b.certainty - a.certainty);

    return matches;
  },

  /**
   * Match fields with confirmation field detection
   * Tracks filled values to detect and fill confirmation fields
   * @param {HTMLElement} form - Form element
   * @param {Object} profile - User profile
   * @param {Array} customRules - Custom rules
   * @returns {Array} Matches including confirmation field matches
   */
  matchFormFieldsWithConfirm(form, profile, customRules = []) {
    const strategies = this._getStrategies();
    const matches = [];
    const processedFields = new Set();
    const filledValues = {};  // Track filled values for confirm detection

    const inputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    );

    inputs.forEach(input => {
      if (input.value && input.value.trim()) return;
      if (processedFields.has(input)) return;

      // Try standard matching first
      let match = this.matchField(input, profile, customRules);

      // If no match, try confirmation field detection
      if (!match && Object.keys(filledValues).length > 0) {
        match = strategies.matchByConfirmField(input, filledValues);
      }

      if (match && match.value) {
        matches.push({
          input,
          ...match
        });
        processedFields.add(input);

        // Track this value for potential confirmation fields
        filledValues[match.fieldType] = match.value;
      }
    });

    matches.sort((a, b) => b.certainty - a.certainty);
    return matches;
  },

  /**
   * Get unique identifier for an element (for position-based matching)
   * @param {HTMLElement} element - Element to identify
   * @returns {string|null} Unique identifier or null
   */
  getUniqueId(element) {
    const patterns = this._getPatterns();
    const form = element.closest('form');
    const root = form || document.body;

    // Try attributes in priority order
    for (const attr of patterns.ATTRIBUTE_PRIORITY) {
      const value = element.getAttribute(attr);
      if (value) {
        try {
          const match = root.querySelector(`[${attr}="${CSS.escape(value)}"]`);
          if (match === element) return value;
        } catch (e) {
          // CSS.escape might fail
        }
      }
    }

    // Fallback to placeholder
    if (element.placeholder) {
      return element.placeholder.replace(/\s/g, '_');
    }

    return element.name || element.id || null;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFieldMatcherModule = JobTrackerFieldMatcherModule;

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('field-matcher');
  }
}
