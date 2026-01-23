/**
 * JobTracker Dynamic Observer
 * MutationObserver + SPA navigation detection for dynamic content handling
 * Detects new form fields added via AJAX and SPA route changes
 */

const JobTrackerDynamicObserver = {
  _observer: null,
  _onNewFields: null,
  _debounceTimer: null,
  _debounceDelay: 150, // ms
  _isInitialized: false,
  _pendingMutations: [],

  // Keep track of known inputs to detect new ones
  _knownInputs: new WeakSet(),

  // Store original history methods for cleanup
  _originalPushState: null,
  _originalReplaceState: null,

  // Store event listener references for cleanup
  _popstateListener: null,
  _hashchangeListener: null,

  /**
   * Initialize the dynamic observer
   * @param {Function} onNewFields - Callback when new form fields are detected
   * @param {Object} options - Configuration options
   */
  init(onNewFields, options = {}) {
    if (this._isInitialized) {
      console.log('JobTracker: Dynamic observer already initialized');
      return;
    }

    this._onNewFields = onNewFields;
    this._debounceDelay = options.debounceDelay || 150;

    // Mark existing inputs as known
    this._markExistingInputs();

    // Set up MutationObserver
    this._setupMutationObserver();

    // Set up SPA navigation detection
    this._watchHistoryNavigation();
    this._watchHashChanges();

    this._isInitialized = true;
    console.log('JobTracker: Dynamic observer initialized');
  },

  /**
   * Mark all existing inputs as known
   */
  _markExistingInputs() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => this._knownInputs.add(input));
  },

  /**
   * Set up MutationObserver for DOM changes
   */
  _setupMutationObserver() {
    this._observer = new MutationObserver((mutations) => {
      this._handleMutations(mutations);
    });

    this._observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'aria-hidden', 'disabled']
    });
  },

  /**
   * Handle mutations with debouncing
   * @param {MutationRecord[]} mutations - Mutation records
   */
  _handleMutations(mutations) {
    // Collect mutations
    this._pendingMutations.push(...mutations);

    // Debounce processing
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._processMutations();
    }, this._debounceDelay);
  },

  /**
   * Process collected mutations
   */
  _processMutations() {
    const mutations = this._pendingMutations;
    this._pendingMutations = [];

    const newEmptyInputs = [];

    for (const mutation of mutations) {
      // Handle added nodes
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check if node is a form element
          if (this._isFormElement(node)) {
            this._processNewInput(node, newEmptyInputs);
          }

          // Check descendants for form elements
          if (node.querySelectorAll) {
            const inputs = node.querySelectorAll('input, select, textarea');
            inputs.forEach(input => this._processNewInput(input, newEmptyInputs));
          }
        }
      }

      // Handle attribute changes (visibility changes)
      if (mutation.type === 'attributes') {
        const target = mutation.target;

        // Check if a previously hidden container became visible
        if (this._isVisibilityChange(mutation)) {
          const inputs = target.querySelectorAll ?
            target.querySelectorAll('input, select, textarea') : [];
          inputs.forEach(input => {
            if (!this._knownInputs.has(input)) {
              this._processNewInput(input, newEmptyInputs);
            }
          });
        }
      }
    }

    // Notify callback if new empty inputs were found
    if (newEmptyInputs.length > 0 && this._onNewFields) {
      this._onNewFields(newEmptyInputs);
    }
  },

  /**
   * Check if an element is a form input element
   * @param {HTMLElement} element - Element to check
   * @returns {boolean}
   */
  _isFormElement(element) {
    const tagName = element.tagName?.toLowerCase();
    return ['input', 'select', 'textarea'].includes(tagName);
  },

  /**
   * Process a potentially new input element
   * @param {HTMLElement} input - Input element
   * @param {HTMLElement[]} newEmptyInputs - Array to collect new empty inputs
   */
  _processNewInput(input, newEmptyInputs) {
    // Skip if already known
    if (this._knownInputs.has(input)) return;

    // Mark as known
    this._knownInputs.add(input);

    // Skip hidden, submit, button, file inputs
    const type = input.type?.toLowerCase();
    if (['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(type)) {
      return;
    }

    // Check if input is visible and empty
    if (this._isInputVisible(input) && this._isInputEmpty(input)) {
      newEmptyInputs.push(input);
    }
  },

  /**
   * Check if mutation represents a visibility change
   * @param {MutationRecord} mutation - Mutation record
   * @returns {boolean}
   */
  _isVisibilityChange(mutation) {
    const attr = mutation.attributeName;
    return ['style', 'class', 'hidden', 'aria-hidden'].includes(attr);
  },

  /**
   * Check if input is visible
   * @param {HTMLElement} input - Input element
   * @returns {boolean}
   */
  _isInputVisible(input) {
    // Use DomUtils if available
    if (window.JobTrackerDomUtils?.isVisible) {
      return window.JobTrackerDomUtils.isVisible(input);
    }

    // Fallback visibility check
    const style = window.getComputedStyle(input);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = input.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Check if input is empty
   * @param {HTMLElement} input - Input element
   * @returns {boolean}
   */
  _isInputEmpty(input) {
    const type = input.type?.toLowerCase();

    if (type === 'checkbox' || type === 'radio') {
      return !input.checked;
    }

    return !input.value || !input.value.trim();
  },

  /**
   * Watch for History API navigation (pushState/replaceState)
   */
  _watchHistoryNavigation() {
    // Guard against re-wrapping (prevents memory leak on re-init)
    if (!this._originalPushState) {
      // Intercept pushState
      this._originalPushState = history.pushState;
      history.pushState = (...args) => {
        this._originalPushState.apply(history, args);
        this._handleNavigation('pushState');
      };
    }

    if (!this._originalReplaceState) {
      // Intercept replaceState
      this._originalReplaceState = history.replaceState;
      history.replaceState = (...args) => {
        this._originalReplaceState.apply(history, args);
        this._handleNavigation('replaceState');
      };
    }

    // Listen for popstate (back/forward navigation) - store reference for cleanup
    if (!this._popstateListener) {
      this._popstateListener = () => this._handleNavigation('popstate');
      window.addEventListener('popstate', this._popstateListener);
    }
  },

  /**
   * Watch for hash changes
   */
  _watchHashChanges() {
    // Store reference for cleanup
    if (!this._hashchangeListener) {
      this._hashchangeListener = () => this._handleNavigation('hashchange');
      window.addEventListener('hashchange', this._hashchangeListener);
    }
  },

  /**
   * Handle SPA navigation
   * @param {string} type - Navigation type
   */
  _handleNavigation(type) {
    // Clear caches on navigation
    if (window.JobTrackerCacheManager) {
      window.JobTrackerCacheManager.clearAll();
    }

    // Clear pending debounced mutations to avoid race conditions
    clearTimeout(this._debounceTimer);
    this._pendingMutations = [];

    // Reset known inputs after a delay to allow DOM to update
    setTimeout(() => {
      this._markExistingInputs();
      this.triggerRedetection();
    }, 500);
  },

  /**
   * Manually trigger re-detection of form fields
   * Call this after programmatic DOM changes
   */
  triggerRedetection() {
    const newEmptyInputs = [];
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      const type = input.type?.toLowerCase();
      if (['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(type)) {
        return;
      }

      if (this._isInputVisible(input) && this._isInputEmpty(input)) {
        newEmptyInputs.push(input);
      }
    });

    if (newEmptyInputs.length > 0 && this._onNewFields) {
      this._onNewFields(newEmptyInputs);
    }

    return newEmptyInputs;
  },

  /**
   * Wait for a form/element to appear
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms (default 10000)
   * @returns {Promise<HTMLElement>}
   */
  waitForForm(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
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
        reject(new Error(`Timeout waiting for form: ${selector}`));
      }, timeout);
    });
  },

  /**
   * Wait for inputs to appear within a container
   * @param {HTMLElement} container - Container element
   * @param {number} minInputs - Minimum number of inputs to wait for
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<HTMLElement[]>}
   */
  waitForInputs(container, minInputs = 1, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const checkInputs = () => {
        const inputs = container.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
        );
        return Array.from(inputs).filter(input => this._isInputVisible(input));
      };

      // Check if already have enough inputs
      const existing = checkInputs();
      if (existing.length >= minInputs) {
        resolve(existing);
        return;
      }

      let timeoutId;
      const observer = new MutationObserver(() => {
        const inputs = checkInputs();
        if (inputs.length >= minInputs) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(inputs);
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden']
      });

      timeoutId = setTimeout(() => {
        observer.disconnect();
        const inputs = checkInputs();
        if (inputs.length > 0) {
          resolve(inputs);
        } else {
          reject(new Error(`Timeout waiting for inputs in container`));
        }
      }, timeout);
    });
  },

  /**
   * Disconnect and clean up the observer
   */
  disconnect() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    // Restore original history methods
    if (this._originalPushState) {
      history.pushState = this._originalPushState;
      this._originalPushState = null;
    }
    if (this._originalReplaceState) {
      history.replaceState = this._originalReplaceState;
      this._originalReplaceState = null;
    }

    // Remove event listeners
    if (this._popstateListener) {
      window.removeEventListener('popstate', this._popstateListener);
      this._popstateListener = null;
    }
    if (this._hashchangeListener) {
      window.removeEventListener('hashchange', this._hashchangeListener);
      this._hashchangeListener = null;
    }

    this._isInitialized = false;
    this._pendingMutations = [];
    this._knownInputs = new WeakSet();

    console.log('JobTracker: Dynamic observer disconnected');
  },

  /**
   * Check if observer is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._isInitialized;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerDynamicObserver = JobTrackerDynamicObserver;

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('dynamic-observer');
  }
}

console.log('JobTracker: Dynamic Observer module loaded');
