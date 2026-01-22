/**
 * AI Job Extractor
 * Uses ML to extract job information from any webpage
 * Always enabled for unsupported sites when user clicks "Track"
 * The AI settings toggle controls other features, not job extraction
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerAIExtractorInitialized) return;
  window.__jobTrackerAIExtractorInitialized = true;

  /**
   * Extract all visible text from the page (optimized for job postings)
   */
  function extractPageText() {
    // Priority elements for job postings
    const prioritySelectors = [
      'article',
      '[role="main"]',
      'main',
      '.job-description',
      '.job-details',
      '.job-posting',
      '.job-content',
      '[class*="job"]',
      '[class*="posting"]',
      '[class*="description"]'
    ];

    let mainContent = '';

    // Try to find the main job content area
    for (const selector of prioritySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.length > 200) {
        mainContent = element.textContent;
        break;
      }
    }

    // Fallback to body if no specific content found
    if (!mainContent) {
      mainContent = document.body.textContent;
    }

    // Clean up the text
    return mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 10000); // Limit to 10k chars for processing
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
              position: item.title || '',
              company: item.hiringOrganization?.name || '',
              location: extractLocation(item.jobLocation),
              salary: extractSalary(item),
              jobType: item.employmentType || '',
              description: item.description || '',
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
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_EXTRACT_JOB',
        payload: { text }
      });

      if (response?.success && response.data) {
        return response.data;
      }

      if (response?.error) {
        console.log('JobTracker AI: Extraction error:', response.error);
      }
    } catch (error) {
      console.log('JobTracker AI: Extraction failed:', error.message || error);
    }
    return null;
  }

  /**
   * Main extraction function - combines all methods
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

    // 1. Try JSON-LD first (most reliable, no AI needed)
    const jsonLdData = extractJsonLd();
    if (jsonLdData) {
      Object.assign(jobInfo, jsonLdData);
      console.log('JobTracker AI: Extracted from JSON-LD:', jobInfo);
    }

    // 2. Get page text for further extraction
    const pageText = extractPageText();

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
        console.log('JobTracker AI: Enhanced with ML:', jobInfo);
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

  // Also expose a sync version for basic extraction (no AI)
  window.__jobTrackerBasicExtract = function() {
    const jsonLdData = extractJsonLd();
    const pageText = extractPageText();
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
