/**
 * Readability Extractor
 * Clean content extraction from any webpage using Mozilla Readability
 * Returns structured content: title, content, excerpt, siteName
 */

// Readability will be loaded dynamically
let Readability = null;
let loadingPromise = null;

/**
 * Load Mozilla Readability dynamically
 * Handles both content script and regular web page contexts
 */
async function loadReadability() {
  if (Readability) return Readability;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Check if already loaded globally
      if (typeof window !== 'undefined' && window.Readability) {
        Readability = window.Readability;
        return Readability;
      }

      // Verify we have DOM access
      if (typeof document === 'undefined' || !document.head) {
        throw new Error('No DOM access - cannot load Readability');
      }

      // Get the URL - must use chrome.runtime.getURL for extension resources
      let url;
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        url = chrome.runtime.getURL('lib/vendor/readability.js');
      } else {
        // Fallback for non-extension context (e.g., testing)
        // Use absolute URL to avoid relative path issues
        const baseUrl = window.location.origin;
        url = `${baseUrl}/lib/vendor/readability.js`;
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          loadingPromise = null; // Clear so retry is possible
          reject(new Error('Timeout loading Readability.js'));
        }, 10000);

        script.onload = () => {
          clearTimeout(timeout);
          Readability = window.Readability;
          if (!Readability) {
            loadingPromise = null;
            reject(new Error('Readability.js loaded but Readability not available'));
            return;
          }
          console.log('[ReadabilityExtractor] Loaded successfully');
          resolve(Readability);
        };

        script.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[ReadabilityExtractor] Failed to load:', error);
          loadingPromise = null; // Clear so retry is possible
          reject(new Error('Failed to load Readability.js'));
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      loadingPromise = null; // Clear so retry is possible
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * ReadabilityExtractor class
 * Wraps Mozilla Readability for clean content extraction
 */
class ReadabilityExtractor {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the extractor by loading Readability.js
   */
  async init() {
    if (this.initialized) return;
    await loadReadability();
    this.initialized = true;
  }

  /**
   * Extract clean content from the current document
   * @param {Document} doc - Document to parse (defaults to current document clone)
   * @returns {Object} Extracted content with title, content, excerpt, siteName
   */
  async extract(doc = null) {
    await this.init();

    // Clone the document to avoid modifying the original
    // Note: We create our own clone only if no doc is provided
    const isOwnClone = !doc;
    const documentClone = doc || document.cloneNode(true);

    // Ensure it's a Document object
    if (!(documentClone instanceof Document)) {
      throw new Error('ReadabilityExtractor requires a Document object');
    }

    try {
      const reader = new Readability(documentClone, {
        // Readability options
        charThreshold: 100,
        classesToPreserve: ['job-description', 'job-details', 'posting-description']
      });

      const article = reader.parse();

      // Clean up: Help garbage collector by removing references
      // Note: documentClone will be GC'd after this function returns,
      // but we can help by removing any event listeners or clearing innerHTML
      if (isOwnClone && documentClone.body) {
        // Clear the cloned document body to help GC
        documentClone.body.innerHTML = '';
      }

      if (!article) {
        return {
          success: false,
          error: 'Could not parse content',
          title: document.title || '',
          content: '',
          textContent: '',
          excerpt: '',
          siteName: this.extractSiteName(),
          byline: null,
          length: 0
        };
      }

      return {
        success: true,
        title: article.title || document.title || '',
        content: article.content || '',
        textContent: article.textContent || '',
        excerpt: article.excerpt || '',
        siteName: article.siteName || this.extractSiteName(),
        byline: article.byline || null,
        length: article.length || 0,
        dir: article.dir || null,
        lang: article.lang || document.documentElement.lang || null
      };
    } catch (error) {
      console.error('[ReadabilityExtractor] Parse error:', error);

      // Clean up on error too
      if (isOwnClone && documentClone.body) {
        documentClone.body.innerHTML = '';
      }

      return {
        success: false,
        error: error.message,
        title: document.title || '',
        content: '',
        textContent: '',
        excerpt: '',
        siteName: this.extractSiteName(),
        byline: null,
        length: 0
      };
    }
  }

  /**
   * Extract clean text content from current page
   * Optimized for job postings
   * @returns {Object} Extracted text with metadata
   */
  async extractText() {
    const result = await this.extract();

    return {
      success: result.success,
      title: result.title,
      text: result.textContent || '',
      excerpt: result.excerpt,
      siteName: result.siteName,
      length: result.length
    };
  }

