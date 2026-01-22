/**
 * Extraction Pipeline
 * Main orchestrator for job extraction from web pages
 *
 * Runs multiple extraction strategies in parallel and merges results
 * by confidence score, with optional LLM fallback for low-confidence results.
 */

// Import strategies
import * as jsonLdStrategy from './strategies/json-ld.js';
import * as appDataStrategy from './strategies/app-data.js';
import * as ariaLabelsStrategy from './strategies/aria-labels.js';
import * as metaTagsStrategy from './strategies/meta-tags.js';
import * as cssSelectorStrategy from './strategies/css-selectors.js';
import * as proximityStrategy from './strategies/proximity.js';
import * as titleParseStrategy from './strategies/title-parse.js';
import * as readabilityStrategy from './strategies/readability.js';

// Import utilities
import { calculateOverallConfidence, getConfidenceLevel } from './confidence.js';
import { cleanText, sanitizeText } from './validators.js';
import {
  mergeResults,
  selectBestCandidates,
  mergeDOMAndML,
  mergeWithLLM,
  flattenResults
} from './merger.js';

// Strategy registry with priority order
const STRATEGIES = [
  { name: 'json-ld', module: jsonLdStrategy, priority: 1 },
  { name: 'app-data', module: appDataStrategy, priority: 2 },
  { name: 'aria-labels', module: ariaLabelsStrategy, priority: 3 },
  { name: 'meta-tags', module: metaTagsStrategy, priority: 4 },
  { name: 'css-selectors', module: cssSelectorStrategy, priority: 5 },
  { name: 'proximity', module: proximityStrategy, priority: 6 },
  { name: 'title-parse', module: titleParseStrategy, priority: 7 },
  { name: 'readability', module: readabilityStrategy, priority: 8 }
];

// Confidence threshold for LLM fallback
const LLM_FALLBACK_THRESHOLD = 0.6;

/**
 * ExtractionPipeline - Main extraction orchestrator
 */
class ExtractionPipeline {
  /**
   * Create an extraction pipeline
   * @param {Object} options - Configuration options
   * @param {boolean} options.llmEnabled - Whether to use LLM fallback
   * @param {Function} options.mlExtractor - ML extraction function (optional)
   * @param {Function} options.llmExtractor - LLM extraction function (optional)
   * @param {Document} options.document - Document to extract from (default: window.document)
   * @param {Window} options.window - Window context (default: window)
   */
  constructor(options = {}) {
    this.llmEnabled = options.llmEnabled ?? false;
    this.mlExtractor = options.mlExtractor || null;
    this.llmExtractor = options.llmExtractor || null;
    this.doc = options.document || document;
    this.win = options.window || window;
    this.debug = options.debug || false;
  }

  /**
   * Run the full extraction pipeline
   * @returns {Promise<Object>} Extraction result
   */
  async extract() {
    const startTime = performance.now();
    const timing = {
      domStrategies: 0,
      mlExtraction: 0,
      merging: 0,
      llmFallback: 0,
      total: 0
    };

    try {
      // Run DOM strategies and ML extraction in parallel
      const domStart = performance.now();
      const [domResults, mlResults] = await Promise.all([
        this.runDOMStrategies(),
        this.runMLExtraction()
      ]);
      timing.domStrategies = performance.now() - domStart;

      // Merge DOM and ML results
      const mergeStart = performance.now();
      const merged = mergeDOMAndML(domResults, mlResults);
      const candidates = selectBestCandidates(merged);
      timing.merging = performance.now() - mergeStart;

      // Validate and clean
      this.validateResults(candidates);

      // Check if LLM fallback is needed
      if (this.shouldUseLLMFallback(candidates)) {
        const llmStart = performance.now();
        const llmResults = await this.runLLMFallback(candidates);
        if (llmResults) {
          const enhanced = mergeWithLLM(candidates, llmResults);
          Object.assign(candidates, enhanced);
        }
        timing.llmFallback = performance.now() - llmStart;
      }

      timing.total = performance.now() - startTime;

      // Add metadata
      candidates._extractionMeta = {
        ...candidates._extractionMeta,
        timing,
        url: this.win.location?.href,
        platform: this.detectPlatform()
      };

      if (this.debug) {
        console.log('[ExtractionPipeline] Results:', candidates);
        console.log('[ExtractionPipeline] Timing:', timing);
      }

      return candidates;

    } catch (error) {
      console.error('[ExtractionPipeline] Error:', error);

      // Return empty result on error
      return {
        position: { value: '', confidence: 0, source: null },
        company: { value: '', confidence: 0, source: null },
        location: { value: '', confidence: 0, source: null },
        salary: { value: '', confidence: 0, source: null },
        jobDescription: { value: '', confidence: 0, source: null },
        overallConfidence: 0,
        _extractionMeta: {
          error: error.message,
          timing: { total: performance.now() - startTime }
        }
      };
    }
  }

  /**
   * Run all DOM extraction strategies in parallel
   * @returns {Promise<Object>} Merged results from all strategies
   */
  async runDOMStrategies() {
    const results = [];

    // Run applicable strategies in parallel
    const strategyPromises = STRATEGIES
      .filter(s => this.isStrategyApplicable(s))
      .map(async s => {
        try {
          const result = await this.runStrategy(s);
          return result;
        } catch (e) {
          console.debug(`[ExtractionPipeline] Strategy ${s.name} failed:`, e.message);
          return null;
        }
      });

    const strategyResults = await Promise.all(strategyPromises);
    results.push(...strategyResults.filter(Boolean));

    return mergeResults(results);
  }

