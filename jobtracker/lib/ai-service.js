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
    this.isReady = false;
    this.mlAvailable = false;
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    this.loadingPromise = null;
    this.onModelLoadProgress = null;
  }

  /**
   * Initialize the AI worker
   * Call this before using any AI features
   */
  async init() {
    if (this.loadingPromise) return this.loadingPromise;
    if (this.isReady) return true;

    this.loadingPromise = new Promise((resolve, reject) => {
      try {
        // Create worker from the worker file
        const workerUrl = chrome.runtime.getURL('lib/ai-worker.js');
        this.worker = new Worker(workerUrl, { type: 'module' });

        this.worker.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.worker.onerror = (error) => {
          console.error('[AI Service] Worker error:', error);
          reject(error);
        };

        this.isReady = true;
        console.log('[AI Service] Worker initialized');

        // Check if Transformers.js is available (don't block init)
        this.checkMLAvailability().then(available => {
          this.mlAvailable = available;
          console.log(`[AI Service] ML features: ${available ? 'enabled' : 'disabled (regex-only mode)'}`);
        }).catch(() => {
          this.mlAvailable = false;
        });

        resolve(true);
      } catch (error) {
        console.error('[AI Service] Failed to initialize:', error);
        reject(error);
      }
    });

    return this.loadingPromise;
  }

  /**
   * Handle messages from the worker
   */
  handleMessage(event) {
    const { type, requestId, result, error, payload } = event.data;

    // Handle progress updates
    if (type === 'MODEL_LOADING_PROGRESS') {
      if (this.onModelLoadProgress) {
        this.onModelLoadProgress(payload);
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

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
      };

      this.pendingRequests.set(requestId, {
        resolve: (result) => { cleanup(); resolve(result); },
        reject: (error) => { cleanup(); reject(error); }
      });

      this.worker.postMessage({ type, payload, requestId });

      // Timeout after 120 seconds (increased for model loading)
      timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          cleanup();
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
   */
  isMLAvailable() {
    return this.mlAvailable;
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
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.loadingPromise = null;
      console.log('[AI Service] Worker terminated');
    }
  }
}

// Create singleton instance
const aiService = new AIService();

// Export for use in other modules
export { aiService, AIService };
