/**
 * JobTracker Search Module
 * Fuzzy search powered by Fuse.js
 */

// Fuse.js configuration for job applications
const DEFAULT_FUSE_OPTIONS = {
  // Which keys to search
  keys: [
    { name: 'company', weight: 0.4 },
    { name: 'position', weight: 0.4 },
    { name: 'location', weight: 0.1 },
    { name: 'notes', weight: 0.1 }
  ],
  // Fuzzy matching options
  threshold: 0.3, // 0 = exact match, 1 = match anything
  distance: 100, // How far to search for a match
  minMatchCharLength: 2,
  ignoreLocation: true,
  includeScore: true,
  includeMatches: true,
  useExtendedSearch: false
};

/**
 * JobTracker Search class
 * Wraps Fuse.js for fuzzy searching job applications
 */
class JobTrackerSearch {
  constructor(options = {}) {
    this.options = { ...DEFAULT_FUSE_OPTIONS, ...options };
    this.fuse = null;
    this.data = [];
  }

  /**
   * Initialize or update the search index with data
   * @param {Array} applications - Array of job applications
   */
  setData(applications) {
    this.data = applications || [];
    if (typeof Fuse !== 'undefined') {
      this.fuse = new Fuse(this.data, this.options);
    }
  }

  /**
   * Perform a fuzzy search
   * @param {string} query - Search query
   * @returns {Array} Matching applications (sorted by relevance)
   */
  search(query) {
    if (!query || !query.trim()) {
      return this.data;
    }

    if (!this.fuse) {
      // Fallback to simple search if Fuse.js not loaded
      return this.simpleSearch(query);
    }

    const results = this.fuse.search(query.trim());
    return results.map(result => result.item);
  }

  /**
   * Perform search and return with match info
   * @param {string} query - Search query
   * @returns {Array} Results with score and match info
   */
  searchWithDetails(query) {
    if (!query || !query.trim()) {
      return this.data.map(item => ({ item, score: 0, matches: [] }));
    }

    if (!this.fuse) {
      return this.data.map(item => ({ item, score: 0, matches: [] }));
    }

    return this.fuse.search(query.trim());
  }

  /**
   * Simple fallback search (substring matching)
   * @param {string} query - Search query
   * @returns {Array} Matching applications
   */
  simpleSearch(query) {
    const searchTerm = query.toLowerCase().trim();
    return this.data.filter(app =>
      (app.company?.toLowerCase().includes(searchTerm)) ||
      (app.position?.toLowerCase().includes(searchTerm)) ||
      (app.location?.toLowerCase().includes(searchTerm)) ||
      (app.notes?.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Update Fuse.js options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    if (this.data.length > 0) {
      this.setData(this.data);
    }
  }

  /**
   * Get suggestion results for autocomplete
   * @param {string} query - Partial query
   * @param {number} limit - Max results to return
   * @returns {Array} Top matching results
   */
  getSuggestions(query, limit = 5) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const results = this.search(query);
    return results.slice(0, limit);
  }

  /**
   * Check if Fuse.js is available
   * @returns {boolean}
   */
  static isAvailable() {
    return typeof Fuse !== 'undefined';
  }
}

// Create singleton instance for global use
const searchInstance = new JobTrackerSearch();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JobTrackerSearch, searchInstance };
}

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.JobTrackerSearch = JobTrackerSearch;
  window.jobTrackerSearch = searchInstance;
}
