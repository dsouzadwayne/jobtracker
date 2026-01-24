/**
 * AI Job Extractor
 * Uses ML to extract job information from any webpage
 * Always enabled for unsupported sites when user clicks "Track"
 * The AI settings toggle controls other features, not job extraction
 *
 * Now integrates with ExtractionPipeline for improved extraction with
 * confidence scoring and parallel strategy execution.
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerAIExtractorInitialized) return;
  window.__jobTrackerAIExtractorInitialized = true;

  // Readability state
  let readabilityLoaded = false;
  let readabilityLoadPromise = null;

  /**
   * Safe wrapper for chrome.runtime.sendMessage with error handling
   * @param {object} message - Message to send
   * @param {any} defaultValue - Default value to return on error
   * @returns {Promise<any>} Response or default value
   */
  async function safeSendMessage(message, defaultValue = null) {
    try {
      const result = await chrome.runtime.sendMessage(message);
      if (chrome.runtime.lastError) {
        console.log('JobTracker AI: Runtime error:', chrome.runtime.lastError.message);
        return defaultValue;
      }
      return result;
    } catch (error) {
      console.log('JobTracker AI: Message error:', error.message || error);
      return defaultValue;
    }
  }

  /**
   * Decode HTML entities in text
   * @param {string} text - Text with potential HTML entities
   * @returns {string} Decoded text
   */
  function decodeHtmlEntities(text) {
    if (!text || typeof text !== 'string') return text;

    // Use a textarea element for reliable decoding
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Clean extracted text value
   * @param {string} value - Raw extracted value
   * @returns {string} Cleaned value
   */
  function cleanValue(value) {
    if (!value || typeof value !== 'string') return '';
    return decodeHtmlEntities(value).trim();
  }

  // Extraction pipeline state
  let pipelineModule = null;
  let pipelineLoadPromise = null;

  /**
   * Load the ExtractionPipeline module
   * @returns {Promise<Object|null>} Pipeline module or null if unavailable
   */
  async function loadExtractionPipeline() {
    if (pipelineModule) return pipelineModule;
    if (pipelineLoadPromise) return pipelineLoadPromise;

    pipelineLoadPromise = (async () => {
      try {
        const module = await import(chrome.runtime.getURL('lib/extraction/index.js'));
        pipelineModule = module;
        console.log('JobTracker AI: ExtractionPipeline loaded');
        return module;
      } catch (error) {
        console.log('JobTracker AI: Using fallback extraction (pipeline unavailable)');
        return null;
      }
    })();

    return pipelineLoadPromise;
  }

  /**
   * Load Readability.js dynamically with timeout and race condition protection
   */
  async function loadReadability() {
    if (readabilityLoaded && window.Readability) return true;
    if (readabilityLoadPromise) return readabilityLoadPromise;

    readabilityLoadPromise = (async () => {
      try {
        // Double-check after acquiring the promise slot
        if (window.Readability) {
          readabilityLoaded = true;
          return true;
        }

        // Verify DOM access
        if (!document.head) {
          console.warn('JobTracker: No document.head access');
          return false;
        }

        return new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL('lib/vendor/readability.js');

          // Add timeout to prevent hanging
          const timeout = setTimeout(() => {
            console.warn('JobTracker: Readability.js load timeout');
            readabilityLoadPromise = null; // Clear for retry
            resolve(false);
          }, 10000);

          script.onload = () => {
            clearTimeout(timeout);
            if (window.Readability) {
              readabilityLoaded = true;
              console.log('JobTracker: Readability.js loaded');
              resolve(true);
            } else {
              console.warn('JobTracker: Readability.js loaded but not available');
              readabilityLoadPromise = null; // Clear for retry
              resolve(false);
            }
          };
          script.onerror = () => {
            clearTimeout(timeout);
            console.log('JobTracker: Readability.js load failed, using fallback');
            readabilityLoadPromise = null; // Clear for retry
            resolve(false);
          };
          document.head.appendChild(script);
        });
      } catch (error) {
        console.log('JobTracker: Readability load error:', error.message);
        readabilityLoadPromise = null; // Clear for retry
        return false;
      }
    })();

    return readabilityLoadPromise;
  }

  /**
   * Extract text using Readability (primary method)
   * @returns {string|null} Extracted text or null if Readability unavailable
   */
  async function extractWithReadability() {
    const loaded = await loadReadability();
    if (!loaded || !window.Readability) return null;

    try {
      // Clone the document to avoid modifying the original
      const documentClone = document.cloneNode(true);

      const reader = new window.Readability(documentClone, {
        charThreshold: 100,
        classesToPreserve: ['job-description', 'job-details', 'posting-description']
      });

      const article = reader.parse();

      if (article && article.textContent && article.textContent.length > 200) {
        console.log('JobTracker: Extracted content with Readability');
        return article.textContent
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim()
          .substring(0, 15000);
      }
    } catch (error) {
      console.log('JobTracker: Readability parse error:', error.message);
    }

    return null;
  }

  /**
   * Extract text using CSS selectors (fallback method)
   * @returns {string} Extracted text
   */
  function extractWithSelectors() {
    // Priority elements for job postings
    const prioritySelectors = [
      '.job-description',
      '.job-details',
      '.posting-description',
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[class*="posting-description"]',
      '[class*="descriptionBody"]',
      '[data-automation="jobDescription"]',
      '[data-testid="job-description"]',
      'article',
      '[role="main"]',
      'main',
      '.job-posting',
      '.job-content',
      '[class*="job"]',
      '[class*="posting"]',
      '[class*="description"]'
    ];

    let mainContent = '';

    // Try to find the main job content area
    for (const selector of prioritySelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent.length > 200) {
          mainContent = element.textContent;
          break;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }

    // Fallback to body if no specific content found
    if (!mainContent) {
      if (!document.body) {
        console.warn('JobTracker: document.body is null');
        return '';
      }
      mainContent = document.body.textContent || '';
    }

    return mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 10000);
  }

  /**
   * Extract all visible text from the page (optimized for job postings)
   * Uses Readability as primary method with CSS selector fallback
   */
  async function extractPageText() {
    // Try Readability first (better quality extraction)
    const readabilityText = await extractWithReadability();
    if (readabilityText && readabilityText.length > 200) {
      return readabilityText;
    }

    // Fallback to CSS selectors
    console.log('JobTracker: Using CSS selector fallback for extraction');
    return extractWithSelectors();
  }

  /**
   * Extract structured data from JSON-LD if available
   */
  function extractJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        // Handle array of items
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'JobPosting') {
            return {
              position: cleanValue(item.title || ''),
              company: cleanValue(item.hiringOrganization?.name || ''),
              location: cleanValue(extractLocation(item.jobLocation)),
              salary: cleanValue(extractSalary(item)),
              jobType: cleanValue(item.employmentType || ''),
              jobDescription: cleanValue(item.description || ''),
              datePosted: item.datePosted || ''
            };
          }
        }
      } catch (e) {
        // Log individual JSON-LD parsing errors for debugging
        console.log('JobTracker: Failed to parse JSON-LD script:', e.message);
        // Continue to try other JSON-LD scripts
      }
    }
    return null;
  }

  function extractLocation(jobLocation) {
    if (!jobLocation) return '';

    if (typeof jobLocation === 'string') return jobLocation;

    if (Array.isArray(jobLocation)) {
      return jobLocation.map(loc => extractLocation(loc)).filter(Boolean).join(', ');
    }

    if (jobLocation.address) {
      const addr = jobLocation.address;
      const parts = [
        addr.addressLocality,
        addr.addressRegion,
        addr.addressCountry
      ].filter(Boolean);
      return parts.join(', ');
    }

    return jobLocation.name || '';
  }

  function extractSalary(item) {
    if (!item.baseSalary) return '';

    const salary = item.baseSalary;
    if (typeof salary === 'string') return salary;

    if (salary.value) {
      const value = salary.value;
      const currency = salary.currency || 'USD';

      if (typeof value === 'object') {
        if (value.minValue && value.maxValue) {
          return `${currency} ${value.minValue} - ${value.maxValue}`;
        }
        const singleValue = value.value || value.minValue || value.maxValue;
        if (singleValue) {
          return `${currency} ${singleValue}`;
        }
        return '';
      }

      return `${currency} ${value}`;
    }

    return '';
  }

  /**
   * Use regex patterns to extract job info (fast fallback)
   */
  function extractWithRegex(text) {
    const result = {
      company: '',
      position: '',
      location: '',
      salary: '',
      jobType: '',
      remote: ''
    };

    // Salary patterns
    const salaryPatterns = [
      /\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\s*(?:per\s+)?(?:year|yr|annually|k|K))?/i,
      /(?:salary|compensation|pay)[:\s]*\$?[\d,]+\s*[-–to]+\s*\$?[\d,]+/i,
      /£[\d,]+(?:\s*[-–]\s*£?[\d,]+)?/i,
      /€[\d,]+(?:\s*[-–]\s*€?[\d,]+)?/i
    ];

    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match?.[0]) {
        result.salary = match[0];
        break;
      }
    }

    // Job type patterns
    const jobTypeMatch = text.match(/\b(full[- ]?time|part[- ]?time|contract|freelance|internship|temporary)\b/i);
    if (jobTypeMatch?.[1]) {
      result.jobType = jobTypeMatch[1].toLowerCase().replace(/[- ]/g, '-');
    }

    // Remote patterns
    const remoteMatch = text.match(/\b(remote|hybrid|on[- ]?site|in[- ]?office)\b/i);
    if (remoteMatch?.[1]) {
      result.remote = remoteMatch[1].toLowerCase().replace(/[- ]/g, '-');
    }

    return result;
  }

  /**
   * Extract job info using AI (via background script)
   */
  async function extractWithAI(text) {
    const response = await safeSendMessage({
      type: 'AI_EXTRACT_JOB',
      payload: { text }
    }, null);

    if (response?.success && response.data) {
      return response.data;
    }

    if (response?.error) {
      console.log('JobTracker AI: Extraction error:', response.error);
    }
    return null;
  }

  /**
   * Main extraction function - combines all methods
   * Now uses ExtractionPipeline when available for improved extraction
   */
  async function extractJobInfo() {
    const url = window.location.href;
    const pageTitle = document.title;

    // Start with basic info
    let jobInfo = {
      company: '',
      position: '',
      location: '',
      salary: '',
      jobType: '',
      remote: '',
      jobDescription: '',
      jobUrl: url,
      platform: 'other'
    };

    // Try the new ExtractionPipeline first
    try {
      const pipeline = await loadExtractionPipeline();
      if (pipeline) {
        // Get settings to check if LLM is enabled
        const settings = await safeSendMessage({ type: 'GET_SETTINGS' }, {});
        const llmEnabled = settings?.ai?.llmEnabled || false;

        // Create pipeline with ML extractor
        const extractor = pipeline.createPipeline({
          llmEnabled,
          mlExtractor: async (text) => {
            return extractWithAI(text);
          },
          llmExtractor: llmEnabled ? async (text, currentResults) => {
            const response = await safeSendMessage({
              type: 'LLM_EXTRACT_JOB',
              payload: { text, currentResults, url }
            }, null);
            return response?.success ? response.data : null;
          } : null
        });

        // Run extraction
        const results = await extractor.extract();

        if (results && results.overallConfidence > 0) {
          jobInfo.position = results.position?.value || '';
          jobInfo.company = results.company?.value || '';
          jobInfo.location = results.location?.value || '';
          jobInfo.salary = results.salary?.value || '';
          jobInfo.jobDescription = results.jobDescription?.value || '';
          jobInfo._confidence = results.overallConfidence;
          jobInfo._extractionMeta = results._extractionMeta;

          // Apply regex for additional fields (jobType, remote)
          const pageText = await extractPageText();
          const regexData = extractWithRegex(pageText);
          jobInfo.jobType = regexData.jobType || '';
          jobInfo.remote = regexData.remote || '';

          // If we got good results, return early
          if (jobInfo.position && jobInfo.company && results.overallConfidence > 0.5) {
            // Clean up HTML entities before returning
            jobInfo.company = cleanValue(jobInfo.company);
            jobInfo.position = cleanValue(jobInfo.position);
            jobInfo.location = cleanValue(jobInfo.location);
            jobInfo.salary = cleanValue(jobInfo.salary);
            console.log('JobTracker AI: Pipeline extraction successful (confidence:', results.overallConfidence.toFixed(2), ')');
            return jobInfo;
          }
        }
      }
    } catch (e) {
      console.log('JobTracker AI: Pipeline unavailable, using fallback extraction');
    }

    // Fallback: Legacy extraction methods
    // 1. Try JSON-LD first (most reliable, no AI needed)
    const jsonLdData = extractJsonLd();
    if (jsonLdData) {
      // Only fill missing fields
      for (const [key, value] of Object.entries(jsonLdData)) {
        if (value && !jobInfo[key]) {
          jobInfo[key] = value;
        }
      }
      console.log('JobTracker AI: Enhanced with JSON-LD');
    }

    // 2. Get page text for further extraction (async with Readability)
    const pageText = await extractPageText();

    // 3. Apply regex extraction
    const regexData = extractWithRegex(pageText);
    // Only fill in missing fields
    for (const [key, value] of Object.entries(regexData)) {
      if (value && !jobInfo[key]) {
        jobInfo[key] = value;
      }
    }

    // 4. Always use AI/ML for unsupported sites if we're missing key fields
    // This runs regardless of the AI settings toggle (which controls other AI features)
    if (!jobInfo.company || !jobInfo.position) {
      console.log('JobTracker AI: Using ML model for extraction...');

      const aiData = await extractWithAI(pageText);
      if (aiData) {
        // Fill in missing fields from AI
        for (const [key, value] of Object.entries(aiData)) {
          if (value && !jobInfo[key]) {
            jobInfo[key] = value;
          }
        }
        console.log('JobTracker AI: Enhanced with ML');
      }
    }

    // 5. Fallback: try to get position from page title
    if (!jobInfo.position && pageTitle) {
      // Common title patterns: "Job Title - Company" or "Job Title | Company"
      const titleParts = pageTitle.split(/[-|–—]/);
      if (titleParts.length >= 1 && titleParts[0]) {
        const potentialPosition = titleParts[0].trim();
        // Only use if it looks like a job title (not too long, no obvious non-job words)
        if (potentialPosition.length < 100 && !potentialPosition.match(/home|login|sign|error/i)) {
          jobInfo.position = potentialPosition;
        }
      }
      if (titleParts.length >= 2 && titleParts[1] && !jobInfo.company) {
        const potentialCompany = titleParts[1].trim();
        if (potentialCompany.length < 50) {
          jobInfo.company = potentialCompany;
        }
      }
    }

    // 6. Store job description (truncated)
    if (!jobInfo.jobDescription && pageText.length > 100) {
      jobInfo.jobDescription = pageText.substring(0, 2000);
    }

    // 7. Final cleanup - decode any HTML entities in extracted values
    jobInfo.company = cleanValue(jobInfo.company);
    jobInfo.position = cleanValue(jobInfo.position);
    jobInfo.location = cleanValue(jobInfo.location);
    jobInfo.salary = cleanValue(jobInfo.salary);

    return jobInfo;
  }

  /**
   * Show extraction in progress indicator
   */
  function showExtractionProgress() {
    let indicator = document.getElementById('jobtracker-ai-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'jobtracker-ai-indicator';
      indicator.innerHTML = `
        <div class="jobtracker-ai-indicator-content">
          <div class="jobtracker-ai-spinner"></div>
          <span>Analyzing with ML...</span>
        </div>
      `;
      indicator.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
      `;

      const style = document.createElement('style');
      style.textContent = `
        .jobtracker-ai-indicator-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .jobtracker-ai-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: jobtracker-spin 0.8s linear infinite;
        }
        @keyframes jobtracker-spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(indicator);
    }
    indicator.style.display = 'flex';
    return indicator;
  }

  function hideExtractionProgress() {
    const indicator = document.getElementById('jobtracker-ai-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // Expose the extraction function globally for the floating button and popup to use
  // ML extraction is always enabled for tracking - no settings check needed
  window.__jobTrackerAIExtract = async function() {
    const indicator = showExtractionProgress();

    try {
      const jobInfo = await extractJobInfo();
      return jobInfo;
    } finally {
      hideExtractionProgress();
    }
  };

  // Also expose a basic extraction version (uses Readability but no AI)
  window.__jobTrackerBasicExtract = async function() {
    const jsonLdData = extractJsonLd();
    const pageText = await extractPageText();
    const regexData = extractWithRegex(pageText);

    return {
      ...(jsonLdData || {}),
      ...regexData,
      jobUrl: window.location.href,
      platform: 'other'
    };
  };

  // Sync fallback for basic extraction (no Readability, no AI)
  window.__jobTrackerQuickExtract = function() {
    const jsonLdData = extractJsonLd();
    const pageText = extractWithSelectors();
    const regexData = extractWithRegex(pageText);

    return {
      ...(jsonLdData || {}),
      ...regexData,
      jobUrl: window.location.href,
      platform: 'other'
    };
  };

  console.log('JobTracker AI Extractor: Initialized');

})();
