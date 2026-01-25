/**
 * AI Service - Main thread interface to AI Worker
 * Provides easy-to-use API for ML features
 *
 * Memory-optimized for 4GB RAM systems:
 * - Lazy model loading
 * - Automatic unloading after inactivity
 * - Regex-first approach (ML optional)
 */

class AIService {
  constructor() {
    this.worker = null;
    this.workerCreated = false;
    this.isReady = false;
    this.isInitialized = false; // Separate flag for full initialization
    this.mlAvailable = false; // Default to false until availability check completes
    this.mlAvailabilityPromise = null; // Promise for ML availability check
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    this.loadingPromise = null;
    this.onModelLoadProgress = null;
    this.staleRequestCleanupInterval = null;
  }

  /**
   * Initialize the AI worker
   * Call this before using any AI features
   */
  async init() {
    // Prevent multiple worker creation with synchronous flag check
    if (this.workerCreated) {
      return this.loadingPromise || true;
    }

    if (this.loadingPromise) return this.loadingPromise;
    if (this.isReady && this.isInitialized) return true;

    // Set flag BEFORE any async operations
    this.workerCreated = true;

    this.loadingPromise = new Promise((resolve, reject) => {
      try {
        // Create worker from the worker file
        const workerUrl = chrome.runtime.getURL('lib/ai-worker.js');
        this.worker = new Worker(workerUrl, { type: 'module' });

        // Set up message handler BEFORE marking as ready
        this.worker.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.worker.onerror = (error) => {
          console.log('[AI Service] Worker error:', error);
          this.isReady = false;
          this.isInitialized = false;
          reject(error);
        };

        // Start periodic cleanup of stale pending requests (every 60 seconds)
        if (!this.staleRequestCleanupInterval) {
          this.staleRequestCleanupInterval = setInterval(() => {
            this.cleanupStaleRequests();
          }, 60000);
        }

        // Only mark as ready after all handlers are configured
        this.isReady = true;
        console.log('[AI Service] Worker initialized');

        // Check if Transformers.js is available (don't block init, but store promise for callers who need to wait)
        this.mlAvailabilityPromise = this.checkMLAvailability().then(available => {
          this.mlAvailable = available;
          this.isInitialized = true; // Fully initialized after ML check completes
          console.log(`[AI Service] ML features: ${available ? 'enabled' : 'disabled (regex-only mode)'}`);
          return available;
        }).catch(() => {
          this.mlAvailable = false;
          this.isInitialized = true; // Still initialized, just without ML
          return false;
        });

        resolve(true);
      } catch (error) {
        console.log('[AI Service] Failed to initialize:', error);
        this.isReady = false;
        this.isInitialized = false;
        reject(error);
      }
    });

    return this.loadingPromise;
  }

  /**
   * Cleanup stale pending requests (older than 2 minutes)
   * This prevents memory leaks from requests that never got responses
   */
  cleanupStaleRequests() {
    const now = Date.now();
    const staleThreshold = 120000; // 2 minutes

    for (const [requestId, pending] of this.pendingRequests.entries()) {
      // Validate createdAt is a valid number to avoid NaN comparisons
      const createdAt = pending.createdAt;
      if (typeof createdAt !== 'number' || isNaN(createdAt)) {
        // Invalid createdAt - clean up immediately to prevent memory leak
        console.warn(`[AI Service] Cleaning up request ${requestId} with invalid createdAt`);
        this.pendingRequests.delete(requestId);
        continue;
      }

      if ((now - createdAt) > staleThreshold) {
        console.log(`[AI Service] Cleaning up stale request ${requestId}`);
        this.pendingRequests.delete(requestId);
        // Don't reject - the caller's timeout will handle that
      }
    }
  }

