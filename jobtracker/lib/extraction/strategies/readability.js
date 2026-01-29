/**
 * Readability Extraction Strategy
 * Uses Readability.js to extract main content and job description
 * Confidence: 0.45
 */

const SOURCE_NAME = 'readability';
const BASE_CONFIDENCE = 0.45;

// State for Readability loading
let readabilityLoaded = false;
let readabilityLoadPromise = null;

/**
 * Load Readability.js dynamically
 * @returns {Promise<boolean>} Whether Readability was loaded
 */
async function loadReadability() {
  if (readabilityLoaded && window.Readability) return true;
  if (readabilityLoadPromise) return readabilityLoadPromise;

  readabilityLoadPromise = new Promise((resolve) => {
    try {
      // Check if already available
      if (window.Readability) {
        readabilityLoaded = true;
        resolve(true);
        return;
      }

      // Load from extension
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('lib/vendor/readability.js');

      const timeout = setTimeout(() => {
        console.debug('[Readability] Load timeout');
        resolve(false);
      }, 5000);

      script.onload = () => {
        clearTimeout(timeout);
        if (window.Readability) {
          readabilityLoaded = true;
          console.debug('[Readability] Loaded successfully');
          resolve(true);
        } else {
          console.debug('[Readability] Loaded but not available');
          resolve(false);
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        console.debug('[Readability] Load failed');
        resolve(false);
      };

      document.head.appendChild(script);
    } catch (e) {
      console.debug('[Readability] Load error:', e.message);
      resolve(false);
    }
  });

  return readabilityLoadPromise;
}

/**
 * Extract job data using Readability.js
 * @param {Document} doc - The document to extract from
 * @returns {Object} Extraction results with candidates per field
 */
async function extract(doc = document) {
  const results = {
    position: [],
    company: [],
    location: [],
    salary: [],
    jobDescription: [],
    metadata: {
      source: SOURCE_NAME,
      confidence: BASE_CONFIDENCE,
      timing: 0
    }
  };

  const startTime = performance.now();

  try {
    // Load Readability if needed
    const loaded = await loadReadability();

    if (!loaded || !window.Readability) {
      // Fallback: basic content extraction without Readability
      extractBasicContent(doc, results);
    } else {
      // Use Readability for extraction
      await extractWithReadability(doc, results);
    }

  } catch (e) {
    console.log('[Readability] Extraction error:', e.message);
    // Try fallback
    extractBasicContent(doc, results);
  }

  results.metadata.timing = performance.now() - startTime;
  return results;
}

/**
 * Remove cookie/privacy notice elements from a document
 * @param {Document} doc - Document to clean (will be modified)
 */
function removeCookieElements(doc) {
  const cookieSelectors = [
    '[class*="cookie"]',
    '[class*="Cookie"]',
    '[class*="privacy"]',
    '[class*="Privacy"]',
    '[class*="consent"]',
    '[class*="Consent"]',
    '[class*="gdpr"]',
    '[class*="GDPR"]',
    '[id*="cookie"]',
    '[id*="Cookie"]',
    '[id*="privacy"]',
    '[id*="consent"]',
    '[id*="gdpr"]',
    '[role="dialog"][aria-modal="true"]',
    '[data-testid*="cookie"]',
    '[data-testid*="consent"]'
  ];

  for (const selector of cookieSelectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => {
        // Only remove if it looks like a cookie notice (small or contains cookie keywords)
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('cookie') || text.includes('privacy') ||
            text.includes('consent') || text.includes('gdpr') ||
            el.offsetHeight < 300) {
          el.remove();
        }
      });
    } catch (e) {
      // Ignore invalid selector errors
    }
  }
}

/**
 * Extract using Readability.js
 * @param {Document} doc - Document to extract from
 * @param {Object} results - Results to populate
 */
async function extractWithReadability(doc, results) {
  try {
    // Clone document to avoid modifying original
    const documentClone = doc.cloneNode(true);

    // Remove cookie/privacy elements before extraction
    removeCookieElements(documentClone);

    // Configure Readability
    const reader = new window.Readability(documentClone, {
      charThreshold: 100,
      classesToPreserve: [
        'job-description', 'job-details', 'posting-description',
        'requirements', 'qualifications', 'responsibilities',
        'job-title', 'company-name', 'location'
      ],
      keepClasses: true
    });

    const article = reader.parse();

    if (!article) {
      console.debug('[Readability] No article parsed');
      return;
    }

    // Job description from content
    if (article.textContent && article.textContent.length > 200) {
      const cleanContent = cleanText(article.textContent);
      results.jobDescription.push({
        value: cleanContent.substring(0, 15000),
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.9,
        selector: 'readability.textContent',
        metadata: {
          title: article.title,
          excerpt: article.excerpt,
          byline: article.byline,
          siteName: article.siteName
        }
      });
    }

    // Try to extract position from article title
    if (article.title && article.title.length > 3 && article.title.length < 150) {
      // Check if title looks like a job title
      if (looksLikeJobTitle(article.title)) {
        results.position.push({
          value: article.title,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.75,
          selector: 'readability.title'
        });
      }
    }

    // Company from siteName or byline
    if (article.siteName && article.siteName.length > 1 && article.siteName.length < 100) {
      results.company.push({
        value: article.siteName,
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.70,
        selector: 'readability.siteName'
      });
    }

    if (article.byline && article.byline.length > 1 && article.byline.length < 100) {
      // Byline might be author or company
      if (!looksLikePersonName(article.byline)) {
        results.company.push({
          value: article.byline,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.60,
          selector: 'readability.byline'
        });
      }
    }

    // Extract additional info from the HTML content
    if (article.content) {
      extractFromHtmlContent(article.content, results);
    }

  } catch (e) {
    console.debug('[Readability] Parse error:', e.message);
  }
}

