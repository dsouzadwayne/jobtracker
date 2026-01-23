/**
 * JobTracker Namespace Manager
 * Provides centralized module registry and dependency validation
 * Manages global window references with typed accessors
 */

const JobTrackerNamespace = {
  /**
   * Registry of loaded modules
   * @type {Map<string, {loaded: boolean, timestamp: number}>}
   */
  _registry: new Map(),

  /**
   * Module load order for dependency checking
   */
  _loadOrder: [],

  /**
   * Expected modules in load order
   */
  EXPECTED_MODULES: [
    'config',
    'namespace',
    'field-registry',
    'locale-detector',
    'dom-utils',
    'event-dispatcher',
    'label-detector',
    'field-patterns',
    'autocomplete-map',
    'matching-strategies',
    'field-matcher',
    'input-fillers',
    'form-detector',
    'smart-field-matcher',
    'nlp-label-analyzer',
    'json-ld-form-hints',
    'readability-context',
    'enhanced-detection',
    'index'
  ],

  /**
   * Core module dependencies
   */
  DEPENDENCIES: {
    'field-patterns': ['config'],
    'field-registry': ['config'],
    'locale-detector': ['config', 'field-registry'],
    'matching-strategies': ['config', 'field-patterns', 'label-detector', 'autocomplete-map'],
    'field-matcher': ['config', 'matching-strategies', 'field-patterns'],
    'enhanced-detection': ['config', 'nlp-label-analyzer', 'json-ld-form-hints', 'readability-context'],
    'smart-field-matcher': ['config', 'field-registry'],
    'index': ['config', 'field-patterns', 'matching-strategies', 'field-matcher']
  },

  /**
   * Register a module as loaded
   * @param {string} name - Module name
   * @param {Object} options - Optional registration options
   */
  registerModule(name, options = {}) {
    this._registry.set(name, {
      loaded: true,
      timestamp: Date.now(),
      version: options.version || '1.0.0'
    });
    this._loadOrder.push(name);

    if (options.debug) {
      console.log(`[JobTrackerNamespace] Registered: ${name}`);
    }
  },

  /**
   * Check if a module is registered
   * @param {string} name - Module name
   * @returns {boolean}
   */
  isRegistered(name) {
    return this._registry.has(name);
  },

  /**
   * Get module info
   * @param {string} name - Module name
   * @returns {Object|null}
   */
  getModuleInfo(name) {
    return this._registry.get(name) || null;
  },

  /**
   * Validate dependencies for a module
   * @param {string} moduleName - Module to validate
   * @returns {{valid: boolean, missing: string[]}}
   */
  validateDependencies(moduleName) {
    const deps = this.DEPENDENCIES[moduleName];
    if (!deps) {
      return { valid: true, missing: [] };
    }

    const missing = deps.filter(dep => !this.isRegistered(dep));
    return {
      valid: missing.length === 0,
      missing
    };
  },

  /**
   * Validate all registered modules have their dependencies met
   * @returns {{valid: boolean, issues: Object[]}}
   */
  validateAll() {
    const issues = [];

    for (const [moduleName] of this._registry) {
      const { valid, missing } = this.validateDependencies(moduleName);
      if (!valid) {
        issues.push({ module: moduleName, missing });
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  },

  /**
   * Get list of all registered modules
   * @returns {string[]}
   */
  getRegisteredModules() {
    return Array.from(this._registry.keys());
  },

  /**
   * Get load order
   * @returns {string[]}
   */
  getLoadOrder() {
    return [...this._loadOrder];
  },

  // ============ Typed Accessors ============
  // Provide safe, typed access to global modules

  /**
   * Get configuration module
   * @returns {Object|null}
   */
  get Config() {
    return window.JobTrackerConfig || null;
  },

  /**
   * Get field registry module
   * @returns {Object|null}
   */
  get FieldRegistry() {
    return window.JobTrackerFieldRegistry || null;
  },

  /**
   * Get locale detector module
   * @returns {Object|null}
   */
  get LocaleDetector() {
    return window.JobTrackerLocaleDetector || null;
  },

  /**
   * Get field patterns module
   * @returns {Object|null}
   */
  get FieldPatterns() {
    return window.JobTrackerFieldPatterns || null;
  },

  /**
   * Get autocomplete map module
   * @returns {Object|null}
   */
  get AutocompleteMap() {
    return window.JobTrackerAutocompleteMap || null;
  },

  /**
   * Get matching strategies module
   * @returns {Object|null}
   */
  get MatchingStrategies() {
    return window.JobTrackerMatchingStrategies || null;
  },

  /**
   * Get field matcher module
   * @returns {Object|null}
   */
  get FieldMatcher() {
    return window.JobTrackerFieldMatcherModule || null;
  },

  /**
   * Get smart field matcher module
   * @returns {Object|null}
   */
  get SmartFieldMatcher() {
    return window.JobTrackerSmartFieldMatcher || null;
  },

  /**
   * Get enhanced detection module
   * @returns {Object|null}
   */
  get EnhancedDetection() {
    return window.EnhancedDetection || null;
  },

  /**
   * Get NLP label analyzer module
   * @returns {Object|null}
   */
  get NLPLabelAnalyzer() {
    return window.NLPLabelAnalyzer || null;
  },

  /**
   * Get JSON-LD form hints module
   * @returns {Object|null}
   */
  get JSONLDFormHints() {
    return window.JSONLDFormHints || null;
  },

  /**
   * Get readability context module
   * @returns {Object|null}
   */
  get ReadabilityContext() {
    return window.ReadabilityContext || null;
  },

  /**
   * Get label detector module
   * @returns {Object|null}
   */
  get LabelDetector() {
    return window.JobTrackerLabelDetector || null;
  },

  /**
   * Get DOM utils module
   * @returns {Object|null}
   */
  get DomUtils() {
    return window.JobTrackerDomUtils || null;
  },

  /**
   * Get event dispatcher module
   * @returns {Object|null}
   */
  get EventDispatcher() {
    return window.JobTrackerEventDispatcher || null;
  },

  /**
   * Get input fillers module
   * @returns {Object|null}
   */
  get InputFillers() {
    return window.JobTrackerInputFillers || null;
  },

  /**
   * Get form detector module
   * @returns {Object|null}
   */
  get FormDetector() {
    return window.JobTrackerFormDetector || null;
  },

  /**
   * Get main autofill module
   * @returns {Object|null}
   */
  get Autofill() {
    return window.JobTrackerAutofill || null;
  },

  // ============ Utility Methods ============

  /**
   * Wait for a module to be available
   * @param {string} moduleName - Module name to wait for
   * @param {number} timeout - Timeout in ms (default 5000)
   * @returns {Promise<Object>}
   */
  async waitForModule(moduleName, timeout = 5000) {
    const accessor = this._getAccessorForModule(moduleName);
    if (!accessor) {
      throw new Error(`Unknown module: ${moduleName}`);
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const module = accessor.call(this);
      if (module) return module;
      await new Promise(r => setTimeout(r, 50));
    }

    throw new Error(`Timeout waiting for module: ${moduleName}`);
  },

  /**
   * Get accessor function for a module name
   * @param {string} name - Module name
   * @returns {Function|null}
   */
  _getAccessorForModule(name) {
    const accessorMap = {
      'config': () => this.Config,
      'field-registry': () => this.FieldRegistry,
      'locale-detector': () => this.LocaleDetector,
      'field-patterns': () => this.FieldPatterns,
      'autocomplete-map': () => this.AutocompleteMap,
      'matching-strategies': () => this.MatchingStrategies,
      'field-matcher': () => this.FieldMatcher,
      'smart-field-matcher': () => this.SmartFieldMatcher,
      'enhanced-detection': () => this.EnhancedDetection,
      'nlp-label-analyzer': () => this.NLPLabelAnalyzer,
      'label-detector': () => this.LabelDetector,
      'json-ld-form-hints': () => this.JSONLDFormHints,
      'readability-context': () => this.ReadabilityContext,
      'dom-utils': () => this.DomUtils,
      'event-dispatcher': () => this.EventDispatcher,
      'input-fillers': () => this.InputFillers,
      'form-detector': () => this.FormDetector,
      'index': () => this.Autofill
    };
    return accessorMap[name] || null;
  },

  /**
   * Log namespace status (for debugging)
   */
  logStatus() {
    console.group('[JobTrackerNamespace] Status');
    console.log('Registered modules:', this.getRegisteredModules());
    console.log('Load order:', this.getLoadOrder());
    const validation = this.validateAll();
    if (validation.valid) {
      console.log('All dependencies satisfied');
    } else {
      console.warn('Dependency issues:', validation.issues);
    }
    console.groupEnd();
  }
};

// Register self
JobTrackerNamespace.registerModule('namespace');

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerNamespace = JobTrackerNamespace;

  // Auto-register modules that loaded before namespace
  // This handles the case where config.js loads before namespace.js
  const earlyModules = {
    'config': window.JobTrackerConfig,
    'cache-manager': window.JobTrackerCacheManager,
    'field-registry': window.JobTrackerFieldRegistry,
    'locale-detector': window.JobTrackerLocaleDetector
  };

  for (const [name, module] of Object.entries(earlyModules)) {
    if (module && !JobTrackerNamespace.isRegistered(name)) {
      JobTrackerNamespace.registerModule(name);
    }
  }
}
