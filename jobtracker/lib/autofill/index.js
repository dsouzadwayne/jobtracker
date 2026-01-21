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

    // Convenience accessors
    get CERTAINTY_LEVELS() {
      return this.FieldPatterns?.CERTAINTY_LEVELS;
    },

    get FIELD_PATTERNS() {
      return this.FieldPatterns?.FIELD_PATTERNS;
    },

    get ATTRIBUTE_PRIORITY() {
      return this.FieldPatterns?.ATTRIBUTE_PRIORITY;
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
  }

  console.log('JobTracker: Autofill modules loaded (modular architecture)');
})();