/**
 * Extract additional info from Readability HTML output
 * @param {string} html - HTML content from Readability
 * @param {Object} results - Results to populate
 */
function extractFromHtmlContent(html, results) {
  try {
    // Parse HTML to find structured elements
    const parser = new DOMParser();
    const contentDoc = parser.parseFromString(html, 'text/html');

    // Look for job-related elements in the content
    const jobTitleElements = contentDoc.querySelectorAll(
      '.job-title, [class*="jobTitle"], h1, h2[class*="title"]'
    );
    for (const el of jobTitleElements) {
      const text = el.textContent?.trim();
      if (text && looksLikeJobTitle(text) && text.length < 150) {
        results.position.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.65,
          selector: 'readability.content.jobTitle'
        });
        break;
      }
    }

    // Look for location
    const locationElements = contentDoc.querySelectorAll(
      '.location, [class*="location"], address'
    );
    for (const el of locationElements) {
      const text = el.textContent?.trim();
      if (text && text.length > 2 && text.length < 150) {
        results.location.push({
          value: text,
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.60,
          selector: 'readability.content.location'
        });
        break;
      }
    }

    // Look for salary in content
    const salaryMatch = html.match(/\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\s*(?:per\s+)?(?:year|yr|annually|k|K))?/i);
    if (salaryMatch) {
      results.salary.push({
        value: salaryMatch[0],
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.55,
        selector: 'readability.content.salaryRegex'
      });
    }

  } catch (e) {
    console.debug('[Readability] HTML parsing error:', e.message);
  }
}

/**
 * Basic content extraction without Readability
 * @param {Document} doc - Document
 * @param {Object} results - Results to populate
 */
function extractBasicContent(doc, results) {
  // Clone document to avoid modifying original
  const docClone = doc.cloneNode(true);

  // Remove cookie/privacy elements before extraction
  removeCookieElements(docClone);

  // Try common content selectors
  const contentSelectors = [
    'main',
    '[role="main"]',
    'article',
    '.content',
    '.main-content',
    '#content',
    '.job-details',
    '.posting-content'
  ];

  for (const selector of contentSelectors) {
    const el = docClone.querySelector(selector);
    if (el) {
      const text = el.textContent?.trim();
      if (text && text.length > 200) {
        results.jobDescription.push({
          value: cleanText(text).substring(0, 10000),
          source: SOURCE_NAME,
          confidence: BASE_CONFIDENCE * 0.6,
          selector: selector
        });
        break;
      }
    }
  }

  // Fallback to body
  if (results.jobDescription.length === 0) {
    const bodyText = docClone.body?.textContent?.trim();
    if (bodyText && bodyText.length > 200) {
      results.jobDescription.push({
        value: cleanText(bodyText).substring(0, 8000),
        source: SOURCE_NAME,
        confidence: BASE_CONFIDENCE * 0.4,
        selector: 'body'
      });
    }
  }
}

/**
 * Clean extracted text
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

/**
 * Check if text looks like a job title
 */
function looksLikeJobTitle(text) {
  const patterns = [
    /engineer/i, /developer/i, /designer/i, /manager/i, /director/i,
    /analyst/i, /specialist/i, /lead/i, /architect/i, /consultant/i
  ];
  return patterns.some(p => p.test(text));
}

/**
 * Check if text looks like a person's name
 */
function looksLikePersonName(text) {
  // Simple heuristic: 2-3 capitalized words
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every(w => /^[A-Z][a-z]+$/.test(w));
}

/**
 * Check if the strategy is applicable
 */
function isApplicable(doc = document) {
  // Always applicable as a fallback
  return true;
}

/**
 * Check if Readability is available
 */
function isReadabilityAvailable() {
  return readabilityLoaded && !!window.Readability;
}

export {
  extract,
  isApplicable,
  SOURCE_NAME,
  BASE_CONFIDENCE,
  loadReadability,
  isReadabilityAvailable,
  extractWithReadability,
  extractBasicContent
};