  /**
   * Extract job description specifically
   * Combines Readability with fallback selectors
   * @returns {Object} Job description content
   */
  async extractJobDescription() {
    // First try Readability
    const readabilityResult = await this.extract();

    let description = readabilityResult.textContent || '';
    let source = 'readability';

    // If Readability fails or returns very little content, try CSS selectors
    if (!description || description.length < 200) {
      const selectorResult = this.extractWithSelectors();
      if (selectorResult.length > description.length) {
        description = selectorResult;
        source = 'selectors';
      }
    }

    // Clean up the description
    description = this.cleanJobDescription(description);

    return {
      success: description.length > 100,
      description,
      title: readabilityResult.title,
      siteName: readabilityResult.siteName,
      source,
      length: description.length
    };
  }

  /**
   * Fallback extraction using CSS selectors
   * @returns {string} Extracted text
   */
  extractWithSelectors() {
    const selectors = [
      // Job description specific selectors
      '.job-description',
      '.job-details',
      '.posting-description',
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[class*="posting-description"]',
      '[class*="descriptionBody"]',
      '[data-automation="jobDescription"]',
      '[data-testid="job-description"]',

      // Generic content selectors
      'article',
      '[role="main"]',
      'main',
      '.content',
      '#content',
      '.main-content',
      '#main-content'
    ];

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 200) {
          return element.textContent.trim();
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }

    // Last resort: body text (with null check)
    if (!document.body) {
      console.warn('[ReadabilityExtractor] document.body is null');
      return '';
    }
    return document.body.textContent?.trim() || '';
  }

  /**
   * Clean job description text
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanJobDescription(text) {
    if (!text) return '';

    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Fix bullet points
      .replace(/[•·■□▪▸►]/g, '\n- ')
      // Normalize dashes
      .replace(/[–—]/g, '-')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Clean up
      .trim()
      // Limit length for processing
      .substring(0, 15000);
  }

  /**
   * Extract site name from meta tags or domain
   * @returns {string} Site name
   */
  extractSiteName() {
    // Try Open Graph
    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
    if (ogSiteName) return ogSiteName;

    // Try application name
    const appName = document.querySelector('meta[name="application-name"]')?.content;
    if (appName) return appName;

    // Fall back to domain
    try {
      const hostname = window.location.hostname;
      // Remove www. and extract main domain
      return hostname.replace(/^www\./, '').split('.')[0];
    } catch (e) {
      return '';
    }
  }

  /**
   * Check if the current page appears to be a job posting
   * @returns {Object} Detection result
   */
  async isJobPosting() {
    // Check JSON-LD for JobPosting schema
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const hasJobPosting = this.findJobPostingInJsonLd(data);
        if (hasJobPosting) {
          return { isJob: true, confidence: 1.0, source: 'json-ld' };
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }

    // Check URL patterns
    const urlPatterns = [
      /\/jobs?\//i,
      /\/careers?\//i,
      /\/positions?\//i,
      /\/openings?\//i,
      /\/apply/i,
      /\/hiring/i
    ];

    const url = window.location.href;
    for (const pattern of urlPatterns) {
      if (pattern.test(url)) {
        return { isJob: true, confidence: 0.7, source: 'url' };
      }
    }

    // Check page content for job-related keywords
    const pageText = document.body?.textContent?.toLowerCase() || '';
    const jobKeywords = [
      'job description',
      'responsibilities',
      'requirements',
      'qualifications',
      'apply now',
      'we are hiring',
      'join our team',
      'employment type',
      'salary range'
    ];

    let keywordCount = 0;
    for (const keyword of jobKeywords) {
      if (pageText.includes(keyword)) {
        keywordCount++;
      }
    }

    if (keywordCount >= 3) {
      return { isJob: true, confidence: 0.6, source: 'keywords' };
    }

    return { isJob: false, confidence: 0, source: null };
  }

  /**
   * Recursively find JobPosting in JSON-LD data
   * @param {*} data - JSON-LD data
   * @returns {boolean} Whether JobPosting was found
   */
  findJobPostingInJsonLd(data) {
    if (!data) return false;

    if (data['@type'] === 'JobPosting') return true;

    if (Array.isArray(data)) {
      return data.some(item => this.findJobPostingInJsonLd(item));
    }

    if (typeof data === 'object') {
      if (data['@graph']) {
        return this.findJobPostingInJsonLd(data['@graph']);
      }
    }

    return false;
  }

  /**
   * Extract and parse from HTML string (for testing or offline use)
   * @param {string} html - HTML string
   * @param {string} url - Original URL (optional)
   * @returns {Object} Extracted content
   */
  async extractFromHTML(html, url = '') {
    await this.init();

    // Create a new document from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Set base URL if provided
    if (url) {
      const base = doc.createElement('base');
      base.href = url;
      doc.head.prepend(base);
    }

    return this.extract(doc);
  }
}

// Export singleton instance
const readabilityExtractor = new ReadabilityExtractor();

export { ReadabilityExtractor, readabilityExtractor };
