/**
 * JSON-LD Form Hints Extractor
 * Extracts form field hints from Schema.org structured data
 * Parses JobPosting, ContactPoint, PostalAddress, and Organization schemas
 */

const JSONLDFormHints = {
  // Cache for parsed JSON-LD data (per URL)
  _cache: new Map(),
  _cacheExpiry: 5 * 60 * 1000, // 5 minutes

  // Schema.org type to field mappings
  SCHEMA_FIELD_MAPPINGS: {
    // JobPosting schema properties
    'JobPosting': {
      'hiringOrganization': { context: 'company', fields: ['currentCompany'] },
      'jobLocation': { context: 'location', fields: ['city', 'state', 'country'] },
      'baseSalary': { context: 'salary', fields: ['expectedCtc'] },
      'employmentType': { context: 'employment', fields: [] },
      'title': { context: 'job', fields: ['currentTitle'] },
      'description': { context: 'job', fields: [] }
    },

    // ContactPoint schema properties
    'ContactPoint': {
      'email': { context: 'contact', fields: ['email'] },
      'telephone': { context: 'contact', fields: ['phone'] },
      'contactType': { context: 'contact', fields: [] }
    },

    // PostalAddress schema properties
    'PostalAddress': {
      'streetAddress': { context: 'address', fields: ['street'] },
      'addressLocality': { context: 'address', fields: ['city'] },
      'addressRegion': { context: 'address', fields: ['state'] },
      'postalCode': { context: 'address', fields: ['zipCode'] },
      'addressCountry': { context: 'address', fields: ['country'] }
    },

    // Organization schema properties
    'Organization': {
      'name': { context: 'company', fields: ['currentCompany'] },
      'email': { context: 'contact', fields: ['email'] },
      'telephone': { context: 'contact', fields: ['phone'] },
      'address': { context: 'address', fields: ['street'] },
      'url': { context: 'company', fields: ['portfolio'] }
    },

    // Person schema properties
    'Person': {
      'givenName': { context: 'personal', fields: ['firstName'] },
      'familyName': { context: 'personal', fields: ['lastName'] },
      'name': { context: 'personal', fields: ['fullName'] },
      'email': { context: 'contact', fields: ['email'] },
      'telephone': { context: 'contact', fields: ['phone'] },
      'address': { context: 'address', fields: [] },
      'url': { context: 'social', fields: ['portfolio'] },
      'sameAs': { context: 'social', fields: ['linkedIn', 'github', 'twitter'] }
    }
  },

  // Context weights for confidence scoring
  CONTEXT_WEIGHTS: {
    'job': 1.2,
    'company': 1.1,
    'contact': 1.0,
    'address': 1.0,
    'personal': 1.0,
    'social': 0.9,
    'salary': 1.1,
    'employment': 0.8
  },

  /**
   * Extract JSON-LD data from the page
   * @returns {Array<Object>} Parsed JSON-LD objects
   */
  extractJSONLD() {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    const results = [];

    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        // Handle both single objects and arrays
        if (Array.isArray(data)) {
          results.push(...data);
        } else if (data['@graph']) {
          // Handle @graph format
          results.push(...data['@graph']);
        } else {
          results.push(data);
        }
      } catch (e) {
        console.log('[JSONLDFormHints] Failed to parse JSON-LD:', e.message);
      }
    });

    return results;
  },

  /**
   * Get page context from JSON-LD (cached)
   * @returns {Object} Page context with schema types and hints
   */
  getPageContext() {
    const url = window.location.href;

    // Check cache
    const cached = this._cache.get(url);
    if (cached && (Date.now() - cached.timestamp) < this._cacheExpiry) {
      return cached.context;
    }

    // Extract and analyze
    const jsonLdData = this.extractJSONLD();
    const context = this._analyzeJSONLD(jsonLdData);

    // Cache result
    this._cache.set(url, {
      context,
      timestamp: Date.now()
    });

    return context;
  },

  /**
   * Analyze JSON-LD data to extract page context
   * @param {Array<Object>} jsonLdData - Parsed JSON-LD objects
   * @returns {Object} Analyzed context
   */
  _analyzeJSONLD(jsonLdData) {
    const context = {
      hasStructuredData: jsonLdData.length > 0,
      schemaTypes: [],
      isJobApplication: false,
      company: null,
      location: null,
      salary: null,
      fieldHints: {},
      rawData: jsonLdData
    };

    for (const item of jsonLdData) {
      const schemaType = this._getSchemaType(item);
      if (schemaType) {
        context.schemaTypes.push(schemaType);
        this._extractFieldHints(item, schemaType, context);
      }
    }

    // Determine if this is a job application context
    context.isJobApplication = context.schemaTypes.some(t =>
      ['JobPosting', 'JobApplication', 'JobOffer'].includes(t)
    );

    return context;
  },

  /**
   * Get Schema.org type from object
   * @param {Object} item - JSON-LD object
   * @returns {string|null} Schema type
   */
  _getSchemaType(item) {
    const typeValue = item['@type'];
    if (!typeValue) return null;

    // Handle array of types
    if (Array.isArray(typeValue)) {
      return typeValue[0];
    }

    // Handle full URLs like "http://schema.org/JobPosting"
    if (typeValue.includes('/')) {
      return typeValue.split('/').pop();
    }

    return typeValue;
  },

  /**
   * Extract field hints from a JSON-LD object
   * @param {Object} item - JSON-LD object
   * @param {string} schemaType - Schema type
   * @param {Object} context - Context object to populate
   */
  _extractFieldHints(item, schemaType, context) {
    const mappings = this.SCHEMA_FIELD_MAPPINGS[schemaType];
    if (!mappings) return;

    for (const [property, config] of Object.entries(mappings)) {
      const value = this._getNestedValue(item, property);
      if (value) {
        // Store context information
        if (config.context === 'company' && typeof value === 'object') {
          context.company = value.name || value;
        } else if (config.context === 'location') {
          context.location = this._extractLocation(value);
        } else if (config.context === 'salary') {
          context.salary = this._extractSalary(value);
        }

        // Store field hints
        for (const fieldType of config.fields) {
          if (!context.fieldHints[fieldType]) {
            context.fieldHints[fieldType] = {
              sources: [],
              confidence: 0
            };
          }

          context.fieldHints[fieldType].sources.push({
            schemaType,
            property,
            context: config.context
          });

          // Calculate confidence based on context weight
          const weight = this.CONTEXT_WEIGHTS[config.context] || 1.0;
          const baseConfidence = 0.80;
          context.fieldHints[fieldType].confidence = Math.min(
            0.90,
            Math.max(context.fieldHints[fieldType].confidence, baseConfidence * weight)
          );
        }
      }
    }

    // Recursively process nested objects
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'object' && value !== null && !key.startsWith('@')) {
        const nestedType = this._getSchemaType(value);
        if (nestedType) {
          this._extractFieldHints(value, nestedType, context);
        }
      }
    }
  },

  /**
   * Get nested value from object using dot notation support
   * @param {Object} obj - Source object
   * @param {string} path - Property path
   * @returns {*} Value at path
   */
  _getNestedValue(obj, path) {
    if (!obj || !path) return null;

    // Direct property
    if (obj[path] !== undefined) return obj[path];

    // Nested path
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    return current;
  },

  /**
   * Extract location from schema location data
   * @param {Object|string} locationData - Location data
   * @returns {Object} Extracted location
   */
  _extractLocation(locationData) {
    if (typeof locationData === 'string') {
      return { raw: locationData };
    }

    const location = {};

    if (locationData.address) {
      const addr = locationData.address;
      if (typeof addr === 'string') {
        location.raw = addr;
      } else {
        location.city = addr.addressLocality;
        location.state = addr.addressRegion;
        location.country = addr.addressCountry;
        location.zipCode = addr.postalCode;
      }
    } else {
      location.city = locationData.addressLocality;
      location.state = locationData.addressRegion;
      location.country = locationData.addressCountry;
    }

    return location;
  },

  /**
   * Extract salary from schema salary data
   * @param {Object|string} salaryData - Salary data
   * @returns {Object} Extracted salary
   */
  _extractSalary(salaryData) {
    if (typeof salaryData === 'string') {
      return { raw: salaryData };
    }

    const salary = {};

    if (salaryData.value) {
      const value = salaryData.value;
      if (typeof value === 'object') {
        salary.min = value.minValue;
        salary.max = value.maxValue;
        salary.currency = value.currency || salaryData.currency;
      } else {
        salary.amount = value;
      }
    }

    salary.currency = salary.currency || salaryData.currency;
    salary.unitText = salaryData.unitText; // e.g., "YEAR", "HOUR"

    return salary;
  },

  /**
   * Get field hint confidence for a specific field type
   * @param {string} fieldType - Field type to check
   * @returns {Object|null} { confidence, sources } or null
   */
  getFieldHint(fieldType) {
    const context = this.getPageContext();

    if (context.fieldHints[fieldType]) {
      return context.fieldHints[fieldType];
    }

    return null;
  },

  /**
   * Check if current page has job application context
   * @returns {boolean}
   */
  isJobApplicationPage() {
    const context = this.getPageContext();
    return context.isJobApplication;
  },

  /**
   * Get all detected schema types on page
   * @returns {Array<string>}
   */
  getSchemaTypes() {
    const context = this.getPageContext();
    return context.schemaTypes;
  },

  /**
   * Clear cache (useful when navigating SPA pages)
   */
  clearCache() {
    this._cache.clear();
  },

  /**
   * Get confidence range for JSON-LD source
   * Used by signal aggregator
   * @returns {Object} { min, max, weight }
   */
  getConfidenceRange() {
    return { min: 0.80, max: 0.90, weight: 1.2 };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JSONLDFormHints = JSONLDFormHints;
}

// Register with namespace system
if (window.JobTrackerNamespace) {
  window.JobTrackerNamespace.registerModule('json-ld-form-hints');
}