  /**
   * Check if a strategy is applicable
   * @param {Object} strategy - Strategy definition
   * @returns {boolean} True if applicable
   */
  isStrategyApplicable(strategy) {
    try {
      if (strategy.module.isApplicable) {
        // Pass appropriate context based on strategy
        if (strategy.name === 'app-data') {
          return strategy.module.isApplicable(this.win);
        }
        return strategy.module.isApplicable(this.doc);
      }
      return true; // Default to applicable
    } catch (e) {
      return false;
    }
  }

  /**
   * Run a single strategy
   * @param {Object} strategy - Strategy definition
   * @returns {Promise<Object>} Strategy results
   */
  async runStrategy(strategy) {
    // Pass appropriate context
    if (strategy.name === 'app-data') {
      return strategy.module.extract(this.win);
    }
    if (strategy.name === 'readability') {
      return strategy.module.extract(this.doc);
    }
    return strategy.module.extract(this.doc);
  }

  /**
   * Run ML-based extraction
   * @returns {Promise<Object|null>} ML extraction results
   */
  async runMLExtraction() {
    if (!this.mlExtractor) return null;

    try {
      // Get page text for ML extraction
      const pageText = this.getPageText();
      if (!pageText || pageText.length < 100) return null;

      return await this.mlExtractor(pageText);
    } catch (e) {
      console.debug('[ExtractionPipeline] ML extraction failed:', e.message);
      return null;
    }
  }

  /**
   * Check if LLM fallback should be used
   * @param {Object} results - Current extraction results
   * @returns {boolean} True if LLM fallback should run
   */
  shouldUseLLMFallback(results) {
    if (!this.llmEnabled || !this.llmExtractor) return false;

    // Use LLM if overall confidence is below threshold
    if (results.overallConfidence < LLM_FALLBACK_THRESHOLD) return true;

    // Use LLM if critical fields are missing
    if (!results.position?.value || !results.company?.value) return true;

    return false;
  }

  /**
   * Run LLM fallback extraction
   * @param {Object} currentResults - Current extraction results
   * @returns {Promise<Object|null>} LLM results
   */
  async runLLMFallback(currentResults) {
    if (!this.llmExtractor) return null;

    try {
      const pageText = this.getPageText();
      if (!pageText || pageText.length < 100) return null;

      // Truncate for LLM (max 8000 chars as per plan)
      const truncatedText = pageText.substring(0, 8000);

      return await this.llmExtractor(truncatedText, currentResults);
    } catch (e) {
      console.debug('[ExtractionPipeline] LLM fallback failed:', e.message);
      return null;
    }
  }

  /**
   * Get page text for ML/LLM extraction
   * @returns {string} Page text
   */
  getPageText() {
    // Try main content first
    const mainContent = this.doc.querySelector('main, [role="main"], article');
    if (mainContent) {
      return cleanText(mainContent.textContent || '');
    }

    // Fallback to body
    return cleanText(this.doc.body?.textContent || '');
  }

  /**
   * Validate and sanitize results
   * @param {Object} results - Results to validate
   */
  validateResults(results) {
    const fields = ['position', 'company', 'location', 'salary', 'jobDescription'];

    for (const field of fields) {
      if (results[field]?.value) {
        // Sanitize to prevent XSS
        results[field].value = sanitizeText(results[field].value);
      }
    }
  }

  /**
   * Detect the platform from URL
   * @returns {string} Platform identifier
   */
  detectPlatform() {
    const url = this.win.location?.href || '';

    const platforms = {
      'linkedin': /linkedin\.com/i,
      'indeed': /indeed\.com/i,
      'glassdoor': /glassdoor\.(com|co\.uk)/i,
      'greenhouse': /greenhouse\.io/i,
      'lever': /lever\.(co|com)/i,
      'workday': /(myworkdayjobs|workday)\.com/i,
      'icims': /icims\.com/i,
      'smartrecruiters': /smartrecruiters\.com/i,
      'naukri': /naukri\.com/i,
      'ashby': /ashby(hq|prd)\.com/i
    };

    for (const [platform, pattern] of Object.entries(platforms)) {
      if (pattern.test(url)) return platform;
    }

    return 'other';
  }

  /**
   * Get extraction result as flat object
   * @returns {Promise<Object>} Flat extraction result
   */
  async extractFlat() {
    const results = await this.extract();
    return flattenResults(results);
  }

  /**
   * Quick extraction (DOM only, no ML/LLM)
   * @returns {Promise<Object>} Quick extraction result
   */
  async extractQuick() {
    const domResults = await this.runDOMStrategies();
    const candidates = selectBestCandidates(domResults);
    this.validateResults(candidates);
    return candidates;
  }
}

/**
 * Create a configured extraction pipeline
 * @param {Object} options - Pipeline options
 * @returns {ExtractionPipeline} Configured pipeline
 */
function createPipeline(options = {}) {
  return new ExtractionPipeline(options);
}

/**
 * Run extraction with default settings
 * @param {Object} options - Options
 * @returns {Promise<Object>} Extraction results
 */
async function extract(options = {}) {
  const pipeline = createPipeline(options);
  return pipeline.extract();
}

/**
 * Run quick extraction (DOM only)
 * @returns {Promise<Object>} Quick extraction results
 */
async function extractQuick() {
  const pipeline = createPipeline();
  return pipeline.extractQuick();
}

export {
  ExtractionPipeline,
  createPipeline,
  extract,
  extractQuick,
  STRATEGIES,
  LLM_FALLBACK_THRESHOLD
};

// Also export utilities for use by consumers
export { calculateOverallConfidence, getConfidenceLevel } from './confidence.js';
export { flattenResults, toJobInfo } from './merger.js';
export { cleanText, sanitizeText } from './validators.js';
