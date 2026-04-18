/**
 * JobTracker Shadow DOM Utilities
 * Provides traversal utilities for accessing elements inside Shadow DOM
 * Enables autofill to work with web components (Salesforce, SAP, etc.)
 */

const JobTrackerShadowDomUtils = {
  /**
   * Query selector that searches through Shadow DOM boundaries
   * @param {string} selector - CSS selector to find
   * @param {HTMLElement|Document} root - Starting element (default: document)
   * @returns {HTMLElement|null} First matching element or null
   */
  querySelectorDeep(selector, root = document) {
    // Try regular query first
    const element = root.querySelector(selector);
    if (element) return element;

    // Search through shadow roots
    return this._searchShadowRoots(root, (shadowRoot) => {
      return shadowRoot.querySelector(selector);
    });
  },

  /**
   * Query selector all that searches through Shadow DOM boundaries
   * @param {string} selector - CSS selector to find
   * @param {HTMLElement|Document} root - Starting element (default: document)
   * @returns {HTMLElement[]} Array of matching elements
   */
  querySelectorAllDeep(selector, root = document) {
    const results = [];

    // Get regular matches
    const elements = root.querySelectorAll(selector);
    results.push(...elements);

    // Search through shadow roots
    this._searchAllShadowRoots(root, (shadowRoot) => {
      const shadowElements = shadowRoot.querySelectorAll(selector);
      results.push(...shadowElements);
    });

    return results;
  },

  /**
   * Get all fillable inputs including those in Shadow DOM
   * @param {HTMLElement|Document} container - Container to search
   * @returns {HTMLElement[]} Array of fillable input elements
   */
  getFillableInputsDeep(container = document) {
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea';
    const inputs = this.querySelectorAllDeep(selector, container);

    // Filter out disabled/readonly
    return inputs.filter(input => {
      return !input.disabled &&
             !input.readOnly &&
             input.getAttribute('aria-disabled') !== 'true';
    });
  },

  /**
   * Get all shadow roots in a tree
   * @param {HTMLElement|Document} root - Starting element
   * @returns {ShadowRoot[]} Array of shadow roots found
   */
  getAllShadowRoots(root = document) {
    const shadowRoots = [];

    this._searchAllShadowRoots(root, (shadowRoot) => {
      shadowRoots.push(shadowRoot);
    });

    return shadowRoots;
  },

  /**
   * Check if an element is inside a Shadow DOM
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is in Shadow DOM
   */
  isInShadowDom(element) {
    let current = element;

    while (current) {
      if (current.getRootNode() instanceof ShadowRoot) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  },

  /**
   * Get the shadow host of an element (if in Shadow DOM)
   * @param {HTMLElement} element - Element to check
   * @returns {HTMLElement|null} Shadow host or null
   */
  getShadowHost(element) {
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
      return root.host;
    }
    return null;
  },

  /**
   * Find label for input that may be in Shadow DOM
   * @param {HTMLElement} input - Input element
   * @returns {string} Label text or empty string
   */
  findLabelDeep(input) {
    // Try regular label lookup first
    if (input.id) {
      // Check in same shadow root if applicable
      const root = input.getRootNode();
      const label = root.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) return label.textContent.trim();
    }

    // Check parent label
    const parentLabel = this._findClosestDeep(input, 'label');
    if (parentLabel) return parentLabel.textContent.trim();

    // Check for aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check for aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const root = input.getRootNode();
      const labelEl = root.getElementById ? root.getElementById(labelledBy) : null;
      if (labelEl) return labelEl.textContent.trim();
    }

    return '';
  },

  /**
   * Find closest ancestor that may cross Shadow DOM boundaries
   * @param {HTMLElement} element - Starting element
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Matching ancestor or null
   */
  _findClosestDeep(element, selector) {
    let current = element;

    while (current) {
      // Check current element
      if (current.matches && current.matches(selector)) {
        return current;
      }

      // Check parent
      if (current.parentElement) {
        current = current.parentElement;
      } else {
        // Cross Shadow DOM boundary
        const root = current.getRootNode();
        if (root instanceof ShadowRoot) {
          current = root.host;
        } else {
          break;
        }
      }
    }

    return null;
  },

  /**
   * Internal: Search shadow roots for first match
   * @param {HTMLElement|Document} root - Starting element
   * @param {Function} callback - Function to call with each shadow root, return truthy to stop
   * @returns {*} First truthy return value from callback
   */
  _searchShadowRoots(root, callback) {
    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];

    for (const el of elements) {
      // Check if element has a shadow root
      if (el.shadowRoot) {
        const result = callback(el.shadowRoot);
        if (result) return result;

        // Recursively search nested shadow roots
        const nestedResult = this._searchShadowRoots(el.shadowRoot, callback);
        if (nestedResult) return nestedResult;
      }
    }

    return null;
  },

  /**
   * Internal: Search all shadow roots (doesn't stop on first match)
   * @param {HTMLElement|Document} root - Starting element
   * @param {Function} callback - Function to call with each shadow root
   */
  _searchAllShadowRoots(root, callback) {
    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];

    for (const el of elements) {
      if (el.shadowRoot) {
        callback(el.shadowRoot);

        // Recursively search nested shadow roots
        this._searchAllShadowRoots(el.shadowRoot, callback);
      }
    }
  },

  /**
   * Dispatch event that crosses Shadow DOM boundaries
   * @param {HTMLElement} element - Target element
   * @param {string} eventType - Event type
   * @param {Object} options - Event options
   */
  dispatchEventDeep(element, eventType, options = {}) {
    const event = new Event(eventType, {
      bubbles: true,
      composed: true, // Allows event to cross Shadow DOM boundaries
      ...options
    });
    element.dispatchEvent(event);
  },

  /**
   * Focus element and ensure it's accessible across Shadow DOM
   * @param {HTMLElement} element - Element to focus
   */
  focusDeep(element) {
    // For elements in Shadow DOM, we may need to focus the host first
    if (this.isInShadowDom(element)) {
      const host = this.getShadowHost(element);
      if (host) {
        // Ensure host is focusable
        if (!host.hasAttribute('tabindex')) {
          host.setAttribute('tabindex', '-1');
        }
      }
    }

    element.focus();
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerShadowDomUtils = JobTrackerShadowDomUtils;

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('shadow-dom-utils');
  }
}

console.log('JobTracker: Shadow DOM Utils loaded');
