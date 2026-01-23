/**
 * Enhanced Detection Module Index
 * Main orchestrator for JSON-LD, Readability, and NLP-based field detection
 * Aggregates signals with weighted scoring for improved field recognition
 */

const EnhancedDetection = {
  // Module references (set during initialization)
  _modules: {
    jsonLD: null,
    readability: null,
    nlpAnalyzer: null,
    labelDetector: null
  },

  // Initialization state
  _initialized: false,
  _initPromise: null,

  // Confidence scoring configuration
  CONFIDENCE_CONFIG: {
    // Source weights (multipliers)
    weights: {
      'json-ld': 1.2,
      'semantic-mapping': 1.0,
      'question-extraction': 1.0,
      'keyword-fallback': 1.0,
      'section-context': 0.6
    },

    // Minimum confidence threshold to return a match
    minConfidence: 0.60,

    // Maximum confidence cap (to allow exact attributes to override)
    maxConfidence: 0.95,

    // Confidence ranges by source
    ranges: {
      'json-ld': { min: 0.80, max: 0.90 },
      'semantic-mapping': { min: 0.75, max: 0.85 },
      'question-extraction': { min: 0.70, max: 0.80 },
      'section-context': { min: 0.50, max: 0.60 },
      'keyword-fallback': { min: 0.55, max: 0.65 }
    }
  },

  /**
   * Initialize the enhanced detection module
   * Lazy-loads dependencies and caches page-level analysis
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;

    // Return existing promise if initialization is in progress
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    return this._initPromise;
  },

  /**
   * Internal initialization logic
   */
  async _doInit() {
    try {
      // Get module references from global scope
      this._modules.jsonLD = window.JSONLDFormHints;
      this._modules.readability = window.ReadabilityContext;
      this._modules.nlpAnalyzer = window.NLPLabelAnalyzer;
      this._modules.labelDetector = window.JobTrackerLabelDetector;

      // Pre-cache page-level analysis (runs in parallel)
      const initTasks = [];

      if (this._modules.jsonLD) {
        initTasks.push(Promise.resolve(this._modules.jsonLD.getPageContext()));
      }

      if (this._modules.readability) {
        initTasks.push(Promise.resolve(this._modules.readability.getPageContext()));
      }

      await Promise.all(initTasks);

      this._initialized = true;
      console.log('[EnhancedDetection] Initialized successfully');
    } catch (error) {
      console.warn('[EnhancedDetection] Initialization error:', error.message);
      // Still mark as initialized to prevent retries
      this._initialized = true;
    }
  },

  /**
   * Analyze a field and return enhanced detection result
   * Main API for the enhanced detection layer
   * @param {HTMLElement} input - Input element to analyze
   * @param {string} labelText - Optional pre-extracted label text
   * @returns {Object|null} { fieldType, confidence, source, signals }
   */
  analyzeField(input, labelText = null) {
    // Ensure initialization
    if (!this._initialized) {
      // Synchronous fallback - try to init but don't wait
      this.init().catch(() => {});
    }

    const signals = [];

    // Get label text if not provided
    if (!labelText && this._modules.labelDetector) {
      labelText = this._modules.labelDetector.getLabelText(input);
    }

    // Signal 1: JSON-LD structured data hints
    const jsonLDSignal = this._getJSONLDSignal(input, labelText);
    if (jsonLDSignal) {
      signals.push(jsonLDSignal);
    }

    // Signal 2: NLP label analysis
    const nlpSignal = this._getNLPSignal(labelText);
    if (nlpSignal) {
      signals.push(nlpSignal);
    }

    // Signal 3: Section context from readability
    const contextSignal = this._getContextSignal(input);
    if (contextSignal) {
      signals.push(contextSignal);
    }

    // No signals found
    if (signals.length === 0) {
      return null;
    }

    // Aggregate signals and determine best match
    return this._aggregateSignals(signals, input);
  },

  /**
   * Get JSON-LD based signal
   * @param {HTMLElement} input - Input element
   * @param {string} labelText - Label text
   * @returns {Object|null} Signal object
   */
  _getJSONLDSignal(input, labelText) {
    if (!this._modules.jsonLD) return null;

    const pageContext = this._modules.jsonLD.getPageContext();
    if (!pageContext.hasStructuredData) return null;

    // Check if page is a job application
    if (pageContext.isJobApplication) {
      // Try to match label text to known job-related fields
      const labelLower = (labelText || '').toLowerCase();

      // Check field hints from JSON-LD
      for (const [fieldType, hint] of Object.entries(pageContext.fieldHints)) {
        // If the label mentions this field type's context
        if (this._labelMatchesContext(labelLower, hint.sources)) {
          return {
            fieldType,
            confidence: hint.confidence,
            source: 'json-ld',
            context: pageContext
          };
        }
      }
    }

    return null;
  },

  /**
   * Check if label matches any context from JSON-LD sources
   * @param {string} labelLower - Lowercase label
   * @param {Array} sources - JSON-LD sources
   * @returns {boolean}
   */
  _labelMatchesContext(labelLower, sources) {
    const contextKeywords = {
      company: ['company', 'employer', 'organization'],
      contact: ['email', 'phone', 'contact'],
      address: ['address', 'street', 'city', 'state', 'zip', 'postal'],
      salary: ['salary', 'compensation', 'ctc', 'pay'],
      job: ['title', 'position', 'role'],
      personal: ['name', 'first', 'last']
    };

    for (const source of sources) {
      const keywords = contextKeywords[source.context] || [];
      for (const keyword of keywords) {
        if (labelLower.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Get NLP-based signal from label analysis
   * @param {string} labelText - Label text
   * @returns {Object|null} Signal object
   */
  _getNLPSignal(labelText) {
    if (!this._modules.nlpAnalyzer || !labelText) return null;

    const result = this._modules.nlpAnalyzer.analyzeLabel(labelText);
    if (result && result.fieldType) {
      return {
        fieldType: result.fieldType,
        confidence: result.confidence,
        source: result.method,
        originalLabel: labelText
      };
    }

    return null;
  },

  /**
   * Get context-based signal from readability analysis
   * @param {HTMLElement} input - Input element
   * @returns {Object|null} Signal object
   */
  _getContextSignal(input) {
    if (!this._modules.readability) return null;

    const section = this._modules.readability.getSectionForInput(input);
    if (!section || !section.type) return null;

    const expectedFields = this._modules.readability.getFieldTypesForSection(section.type);

    if (expectedFields.length > 0) {
      return {
        fieldType: null, // Context doesn't determine field type directly
        sectionType: section.type,
        expectedFields,
        confidence: section.confidence || 0.50,
        source: 'section-context'
      };
    }

    return null;
  },

  /**
   * Aggregate multiple signals into a final result
   * @param {Array<Object>} signals - Array of signal objects
   * @param {HTMLElement} input - Input element (for context boost)
   * @returns {Object|null} Aggregated result
   */
  _aggregateSignals(signals, input) {
    // Group signals by field type
    const fieldVotes = {};

    for (const signal of signals) {
      if (signal.fieldType) {
        if (!fieldVotes[signal.fieldType]) {
          fieldVotes[signal.fieldType] = {
            signals: [],
            totalConfidence: 0,
            weightedConfidence: 0
          };
        }

        const weight = this.CONFIDENCE_CONFIG.weights[signal.source] || 1.0;
        const weightedConf = signal.confidence * weight;

        fieldVotes[signal.fieldType].signals.push(signal);
        fieldVotes[signal.fieldType].totalConfidence += signal.confidence;
        fieldVotes[signal.fieldType].weightedConfidence += weightedConf;
      }
    }

    // Find best field type
    let bestFieldType = null;
    let bestScore = 0;
    let bestSignals = [];

    for (const [fieldType, data] of Object.entries(fieldVotes)) {
      // Score considers both weighted confidence and number of agreeing signals
      const agreementBonus = Math.min(0.10, (data.signals.length - 1) * 0.05);
      const score = data.weightedConfidence + agreementBonus;

      if (score > bestScore) {
        bestScore = score;
        bestFieldType = fieldType;
        bestSignals = data.signals;
      }
    }

    // Check against minimum confidence threshold
    if (!bestFieldType || bestScore < this.CONFIDENCE_CONFIG.minConfidence) {
      return null;
    }

    // Apply context boost if field matches section expectations
    const contextSignal = signals.find(s => s.source === 'section-context');
    if (contextSignal && contextSignal.expectedFields.includes(bestFieldType)) {
      bestScore += 0.10;
    }

    // Cap confidence
    const finalConfidence = Math.min(
      this.CONFIDENCE_CONFIG.maxConfidence,
      bestScore
    );

    return {
      fieldType: bestFieldType,
      confidence: finalConfidence,
      source: bestSignals[0]?.source || 'enhanced-detection',
      signals: bestSignals,
      allSignals: signals
    };
  },

  /**
   * Batch analyze multiple fields
   * @param {Array<HTMLElement>} inputs - Array of input elements
   * @returns {Map<HTMLElement, Object>} Map of inputs to their analysis results
   */
  analyzeFields(inputs) {
    const results = new Map();

    for (const input of inputs) {
      const result = this.analyzeField(input);
      if (result) {
        results.set(input, result);
      }
    }

    return results;
  },

  /**
   * Check if enhanced detection is available and useful for current page
   * @returns {boolean}
   */
  isAvailable() {
    return !!(
      this._modules.jsonLD ||
      this._modules.readability ||
      this._modules.nlpAnalyzer
    );
  },

  /**
   * Check if current page has job application context
   * @returns {boolean}
   */
  isJobApplicationPage() {
    if (this._modules.jsonLD && this._modules.jsonLD.isJobApplicationPage()) {
      return true;
    }

    if (this._modules.readability && this._modules.readability.isJobApplicationPage()) {
      return true;
    }

    return false;
  },

  /**
   * Get page context information (for debugging/logging)
   * @returns {Object} Combined page context
   */
  getPageContext() {
    return {
      jsonLD: this._modules.jsonLD?.getPageContext() || null,
      readability: this._modules.readability?.getPageContext() || null,
      isJobApplication: this.isJobApplicationPage()
    };
  },

  /**
   * Clear all caches (useful for SPA navigation)
   */
  clearCache() {
    if (this._modules.jsonLD) {
      this._modules.jsonLD.clearCache();
    }
    if (this._modules.readability) {
      this._modules.readability.clearCache();
    }
  },

  /**
   * Reset initialization state (for testing)
   */
  reset() {
    this._initialized = false;
    this._initPromise = null;
    this.clearCache();
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EnhancedDetection = EnhancedDetection;
}
