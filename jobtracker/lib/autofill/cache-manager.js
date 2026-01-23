/**
 * JobTracker Cache Manager
 * WeakMap-based caching for DOM operations to improve performance
 * Provides TTL-based caching for visibility, label text, signals, and computed styles
 */

const JobTrackerCacheManager = {
  /**
   * Element-keyed caches using WeakMap for automatic garbage collection
   */
  _elementCaches: {
    visibility: new WeakMap(),    // element -> {visible, timestamp}
    labelText: new WeakMap(),     // element -> {text, timestamp}
    signals: new WeakMap(),       // element -> {signals, timestamp}
    computedStyle: new WeakMap()  // element -> {style, timestamp}
  },

  /**
   * Time-to-live values in milliseconds for each cache type
   */
  TTL: {
    VISIBILITY: 100,      // 100ms - visibility can change frequently
    LABEL_TEXT: 5000,     // 5s - labels rarely change
    SIGNALS: 5000,        // 5s - field signals rarely change
    COMPUTED_STYLE: 100   // 100ms - styles can change with animations
  },

  /**
   * Statistics for cache performance monitoring
   */
  _stats: {
    hits: 0,
    misses: 0,
    sets: 0
  },

  /**
   * Check if a cached value is still valid based on TTL
   * @param {number} timestamp - When the value was cached
   * @param {number} ttl - Time-to-live in milliseconds
   * @returns {boolean} Whether the cached value is still valid
   */
  _isValid(timestamp, ttl) {
    return (Date.now() - timestamp) < ttl;
  },

  // ============== VISIBILITY CACHE ==============

  /**
   * Validate element is a valid WeakMap key
   * @param {*} element - Element to validate
   * @returns {boolean} Whether element is valid
   */
  _isValidElement(element) {
    return element !== null && typeof element === 'object';
  },

  /**
   * Get cached visibility status for an element
   * @param {HTMLElement} element - Element to check
   * @returns {boolean|null} Cached visibility or null if not cached/expired
   */
  getVisibility(element) {
    if (!this._isValidElement(element)) {
      this._stats.misses++;
      return null;
    }
    const cached = this._elementCaches.visibility.get(element);
    if (cached && this._isValid(cached.timestamp, this.TTL.VISIBILITY)) {
      this._stats.hits++;
      return cached.visible;
    }
    this._stats.misses++;
    return null;
  },

  /**
   * Cache visibility status for an element
   * @param {HTMLElement} element - Element to cache
   * @param {boolean} visible - Visibility status
   */
  setVisibility(element, visible) {
    if (!this._isValidElement(element)) return;
    this._elementCaches.visibility.set(element, {
      visible,
      timestamp: Date.now()
    });
    this._stats.sets++;
  },

  // ============== LABEL TEXT CACHE ==============

  /**
   * Get cached label text for an element
   * @param {HTMLElement} element - Input element
   * @returns {string|null} Cached label text or null if not cached/expired
   */
  getLabelText(element) {
    if (!this._isValidElement(element)) {
      this._stats.misses++;
      return null;
    }
    const cached = this._elementCaches.labelText.get(element);
    if (cached && this._isValid(cached.timestamp, this.TTL.LABEL_TEXT)) {
      this._stats.hits++;
      return cached.text;
    }
    this._stats.misses++;
    return null;
  },

  /**
   * Cache label text for an element
   * @param {HTMLElement} element - Input element
   * @param {string} text - Label text
   */
  setLabelText(element, text) {
    if (!this._isValidElement(element) || text === null || text === undefined) return;
    this._elementCaches.labelText.set(element, {
      text,
      timestamp: Date.now()
    });
    this._stats.sets++;
  },

  // ============== SIGNALS CACHE ==============

  /**
   * Get cached signals for an element
   * @param {HTMLElement} element - Input element
   * @returns {Object|null} Cached signals or null if not cached/expired
   */
  getSignals(element) {
    if (!this._isValidElement(element)) {
      this._stats.misses++;
      return null;
    }
    const cached = this._elementCaches.signals.get(element);
    if (cached && this._isValid(cached.timestamp, this.TTL.SIGNALS)) {
      this._stats.hits++;
      return cached.signals;
    }
    this._stats.misses++;
    return null;
  },

  /**
   * Cache signals for an element
   * @param {HTMLElement} element - Input element
   * @param {Object} signals - Extracted signals object
   */
  setSignals(element, signals) {
    if (!this._isValidElement(element) || signals === null || signals === undefined) return;
    this._elementCaches.signals.set(element, {
      signals,
      timestamp: Date.now()
    });
    this._stats.sets++;
  },

  // ============== COMPUTED STYLE CACHE ==============

  /**
   * Get cached computed style for an element
   * @param {HTMLElement} element - Element to check
   * @returns {CSSStyleDeclaration|null} Cached style or null if not cached/expired
   */
  getComputedStyle(element) {
    if (!this._isValidElement(element)) {
      this._stats.misses++;
      return null;
    }
    const cached = this._elementCaches.computedStyle.get(element);
    if (cached && this._isValid(cached.timestamp, this.TTL.COMPUTED_STYLE)) {
      this._stats.hits++;
      return cached.style;
    }
    this._stats.misses++;
    return null;
  },

  /**
   * Cache computed style for an element
   * @param {HTMLElement} element - Element
   * @param {CSSStyleDeclaration} style - Computed style object
   */
  setComputedStyle(element, style) {
    if (!this._isValidElement(element) || style === null || style === undefined) return;
    this._elementCaches.computedStyle.set(element, {
      style,
      timestamp: Date.now()
    });
    this._stats.sets++;
  },

  // ============== CACHE MANAGEMENT ==============

  /**
   * Clear all caches
   * Useful when page content significantly changes (e.g., SPA navigation)
   */
  clearAll() {
    this._elementCaches.visibility = new WeakMap();
    this._elementCaches.labelText = new WeakMap();
    this._elementCaches.signals = new WeakMap();
    this._elementCaches.computedStyle = new WeakMap();
    this._resetStats();
  },

  /**
   * Clear specific cache type
   * @param {string} cacheType - 'visibility', 'labelText', 'signals', or 'computedStyle'
   */
  clearCache(cacheType) {
    if (this._elementCaches[cacheType]) {
      this._elementCaches[cacheType] = new WeakMap();
    }
  },

  /**
   * Invalidate cache for a specific element
   * @param {HTMLElement} element - Element to invalidate
   * @param {string|null} cacheType - Specific cache type or null for all
   */
  invalidate(element, cacheType = null) {
    if (!this._isValidElement(element)) return;

    if (cacheType) {
      if (this._elementCaches[cacheType]) {
        this._elementCaches[cacheType].delete(element);
      }
    } else {
      // Invalidate all caches for this element
      for (const cache of Object.values(this._elementCaches)) {
        cache.delete(element);
      }
    }
  },

  /**
   * Reset statistics
   */
  _resetStats() {
    this._stats.hits = 0;
    this._stats.misses = 0;
    this._stats.sets = 0;
  },

  /**
   * Get cache statistics
   * @returns {Object} Cache performance stats
   */
  getStats() {
    const total = this._stats.hits + this._stats.misses;
    return {
      hits: this._stats.hits,
      misses: this._stats.misses,
      sets: this._stats.sets,
      hitRate: total > 0 ? Math.round((this._stats.hits / total) * 100) : 0
    };
  },

  /**
   * Update TTL values (for configuration)
   * @param {Object} newTTL - New TTL values to merge
   */
  setTTL(newTTL) {
    if (!newTTL || typeof newTTL !== 'object') return;

    // Validate TTL values are positive numbers
    for (const [key, value] of Object.entries(newTTL)) {
      if (typeof value === 'number' && value > 0 && this.TTL.hasOwnProperty(key)) {
        this.TTL[key] = value;
      }
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerCacheManager = JobTrackerCacheManager;

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('cache-manager');
  }
}

console.log('JobTracker: Cache Manager loaded');
