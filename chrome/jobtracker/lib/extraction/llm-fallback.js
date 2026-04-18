/**
 * LLM Fallback Extraction Module
 * Uses LLM (Claude Haiku) for job extraction when confidence is low
 */

// LLM extraction prompt template
const EXTRACTION_PROMPT = `Extract job posting information from the following text. Return a JSON object with these fields:
- position: the job title/position name
- company: the company/organization name
- location: job location (city, state, country, or "Remote")
- salary: salary range if mentioned (include currency)

If a field is not found in the text, use an empty string.
Only return valid JSON, no explanations.

Text:
{TEXT}`;

// Maximum text length to send to LLM
const MAX_TEXT_LENGTH = 8000;

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * LLM Fallback extractor class
 */
class LLMFallback {
  constructor(options = {}) {
    this.apiKey = options.apiKey || null;
    this.model = options.model || 'claude-3-haiku-20240307';
    this.maxTokens = options.maxTokens || 500;
    this.cache = new Map();
  }

  /**
   * Extract job information using LLM
   * @param {string} text - Page text to extract from
   * @param {Object} currentResults - Current extraction results (for context)
   * @returns {Promise<Object|null>} Extracted job data
   */
  async extract(text, currentResults = {}) {
    if (!text || text.length < 50) {
      return null;
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Truncate text if needed
      const truncatedText = text.substring(0, MAX_TEXT_LENGTH);

      // Build prompt
      const prompt = EXTRACTION_PROMPT.replace('{TEXT}', truncatedText);

      // Call LLM API
      const result = await this.callLLM(prompt);

      if (result) {
        // Cache the result
        this.setCache(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('[LLM Fallback] Extraction error:', error.message);
      return null;
    }
  }

  /**
   * Call the LLM API
   * @param {string} prompt - The prompt to send
   * @returns {Promise<Object|null>} Parsed response
   */
  async callLLM(prompt) {
    // This method should be overridden or configured with actual API call
    // For browser extension, this typically goes through background script

    // If we're in a content script context, send to background
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'LLM_EXTRACT_JOB',
          payload: { prompt }
        });

        if (response?.success && response.data) {
          return this.parseResponse(response.data);
        }
      } catch (e) {
        console.debug('[LLM Fallback] Background message failed:', e.message);
      }
    }

    return null;
  }

  /**
   * Parse LLM response into structured data
   * @param {string|Object} response - LLM response
   * @returns {Object|null} Parsed job data
   */
  parseResponse(response) {
    if (!response) return null;

    // If already an object, validate and return
    if (typeof response === 'object') {
      return this.validateResponse(response);
    }

    // Try to parse JSON from string
    try {
      // Handle common LLM response patterns
      let jsonStr = response;

      // Extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // Try to find JSON object in the response
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      return this.validateResponse(parsed);
    } catch (e) {
      console.debug('[LLM Fallback] Failed to parse response:', e.message);
      return null;
    }
  }

  /**
   * Validate and clean the parsed response
   * @param {Object} data - Parsed data
   * @returns {Object|null} Validated data
   */
  validateResponse(data) {
    if (!data || typeof data !== 'object') return null;

    const result = {
      position: '',
      company: '',
      location: '',
      salary: ''
    };

    // Extract and validate each field
    if (data.position && typeof data.position === 'string') {
      result.position = this.cleanValue(data.position);
    } else if (data.title && typeof data.title === 'string') {
      result.position = this.cleanValue(data.title);
    }

    if (data.company && typeof data.company === 'string') {
      result.company = this.cleanValue(data.company);
    } else if (data.organization && typeof data.organization === 'string') {
      result.company = this.cleanValue(data.organization);
    }

    if (data.location && typeof data.location === 'string') {
      result.location = this.cleanValue(data.location);
    }

    if (data.salary && typeof data.salary === 'string') {
      result.salary = this.cleanValue(data.salary);
    } else if (data.compensation && typeof data.compensation === 'string') {
      result.salary = this.cleanValue(data.compensation);
    }

    // Only return if we got at least one meaningful field
    if (result.position || result.company) {
      return result;
    }

    return null;
  }

  /**
   * Clean extracted value
   * @param {string} value - Value to clean
   * @returns {string} Cleaned value
   */
  cleanValue(value) {
    if (!value) return '';
    return value
      .replace(/^["']|["']$/g, '')  // Remove quotes
      .replace(/\s+/g, ' ')          // Normalize whitespace
      .trim()
      .substring(0, 200);            // Limit length
  }

  /**
   * Generate cache key from text
   * @param {string} text - Text to hash
   * @returns {string} Cache key
   */
  getCacheKey(text) {
    // Simple hash of first 500 chars
    const sample = text.substring(0, 500);
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `llm_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get from cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached value
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    return null;
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  setCache(key, data) {
    // Limit cache size
    if (this.cache.size > 100) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 20; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Create an LLM extraction function for use with ExtractionPipeline
 * @param {Object} options - Options
 * @returns {Function} Extraction function
 */
function createLLMExtractor(options = {}) {
  const llm = new LLMFallback(options);

  return async (text, currentResults) => {
    return llm.extract(text, currentResults);
  };
}

/**
 * Check if LLM extraction should be used based on current results
 * @param {Object} results - Current extraction results
 * @param {number} threshold - Confidence threshold (default: 0.6)
 * @returns {boolean} True if LLM should be used
 */
function shouldUseLLM(results, threshold = 0.6) {
  // Use LLM if overall confidence is low
  if (results.overallConfidence < threshold) {
    return true;
  }

  // Use LLM if critical fields are missing
  if (!results.position?.value || !results.company?.value) {
    return true;
  }

  // Use LLM if critical fields have very low confidence
  if (results.position?.confidence < 0.3 || results.company?.confidence < 0.3) {
    return true;
  }

  return false;
}

export {
  LLMFallback,
  createLLMExtractor,
  shouldUseLLM,
  EXTRACTION_PROMPT,
  MAX_TEXT_LENGTH,
  CACHE_TTL
};