  /**
   * Handle messages from the worker
   */
  handleMessage(event) {
    const { type, requestId, result, error, payload } = event.data;

    // Handle progress updates - dispatch custom events for global listeners
    if (type === 'MODEL_LOADING_PROGRESS') {
      if (this.onModelLoadProgress) {
        this.onModelLoadProgress(payload);
      }
      // Dispatch global event for UI components to listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('model-download-progress', {
          detail: payload
        }));
      }
      return;
    }

    // Handle model loading completion
    if (type === 'MODEL_LOADING_COMPLETE') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('model-download-complete', {
          detail: payload
        }));
      }
      return;
    }

    // Handle model loading errors
    if (type === 'MODEL_LOADING_ERROR') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('model-download-error', {
          detail: payload
        }));
      }
      return;
    }

    // Handle request responses
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);

    if (type === 'ERROR') {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  }

  /**
   * Send a message to the worker and wait for response
   */
  async sendMessage(type, payload = {}) {
    await this.init();

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;
      let timeoutId = null;
      let isCleanedUp = false; // Atomic flag to prevent double execution

      const cleanup = () => {
        // Atomic check-and-set to prevent race condition
        if (isCleanedUp) return false;
        isCleanedUp = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.pendingRequests.delete(requestId);
        return true;
      };

      this.pendingRequests.set(requestId, {
        createdAt: Date.now(), // Track creation time for stale cleanup
        resolve: (result) => {
          if (cleanup()) resolve(result);
        },
        reject: (error) => {
          if (cleanup()) reject(error);
        }
      });

      // Wrap postMessage in try-catch to handle immediate failures
      try {
        this.worker.postMessage({ type, payload, requestId });
      } catch (postMessageError) {
        // Clean up and reject immediately if postMessage fails
        if (cleanup()) {
          reject(new Error(`Failed to send message to worker: ${postMessageError.message}`));
        }
        return;
      }

      // Timeout after 120 seconds (increased for model loading)
      timeoutId = setTimeout(() => {
        // Only reject if cleanup succeeds (wasn't already handled)
        if (cleanup()) {
          reject(new Error('AI request timed out'));
        }
      }, 120000);
    });
  }

  /**
   * Parse resume text and extract structured data
   * @param {string} text - Resume text content
   * @param {boolean} useML - Whether to use ML models (default: true)
   * @returns {Object} Extracted resume data
   */
  async parseResume(text, useML = true) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid resume text');
    }

    return this.sendMessage('PARSE_RESUME', { text, useML });
  }

  /**
   * Parse job posting and extract structured data
   * @param {string} text - Job posting text content
   * @param {boolean} useML - Whether to use ML models (default: true)
   * @returns {Object} Extracted job data
   */
  async parseJobPosting(text, useML = true) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid job posting text');
    }

    return this.sendMessage('PARSE_JOB', { text, useML });
  }

  /**
   * Extract data using only regex (fast, no ML)
   * @param {string} text - Text to parse
   * @returns {Object} Extracted data
   */
  async extractBasic(text) {
    return this.sendMessage('EXTRACT_REGEX', { text });
  }

  /**
   * Extract skills from text
   * @param {string} text - Text to analyze
   * @returns {Object} Skills grouped by category
   */
  async extractSkills(text) {
    return this.sendMessage('EXTRACT_SKILLS', { text });
  }

  /**
   * Extract named entities (people, organizations, locations)
   * @param {string} text - Text to analyze
   * @returns {Object} Entities grouped by type
   */
  async extractEntities(text) {
    return this.sendMessage('EXTRACT_ENTITIES', { text });
  }

  /**
   * Suggest tags based on text content
   * @param {string} text - Text to analyze
   * @param {number} threshold - Similarity threshold (0-1, default: 0.3)
   * @returns {string[]} Suggested tags
   */
  async suggestTags(text, threshold = 0.3) {
    return this.sendMessage('SUGGEST_TAGS', { text, threshold });
  }

  /**
   * Generate embeddings for text
   * @param {string} text - Text to embed
   * @returns {number[]} Embedding vector
   */
  async getEmbeddings(text) {
    return this.sendMessage('GET_EMBEDDINGS', { text });
  }

  /**
   * Calculate similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  async calculateSimilarity(text1, text2) {
    const [emb1, emb2] = await Promise.all([
      this.getEmbeddings(text1),
      this.getEmbeddings(text2)
    ]);

    return this.sendMessage('CALCULATE_SIMILARITY', {
      embedding1: emb1,
      embedding2: emb2
    });
  }

  /**
   * Match resume skills against job requirements
   * @param {string} resumeText - Resume content
   * @param {string} jobText - Job posting content
   * @returns {Object} Match analysis
   */
  async matchResumeToJob(resumeText, jobText) {
    const [resumeData, jobData, similarity] = await Promise.all([
      this.parseResume(resumeText, false), // Regex only for speed
      this.parseJobPosting(jobText, false),
      this.calculateSimilarity(resumeText, jobText)
    ]);

    // Find matching and missing skills
    const resumeSkillsFlat = Object.values(resumeData.skills).flat();
    const jobSkillsFlat = Object.values(jobData.skills).flat();

    const matchingSkills = resumeSkillsFlat.filter(s =>
      jobSkillsFlat.some(js => js.toLowerCase() === s.toLowerCase())
    );

    const missingSkills = jobSkillsFlat.filter(s =>
      !resumeSkillsFlat.some(rs => rs.toLowerCase() === s.toLowerCase())
    );

    return {
      overallSimilarity: similarity,
      matchingSkills,
      missingSkills,
      resumeSkillCount: resumeSkillsFlat.length,
      jobSkillCount: jobSkillsFlat.length,
      matchPercentage: jobSkillsFlat.length > 0
        ? Math.round((matchingSkills.length / jobSkillsFlat.length) * 100)
        : 0
    };
  }

  /**
   * Preload models for faster subsequent use
   * @param {boolean} includeNER - Whether to load NER model too
   */
  async preloadModels(includeNER = false) {
    return this.sendMessage('PRELOAD_MODELS', { includeNER });
  }

  /**
   * Unload models to free memory
   */
  async unloadModels() {
    return this.sendMessage('UNLOAD_MODELS');
  }

  /**
   * Get worker status
   */
  async getStatus() {
    return this.sendMessage('GET_STATUS');
  }

  /**
   * Check if ML features are available
   */
  async checkMLAvailability() {
    try {
      const result = await this.sendMessage('CHECK_AVAILABILITY');
      return result.transformersAvailable;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if ML is available (sync check after init)
   * WARNING: This may return false if availability check is still pending.
   * For accurate results, use waitForMLAvailability() instead.
   * @returns {boolean} Whether ML features are currently known to be available
   */
  isMLAvailable() {
    // Only return true if we're fully initialized AND ML is available
    return this.isInitialized && this.mlAvailable;
  }

  /**
   * Check if the service is fully initialized (including ML availability check)
   * @returns {boolean} Whether initialization is complete
   */
  isFullyInitialized() {
    return this.isReady && this.isInitialized;
  }

  /**
   * Wait for ML availability check to complete
   * This is the recommended way to check ML availability.
   * @returns {Promise<boolean>} Whether ML features are available
   */
  async waitForMLAvailability() {
    // Ensure init() completes first, which sets up mlAvailabilityPromise
    await this.init();

    // If already fully initialized, return cached result
    if (this.isInitialized) {
      return this.mlAvailable;
    }

    // Wait for ML availability check to complete
    // This handles the race condition where init() returns before mlAvailabilityPromise is set
    if (this.mlAvailabilityPromise) {
      return this.mlAvailabilityPromise;
    }

    // If somehow no promise exists and not initialized, return false safely
    console.warn('[AI Service] waitForMLAvailability called in unexpected state');
    return false;
  }

  /**
   * Set callback for model loading progress
   * @param {function} callback - Called with { model, progress }
   */
  setProgressCallback(callback) {
    this.onModelLoadProgress = callback;
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      // Clear the stale request cleanup interval
      if (this.staleRequestCleanupInterval) {
        clearInterval(this.staleRequestCleanupInterval);
        this.staleRequestCleanupInterval = null;
      }

      // Reject all pending requests to prevent memory leaks and hung async operations
      this.pendingRequests.forEach(pending => {
        pending.reject(new Error('Worker terminated'));
      });
      this.pendingRequests.clear();

      // Clear the model loading progress callback to prevent memory leaks
      this.onModelLoadProgress = null;

      // Reset worker creation flag to allow re-initialization
      this.workerCreated = false;

      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.isInitialized = false;
      this.loadingPromise = null;
      this.mlAvailabilityPromise = null;
      console.log('[AI Service] Worker terminated');
    }
  }

  // ============================================
  // HYBRID EXTRACTION METHODS (for NLP Pipeline)
  // ============================================

  /**
   * Fast extraction without ML (regex + skill matching)
   * Use this when speed is priority over accuracy
   * @param {string} text - Text to analyze
   * @returns {Object} Basic extraction result
   */
  async extractFast(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text');
    }
    return this.sendMessage('EXTRACT_FAST', { text });
  }

  /**
   * Extract entities only using BERT NER
   * Use this as fallback when Compromise.js misses data
   * @param {string} text - Text to analyze
   * @returns {Object} Entity extraction result
   */
  async extractEntitiesOnly(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text');
    }
    return this.sendMessage('EXTRACT_ENTITIES_ONLY', { text });
  }

  /**
   * Hybrid job extraction (integrates with main thread NLP)
   * @param {string} text - Job posting text
   * @param {Object} options - Options
   * @param {boolean} options.useNER - Whether to use BERT NER
   * @param {Object} options.existingData - Data from main thread NLP
   * @returns {Object} Extracted job information
   */
  async extractJobHybrid(text, options = {}) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text');
    }
    return this.sendMessage('EXTRACT_JOB_HYBRID', {
      text,
      useNER: options.useNER !== false,
      existingData: options.existingData || {}
    });
  }

  /**
   * Hybrid resume extraction (integrates with main thread NLP)
   * @param {string} text - Resume text
   * @param {Object} options - Options
   * @param {boolean} options.useNER - Whether to use BERT NER
   * @param {Object} options.existingData - Data from main thread NLP
   * @returns {Object} Extracted resume information
   */
  async extractResumeHybrid(text, options = {}) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text');
    }
    return this.sendMessage('EXTRACT_RESUME_HYBRID', {
      text,
      useNER: options.useNER !== false,
      existingData: options.existingData || {}
    });
  }

  // ============================================
  // LLM EXTRACTION METHODS
  // ============================================

  /**
   * Extract job information using LLM
   * This is a fallback for when ML extraction has low confidence
   * @param {string} text - Job posting text
   * @param {Object} currentResults - Current extraction results (optional)
   * @returns {Promise<Object|null>} Extracted job data
   */
  async extractJobWithLLM(text, currentResults = {}) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text');
    }

    // Truncate text to reasonable length for LLM
    const maxLength = 8000;
    const truncatedText = text.substring(0, maxLength);

    try {
      const result = await this.sendMessage('LLM_EXTRACT_JOB', {
        text: truncatedText,
        currentResults
      });

      return result;
    } catch (error) {
      console.log('[AI Service] LLM extraction failed:', error.message);
      return null;
    }
  }
}

// Create singleton instance
const aiService = new AIService();

// Export for use in other modules
export { aiService, AIService };
