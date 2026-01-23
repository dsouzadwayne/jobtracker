/**
 * JobTracker Autofill Module Index
 * Aggregates all autofill modules and provides backward-compatible exports
 */

(function() {
  'use strict';

  // Create unified namespace
  const JobTrackerAutofill = {
    // Core modules
    DomUtils: window.JobTrackerDomUtils,
    EventDispatcher: window.JobTrackerEventDispatcher,
    LabelDetector: window.JobTrackerLabelDetector,
    FieldPatterns: window.JobTrackerFieldPatterns,
    AutocompleteMap: window.JobTrackerAutocompleteMap,
    MatchingStrategies: window.JobTrackerMatchingStrategies,
    FieldMatcher: window.JobTrackerFieldMatcherModule,
    InputFillers: window.JobTrackerInputFillers,
    FormDetector: window.JobTrackerFormDetector,

    // New modules
    Config: window.JobTrackerConfig,
    FieldRegistry: window.JobTrackerFieldRegistry,
    LocaleDetector: window.JobTrackerLocaleDetector,
    Namespace: window.JobTrackerNamespace,

    // Performance & Edge Case modules
    CacheManager: window.JobTrackerCacheManager,
    DynamicObserver: window.JobTrackerDynamicObserver,
    ShadowDomUtils: window.JobTrackerShadowDomUtils,
    IframeBridge: window.JobTrackerIframeBridge,
    MaskHandler: window.JobTrackerMaskHandler,

    // Enhanced detection modules (lazy-loaded)
    _enhancedDetectionLoaded: false,
    _allInitialized: false,

    /**
     * Initialize all autofill modules
     * Call this before autofill to ensure all modules are ready
     * @returns {Promise<boolean>} True if all modules initialized successfully
     */
    async initAll() {
      if (this._allInitialized) return true;

      try {
        // Initialize enhanced detection
        await this.initEnhancedDetection();

        // Apply any user config overrides
        if (window.JobTrackerConfig?.getUserOverrides) {
          const overrides = await window.JobTrackerConfig.getUserOverrides();
          window.JobTrackerConfig.applyOverrides(overrides);
        }

        // Validate dependencies if namespace is available
        if (window.JobTrackerNamespace) {
          const validation = window.JobTrackerNamespace.validateAll();
          if (!validation.valid) {
            const issuesSummary = validation.issues.map(i => `${i.module}: missing [${i.missing.join(', ')}]`).join('; ');
            console.warn('JobTracker: Some module dependencies missing:', issuesSummary);
          }
        }

        this._allInitialized = true;
        console.log('JobTracker: All autofill modules initialized');
        return true;
      } catch (error) {
        console.warn('JobTracker: Error during initAll:', error.message);
        return false;
      }
    },

    /**
     * Check if all modules are initialized and ready
     * @returns {boolean}
     */
    isReady() {
      return this._allInitialized && this._enhancedDetectionLoaded;
    },

    /**
     * Ensure all modules are ready before use
     * @returns {Promise<boolean>}
     */
    async ensureReady() {
      if (this.isReady()) return true;
      return this.initAll();
    },

    /**
     * Lazy-load and initialize enhanced detection module
     * @returns {Promise<Object|null>} EnhancedDetection module or null
     */
    async initEnhancedDetection() {
      if (this._enhancedDetectionLoaded) {
        return window.EnhancedDetection;
      }

      // Check if modules are available
      if (!window.EnhancedDetection) {
        console.log('JobTracker: Enhanced detection module not loaded');
        this._enhancedDetectionLoaded = true;  // Mark as "loaded" (even if unavailable)
        return null;
      }

      try {
        await window.EnhancedDetection.init();
        this._enhancedDetectionLoaded = true;
        console.log('JobTracker: Enhanced detection initialized');
        return window.EnhancedDetection;
      } catch (error) {
        console.warn('JobTracker: Failed to initialize enhanced detection:', error.message);
        return null;
      }
    },

    /**
     * Get enhanced detection module (sync access)
     * @returns {Object|null} EnhancedDetection module or null
     */
    getEnhancedDetection() {
      return window.EnhancedDetection || null;
    },

    // Convenience accessors
    get CERTAINTY_LEVELS() {
      return this.FieldPatterns?.CERTAINTY_LEVELS;
    },

    get FIELD_PATTERNS() {
      return this.FieldPatterns?.FIELD_PATTERNS;
    },

    get ATTRIBUTE_PRIORITY() {
      return this.FieldPatterns?.ATTRIBUTE_PRIORITY;
    },

    // Enhanced detection accessors
    get EnhancedDetection() {
      return window.EnhancedDetection;
    },

    get JSONLDFormHints() {
      return window.JSONLDFormHints;
    },

    get ReadabilityContext() {
      return window.ReadabilityContext;
    },

    get NLPLabelAnalyzer() {
      return window.NLPLabelAnalyzer;
    },

    /**
     * Clear all enhanced detection caches (useful for SPA navigation)
     */
    clearEnhancedDetectionCache() {
      if (window.EnhancedDetection) {
        window.EnhancedDetection.clearCache();
      }
    },

    /**
     * Clear all caches including performance caches
     */
    clearAllCaches() {
      // Clear enhanced detection cache
      if (window.EnhancedDetection) {
        window.EnhancedDetection.clearCache();
      }

      // Clear cache manager
      if (window.JobTrackerCacheManager) {
        window.JobTrackerCacheManager.clearAll();
      }
    },

    /**
     * Get cache performance statistics
     * @returns {Object|null} Cache stats or null if not available
     */
    getCacheStats() {
      if (window.JobTrackerCacheManager) {
        return window.JobTrackerCacheManager.getStats();
      }
      return null;
    },

    /**
     * Initialize dynamic observer for auto-filling new fields
     * @param {Function} onNewFields - Callback when new fields are detected
     */
    initDynamicObserver(onNewFields) {
      if (window.JobTrackerDynamicObserver) {
        window.JobTrackerDynamicObserver.init(onNewFields);
      }
    },

    /**
     * Trigger re-detection of form fields
     * @returns {HTMLElement[]} Array of new empty inputs found
     */
    triggerRedetection() {
      if (window.JobTrackerDynamicObserver) {
        return window.JobTrackerDynamicObserver.triggerRedetection();
      }
      return [];
    },

    /**
     * Trigger autofill in iframes
     * @param {Object} profile - User profile
     * @param {Array} customRules - Custom rules
     * @returns {Promise<Object>} Results from iframes
     */
    async autofillIframes(profile, customRules = []) {
      if (window.JobTrackerIframeBridge) {
        return window.JobTrackerIframeBridge.triggerAutofillInIframes(profile, customRules);
      }
      return { totalFilled: 0, iframeResults: [] };
    }
  };

  // Backward-compatible JobTrackerFieldMatcher export
  // Maps old API to new modular structure
  const JobTrackerFieldMatcher = {
    // Expose certainty levels
    get CERTAINTY() {
      return JobTrackerAutofill.FieldPatterns?.CERTAINTY_LEVELS || {};
    },

    // Expose attribute priority
    get ATTRIBUTE_PRIORITY() {
      return JobTrackerAutofill.FieldPatterns?.ATTRIBUTE_PRIORITY || [];
    },

    // Expose patterns
    get patterns() {
      return JobTrackerAutofill.FieldPatterns?.FIELD_PATTERNS || {};
    },

    // Main matching function
    matchField(input, profile, customRules = []) {
      return JobTrackerAutofill.FieldMatcher?.matchField(input, profile, customRules);
    },

    // Async matching function (waits for enhanced detection)
    async matchFieldAsync(input, profile, customRules = []) {
      return JobTrackerAutofill.FieldMatcher?.matchFieldAsync(input, profile, customRules);
    },

    // Batch matching
    matchFormFields(form, profile, customRules = []) {
      return JobTrackerAutofill.FieldMatcher?.matchFormFields(form, profile, customRules);
    },

    // Label text extraction
    getLabelText(input) {
      return JobTrackerAutofill.LabelDetector?.getLabelText(input) || '';
    },

    // Field identifiers
    getFieldIdentifiers(input) {
      return JobTrackerAutofill.LabelDetector?.getFieldIdentifiers(input) || '';
    },

    // Parent text extraction
    getParentTextContent(parent, excludeElement) {
      return JobTrackerAutofill.LabelDetector?.getParentTextContent(parent, excludeElement) || '';
    },

    // Profile value extraction
    getValueFromProfile(path, profile) {
      return JobTrackerAutofill.FieldMatcher?.getValueFromProfile(path, profile) || '';
    },

    // Unique ID generation
    getUniqueId(element) {
      return JobTrackerAutofill.FieldMatcher?.getUniqueId(element);
    },

    // Skills formatting
    formatAllSkills(skills) {
      return JobTrackerAutofill.FieldMatcher?.formatAllSkills(skills) || '';
    }
  };

  // Backward-compatible JobTrackerFormUtils export
  // Maps old API to new modular structure
  const JobTrackerFormUtils = {
    // Input filling
    fillInput(input, value) {
      return JobTrackerAutofill.InputFillers?.fillInput(input, value) || false;
    },

    fillTextInput(input, value, type) {
      return JobTrackerAutofill.InputFillers?.fillTextInput(input, value, type) || false;
    },

    fillSelect(select, value) {
      return JobTrackerAutofill.InputFillers?.fillSelect(select, value) || false;
    },

    fillCheckbox(checkbox, value) {
      return JobTrackerAutofill.InputFillers?.fillCheckbox(checkbox, value) || false;
    },

    fillRadio(radio, value) {
      return JobTrackerAutofill.InputFillers?.fillRadio(radio, value) || false;
    },

    fillDateInput(input, value) {
      return JobTrackerAutofill.InputFillers?.fillDateInput(input, value) || false;
    },

    // Batch filling
    async fillFieldsWithDelay(matches, delayMs) {
      return JobTrackerAutofill.InputFillers?.fillFieldsWithDelay(matches, delayMs) || 0;
    },

    // Event dispatching
    clearReactValueTracker(input) {
      JobTrackerAutofill.EventDispatcher?.clearReactValueTracker(input);
    },

    triggerAllEvents(element, value) {
      JobTrackerAutofill.EventDispatcher?.triggerAllEvents(element, value);
    },

    dispatchKeyboardEvents(element, value) {
      JobTrackerAutofill.EventDispatcher?.dispatchKeyboardEvents(element, value);
    },

    triggerSelectEvents(select) {
      JobTrackerAutofill.EventDispatcher?.triggerSelectEvents(select);
    },

    // DOM utilities
    isVisible(element) {
      return JobTrackerAutofill.DomUtils?.isVisible(element) || false;
    },

    isDisabledOrReadonly(element) {
      return JobTrackerAutofill.DomUtils?.isDisabledOrReadonly(element) || false;
    },

    scrollIntoView(element) {
      JobTrackerAutofill.DomUtils?.scrollIntoView(element);
    },

    focusWithHighlight(element) {
      JobTrackerAutofill.DomUtils?.focusWithHighlight(element);
    },

    waitForElement(selector, timeout) {
      return JobTrackerAutofill.DomUtils?.waitForElement(selector, timeout);
    },

    delay(ms) {
      return JobTrackerAutofill.DomUtils?.delay(ms);
    },

    escapeRegex(str) {
      return JobTrackerAutofill.DomUtils?.escapeRegex(str) || str;
    },

    getTextContent(element) {
      return JobTrackerAutofill.DomUtils?.getTextContent(element) || '';
    },

    findClosest(element, selector) {
      return JobTrackerAutofill.DomUtils?.findClosest(element, selector);
    },

    // Form detection
    findJobApplicationForm() {
      return JobTrackerAutofill.FormDetector?.findJobApplicationForm() || document.body;
    },

    isJobApplicationForm(form) {
      return JobTrackerAutofill.FormDetector?.isJobApplicationForm(form) || false;
    },

    getFillableInputs(container) {
      return JobTrackerAutofill.FormDetector?.getFillableInputs(container) || [];
    }
  };

  // Make available globally
  if (typeof window !== 'undefined') {
    window.JobTrackerAutofill = JobTrackerAutofill;
    window.JobTrackerFieldMatcher = JobTrackerFieldMatcher;
    window.JobTrackerFormUtils = JobTrackerFormUtils;

    // Register with namespace if available
    if (window.JobTrackerNamespace) {
      window.JobTrackerNamespace.registerModule('index');
    }
  }

  // Initialize all modules on load (async, non-blocking)
  JobTrackerAutofill.initAll().catch(e => console.warn('JobTracker: initAll failed:', e));

  console.log('JobTracker: Autofill modules loaded (modular architecture with enhanced detection)');
})();
