/**
 * JobTracker Iframe Bridge
 * Cross-frame communication for autofill in iframes
 * Uses postMessage for secure communication between parent and child frames
 */

const JobTrackerIframeBridge = {
  _initialized: false,
  _messageHandlers: new Map(),
  _pendingRequests: new Map(),
  _requestId: 0,

  // Message types
  MESSAGE_TYPES: {
    AUTOFILL_REQUEST: 'jobtracker:iframe:autofill-request',
    AUTOFILL_RESPONSE: 'jobtracker:iframe:autofill-response',
    FIELDS_DETECTED: 'jobtracker:iframe:fields-detected',
    PROFILE_REQUEST: 'jobtracker:iframe:profile-request',
    PROFILE_RESPONSE: 'jobtracker:iframe:profile-response',
    PING: 'jobtracker:iframe:ping',
    PONG: 'jobtracker:iframe:pong'
  },

  /**
   * Initialize the iframe bridge
   * Should be called on both parent and iframe contexts
   */
  init() {
    if (this._initialized) return;

    // Set up message listener
    window.addEventListener('message', (event) => this._handleMessage(event));

    // Determine if we're in an iframe
    this._isIframe = window !== window.top;

    if (this._isIframe) {
      // Child frame: notify parent we're ready
      this._notifyParentReady();
    }

    this._initialized = true;
    console.log(`JobTracker: Iframe bridge initialized (${this._isIframe ? 'child' : 'parent'} context)`);
  },

  /**
   * Check if currently in an iframe
   * @returns {boolean}
   */
  isInIframe() {
    return window !== window.top;
  },

  /**
   * Notify parent frame that this iframe is ready for autofill
   */
  _notifyParentReady() {
    this._postToParent(this.MESSAGE_TYPES.PONG, {
      ready: true,
      url: window.location.href,
      hasInputs: this._countFillableInputs() > 0
    });
  },

  /**
   * Count fillable inputs in current frame
   * @returns {number}
   */
  _countFillableInputs() {
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea';
    return document.querySelectorAll(selector).length;
  },

  /**
   * Handle incoming messages
   * @param {MessageEvent} event - Message event
   */
  _handleMessage(event) {
    // Validate message format
    if (!event.data || typeof event.data !== 'object') return;
    if (!event.data.type || !event.data.type.startsWith('jobtracker:iframe:')) return;

    const { type, payload, requestId } = event.data;

    // Handle different message types
    switch (type) {
      case this.MESSAGE_TYPES.AUTOFILL_REQUEST:
        this._handleAutofillRequest(event.source, payload, requestId);
        break;

      case this.MESSAGE_TYPES.AUTOFILL_RESPONSE:
        this._handleAutofillResponse(payload, requestId);
        break;

      case this.MESSAGE_TYPES.PROFILE_REQUEST:
        this._handleProfileRequest(event.source, requestId);
        break;

      case this.MESSAGE_TYPES.PROFILE_RESPONSE:
        this._handleProfileResponse(payload, requestId);
        break;

      case this.MESSAGE_TYPES.PING:
        this._handlePing(event.source);
        break;

      case this.MESSAGE_TYPES.PONG:
        this._handlePong(event.source, payload);
        break;

      case this.MESSAGE_TYPES.FIELDS_DETECTED:
        this._handleFieldsDetected(payload);
        break;
    }

    // Call registered handlers
    if (this._messageHandlers.has(type)) {
      const handlers = this._messageHandlers.get(type);
      handlers.forEach(handler => handler(payload, event.source, requestId));
    }
  },

  /**
   * Handle autofill request (in iframe context)
   * @param {Window} source - Source window
   * @param {Object} payload - Request payload with profile
   * @param {number} requestId - Request ID for response
   */
  async _handleAutofillRequest(source, payload, requestId) {
    const { profile, customRules } = payload;

    let filledCount = 0;

    try {
      // Use the autofill system
      const Autofill = window.JobTrackerAutofill;
      const FormUtils = window.JobTrackerFormUtils;
      const FieldMatcher = window.JobTrackerFieldMatcher;

      if (Autofill && FormUtils && FieldMatcher) {
        await Autofill.ensureReady();

        const FormDetector = Autofill.FormDetector;
        const form = FormDetector.findJobApplicationForm();
        const inputs = FormDetector.getFillableInputs(form);

        const matches = [];

        for (const input of inputs) {
          if (input.value && input.value.trim()) continue;
          if (Autofill.DomUtils && !Autofill.DomUtils.isVisible(input)) continue;

          const match = await FieldMatcher.matchFieldAsync(input, profile, customRules || []);
          if (match && match.value) {
            matches.push({ input, ...match });
          }
        }

        if (matches.length > 0) {
          filledCount = await Autofill.InputFillers.fillFieldsWithDelay(matches, 50);
        }
      }
    } catch (error) {
      console.log('JobTracker: Iframe autofill error:', error);
    }

    // Send response back
    this._postToWindow(source, this.MESSAGE_TYPES.AUTOFILL_RESPONSE, {
      filledCount,
      success: filledCount > 0
    }, requestId);
  },

  /**
   * Handle autofill response (in parent context)
   * @param {Object} payload - Response payload
   * @param {number} requestId - Request ID
   */
  _handleAutofillResponse(payload, requestId) {
    const pending = this._pendingRequests.get(requestId);
    if (pending) {
      pending.resolve(payload);
      this._pendingRequests.delete(requestId);
    }
  },

  /**
   * Handle profile request (in parent context)
   * @param {Window} source - Source window (iframe)
   * @param {number} requestId - Request ID
   */
  async _handleProfileRequest(source, requestId) {
    try {
      const profile = await chrome.runtime.sendMessage({ type: 'GET_PROFILE_FOR_FILL' });
      this._postToWindow(source, this.MESSAGE_TYPES.PROFILE_RESPONSE, { profile }, requestId);
    } catch (error) {
      this._postToWindow(source, this.MESSAGE_TYPES.PROFILE_RESPONSE, { profile: null, error: error.message }, requestId);
    }
  },

  /**
   * Handle profile response (in iframe context)
   * @param {Object} payload - Response payload
   * @param {number} requestId - Request ID
   */
  _handleProfileResponse(payload, requestId) {
    const pending = this._pendingRequests.get(requestId);
    if (pending) {
      pending.resolve(payload);
      this._pendingRequests.delete(requestId);
    }
  },

  /**
   * Handle ping from parent (in iframe context)
   * @param {Window} source - Source window
   */
  _handlePing(source) {
    this._postToWindow(source, this.MESSAGE_TYPES.PONG, {
      ready: true,
      url: window.location.href,
      hasInputs: this._countFillableInputs() > 0
    });
  },

  /**
   * Handle pong from iframe (in parent context)
   * @param {Window} source - Source window (iframe)
   * @param {Object} payload - Payload with iframe info
   */
  _handlePong(source, payload) {
    // Dispatch event for parent to handle
    window.dispatchEvent(new CustomEvent('jobtracker:iframe-ready', {
      detail: { source, ...payload }
    }));
  },

  /**
   * Handle fields detected notification (in parent context)
   * @param {Object} payload - Payload with field info
   */
  _handleFieldsDetected(payload) {
    console.log(`JobTracker: Iframe detected ${payload.count} fields`);
  },

  /**
   * Trigger autofill in all iframes
   * @param {Object} profile - User profile
   * @param {Array} customRules - Custom rules
   * @returns {Promise<Object>} Results from all iframes
   */
  async triggerAutofillInIframes(profile, customRules = []) {
    const results = {
      totalFilled: 0,
      iframeResults: []
    };

    // Validate profile before proceeding
    if (!profile || typeof profile !== 'object') {
      console.log('JobTracker: Invalid profile for iframe autofill');
      return results;
    }

    const iframes = document.querySelectorAll('iframe');

    for (const iframe of iframes) {
      try {
        // Check if iframe is accessible (same-origin)
        if (this._canAccessIframe(iframe)) {
          // Handle same-origin iframe directly
          const result = await this._autofillSameOriginIframe(iframe, profile, customRules);
          results.iframeResults.push(result);
          results.totalFilled += result.filledCount || 0;
        } else {
          // Use postMessage for cross-origin iframes
          const result = await this._requestAutofillInIframe(iframe, profile, customRules);
          results.iframeResults.push(result);
          results.totalFilled += result.filledCount || 0;
        }
      } catch (error) {
        console.log('JobTracker: Error autofilling iframe:', error.message);
      }
    }

    return results;
  },

  /**
   * Autofill a same-origin iframe directly
   * @param {HTMLIFrameElement} iframe - Iframe element
   * @param {Object} profile - User profile
   * @param {Array} customRules - Custom rules
   * @returns {Promise<Object>}
   */
  async _autofillSameOriginIframe(iframe, profile, customRules) {
    let filledCount = 0;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeWindow = iframe.contentWindow;

      // Check if JobTracker is loaded in iframe
      const Autofill = iframeWindow.JobTrackerAutofill;
      const FormUtils = iframeWindow.JobTrackerFormUtils;
      const FieldMatcher = iframeWindow.JobTrackerFieldMatcher;

      if (Autofill && FormUtils && FieldMatcher) {
        await Autofill.ensureReady();

        const FormDetector = Autofill.FormDetector;
        const form = FormDetector.findJobApplicationForm();
        const inputs = FormDetector.getFillableInputs(form);

        const matches = [];

        for (const input of inputs) {
          if (input.value && input.value.trim()) continue;
          if (Autofill.DomUtils && !Autofill.DomUtils.isVisible(input)) continue;

          const match = await FieldMatcher.matchFieldAsync(input, profile, customRules || []);
          if (match && match.value) {
            matches.push({ input, ...match });
          }
        }

        if (matches.length > 0) {
          filledCount = await Autofill.InputFillers.fillFieldsWithDelay(matches, 50);
        }
      } else {
        // JobTracker not loaded in iframe, try using parent's matcher
        const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea';
        const inputs = iframeDoc.querySelectorAll(selector);

        // Use parent window's autofill system
        const ParentAutofill = window.JobTrackerAutofill;
        const ParentFieldMatcher = window.JobTrackerFieldMatcher;

        if (ParentAutofill && ParentFieldMatcher) {
          for (const input of inputs) {
            if (input.value && input.value.trim()) continue;

            const match = await ParentFieldMatcher.matchFieldAsync(input, profile, customRules || []);
            if (match && match.value) {
              if (ParentAutofill.InputFillers?.fillInput(input, match.value)) {
                filledCount++;
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('JobTracker: Error in same-origin iframe autofill:', error.message);
    }

    return { filledCount, sameOrigin: true };
  },

  /**
   * Check if we can directly access iframe content
   * @param {HTMLIFrameElement} iframe - Iframe element
   * @returns {boolean}
   */
  _canAccessIframe(iframe) {
    try {
      // This will throw for cross-origin iframes
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      return doc !== null;
    } catch (e) {
      return false;
    }
  },

  /**
   * Request autofill in a specific iframe via postMessage
   * @param {HTMLIFrameElement} iframe - Iframe element
   * @param {Object} profile - User profile
   * @param {Array} customRules - Custom rules
   * @returns {Promise<Object>}
   */
  async _requestAutofillInIframe(iframe, profile, customRules) {
    return new Promise((resolve, reject) => {
      const requestId = ++this._requestId;
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(requestId);
        resolve({ filledCount: 0, timeout: true });
      }, 5000);

      this._pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject
      });

      try {
        iframe.contentWindow.postMessage({
          type: this.MESSAGE_TYPES.AUTOFILL_REQUEST,
          payload: { profile, customRules },
          requestId
        }, '*');
      } catch (e) {
        clearTimeout(timeout);
        this._pendingRequests.delete(requestId);
        resolve({ filledCount: 0, error: e.message });
      }
    });
  },

  /**
   * Request profile from parent (for iframe context)
   * @returns {Promise<Object>}
   */
  async requestProfileFromParent() {
    if (!this._isIframe) {
      throw new Error('Not in iframe context');
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this._requestId;
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(requestId);
        reject(new Error('Profile request timeout'));
      }, 5000);

      this._pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject
      });

      this._postToParent(this.MESSAGE_TYPES.PROFILE_REQUEST, {}, requestId);
    });
  },

  /**
   * Ping all iframes to check which ones have JobTracker loaded
   * @returns {Promise<Array>} Array of iframe info objects
   */
  async pingIframes() {
    const iframes = document.querySelectorAll('iframe');
    const results = [];

    // Set up event listener to collect responses
    const eventListener = (event) => {
      if (event.detail) {
        results.push(event.detail);
      }
    };
    window.addEventListener('jobtracker:iframe-ready', eventListener);

    for (const iframe of iframes) {
      try {
        iframe.contentWindow.postMessage({
          type: this.MESSAGE_TYPES.PING,
          payload: {}
        }, '*');
      } catch (e) {
        // Cross-origin or inaccessible
      }
    }

    // Collect responses via event listener, then clean up
    return new Promise((resolve) => {
      setTimeout(() => {
        window.removeEventListener('jobtracker:iframe-ready', eventListener);
        resolve(results);
      }, 2000);
    });
  },

  /**
   * Post message to parent window
   * @param {string} type - Message type
   * @param {Object} payload - Message payload
   * @param {number} requestId - Optional request ID
   */
  _postToParent(type, payload, requestId = null) {
    try {
      window.parent.postMessage({
        type,
        payload,
        requestId
      }, '*');
    } catch (e) {
      console.log('JobTracker: Error posting to parent:', e.message);
    }
  },

  /**
   * Post message to specific window
   * @param {Window} targetWindow - Target window
   * @param {string} type - Message type
   * @param {Object} payload - Message payload
   * @param {number} requestId - Optional request ID
   */
  _postToWindow(targetWindow, type, payload, requestId = null) {
    try {
      targetWindow.postMessage({
        type,
        payload,
        requestId
      }, '*');
    } catch (e) {
      console.log('JobTracker: Error posting message:', e.message);
    }
  },

  /**
   * Register a message handler
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  on(type, handler) {
    if (!this._messageHandlers.has(type)) {
      this._messageHandlers.set(type, []);
    }
    this._messageHandlers.get(type).push(handler);
  },

  /**
   * Remove a message handler
   * @param {string} type - Message type
   * @param {Function} handler - Handler function to remove
   */
  off(type, handler) {
    if (this._messageHandlers.has(type)) {
      const handlers = this._messageHandlers.get(type);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  },

  /**
   * Clean up and disconnect the iframe bridge
   * Removes event listeners and clears pending requests
   */
  disconnect() {
    // Clear pending requests with timeout errors
    for (const [requestId, pending] of this._pendingRequests) {
      pending.resolve({ filledCount: 0, disconnected: true });
    }
    this._pendingRequests.clear();

    // Clear message handlers
    this._messageHandlers.clear();

    // Reset state
    this._initialized = false;
    this._requestId = 0;

    console.log('JobTracker: Iframe bridge disconnected');
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerIframeBridge = JobTrackerIframeBridge;

  // Auto-initialize
  JobTrackerIframeBridge.init();

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('iframe-bridge');
  }
}

console.log('JobTracker: Iframe Bridge loaded');
