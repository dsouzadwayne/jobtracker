/**
 * JobTracker DOM Utilities
 * Helper functions for DOM manipulation, visibility checks, and element waiting
 */

const JobTrackerDomUtils = {
  /**
   * Get cache manager reference
   */
  _getCacheManager() {
    return window.JobTrackerCacheManager;
  },

  /**
   * Get cached computed style for an element
   * @param {HTMLElement} element - Element to get style for
   * @returns {CSSStyleDeclaration} Computed style
   */
  _getCachedComputedStyle(element) {
    const cacheManager = this._getCacheManager();

    if (cacheManager) {
      const cached = cacheManager.getComputedStyle(element);
      if (cached !== null) {
        return cached;
      }
    }

    const style = window.getComputedStyle(element);

    if (cacheManager) {
      cacheManager.setComputedStyle(element, style);
    }

    return style;
  },

  /**
   * Check if element is visible on the page (with caching)
   * Uses cached computed style and checks parent chain for hidden ancestors
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} Whether the element is visible
   */
  isVisible(element) {
    if (!element) return false;

    const cacheManager = this._getCacheManager();

    // Check cache first
    if (cacheManager) {
      const cached = cacheManager.getVisibility(element);
      if (cached !== null) {
        return cached;
      }
    }

    // Check element and parent chain visibility
    const visible = this._checkVisibilityWithParents(element);

    // Cache result
    if (cacheManager) {
      cacheManager.setVisibility(element, visible);
    }

    return visible;
  },

  /**
   * Check visibility including parent chain
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} Whether element and all ancestors are visible
   */
  _checkVisibilityWithParents(element) {
    let current = element;

    // Check up to 10 levels of parent chain to avoid infinite loops
    let depth = 0;
    const maxDepth = 10;

    while (current && current !== document.body && depth < maxDepth) {
      const style = this._getCachedComputedStyle(current);

      if (style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0') {
        return false;
      }

      // Check for common hidden patterns
      if (current.hasAttribute('hidden') ||
          current.getAttribute('aria-hidden') === 'true') {
        return false;
      }

      current = current.parentElement;
      depth++;
    }

    // Check bounding rect for the original element
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Check if element is visible (uncached version for when you need fresh data)
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} Whether the element is visible
   */
  isVisibleUncached(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Check if element is disabled or readonly
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} Whether the element is disabled or readonly
   */
  isDisabledOrReadonly(element) {
    return element.disabled || element.readOnly || element.getAttribute('aria-disabled') === 'true';
  },

  /**
   * Scroll element into view smoothly
   * @param {HTMLElement} element - Element to scroll to
   */
  scrollIntoView(element) {
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  },

  /**
   * Focus element with temporary highlight effect
   * @param {HTMLElement} element - Element to focus
   * @param {string} highlightColor - CSS color for highlight (default: blue)
   * @param {number} duration - Highlight duration in ms (default: 2000)
   */
  focusWithHighlight(element, highlightColor = '#3B82F6', duration = 2000) {
    if (!element) return;

    element.focus();

    // Add temporary highlight
    const originalOutline = element.style.outline;
    element.style.outline = `2px solid ${highlightColor}`;

    setTimeout(() => {
      element.style.outline = originalOutline;
    }, duration);
  },

  /**
   * Wait for element to appear in DOM using MutationObserver
   * @param {string} selector - CSS selector to wait for
   * @param {number} timeout - Maximum wait time in ms (default: 5000)
   * @returns {Promise<HTMLElement>} Resolves with element or rejects on timeout
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      let timeoutId;
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);
    });
  },

  /**
   * Promise-based delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Escape special regex characters in a string
   * @param {string} str - String to escape
   * @returns {string} Escaped string safe for use in RegExp
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Extract text content safely from element
   * @param {HTMLElement} element - Element to extract text from
   * @returns {string} Trimmed text content
   */
  getTextContent(element) {
    if (!element) return '';
    return element.textContent?.trim() || element.innerText?.trim() || '';
  },

  /**
   * Find closest ancestor matching selector
   * @param {HTMLElement} element - Starting element
   * @param {string} selector - CSS selector to match
   * @returns {HTMLElement|null} Matching ancestor or null
   */
  findClosest(element, selector) {
    if (!element) return null;
    return element.closest(selector);
  },

  /**
   * Safely escape CSS selector for attribute values
   * @param {string} value - Value to escape
   * @returns {string} Escaped value safe for CSS selectors
   */
  escapeCSSSelector(value) {
    try {
      return CSS.escape(value);
    } catch (e) {
      // Fallback for browsers without CSS.escape
      return value.replace(/([!"#$%&'()*+,.\/:;<=>?@[\]^`{|}~])/g, '\\$1');
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerDomUtils = JobTrackerDomUtils;
}
