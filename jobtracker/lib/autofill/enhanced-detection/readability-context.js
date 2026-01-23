/**
 * Readability Context Analyzer
 * Uses page structure for form context understanding
 * Extracts section headers, form instructions, and classifies form sections
 */

const ReadabilityContext = {
  // Cache for page analysis (per URL)
  _cache: new Map(),
  _cacheExpiry: 5 * 60 * 1000, // 5 minutes

  // Section classification keywords
  SECTION_KEYWORDS: {
    personal: [
      'personal', 'contact', 'about you', 'your information', 'basic info',
      'personal details', 'personal information', 'contact information',
      'your details', 'candidate information', 'applicant information'
    ],
    experience: [
      'experience', 'work history', 'employment', 'professional',
      'work experience', 'employment history', 'career', 'previous roles',
      'previous positions', 'job history'
    ],
    education: [
      'education', 'academic', 'qualifications', 'degree', 'school',
      'educational background', 'academic history', 'training',
      'certifications', 'certificates'
    ],
    skills: [
      'skills', 'expertise', 'competencies', 'technical', 'abilities',
      'technical skills', 'core competencies', 'proficiencies',
      'languages', 'tools', 'technologies'
    ],
    application: [
      'application', 'apply', 'submit', 'cover letter', 'resume',
      'application form', 'job application', 'apply now', 'documents',
      'attachments', 'upload'
    ],
    diversity: [
      'diversity', 'equal opportunity', 'eeo', 'demographic', 'voluntary',
      'self-identification', 'optional', 'veteran', 'disability',
      'gender', 'ethnicity'
    ],
    compensation: [
      'compensation', 'salary', 'pay', 'benefits', 'ctc', 'package',
      'salary expectations', 'expected compensation', 'remuneration'
    ]
  },

  // Form type indicators
  FORM_TYPE_KEYWORDS: {
    jobApplication: [
      'apply', 'application', 'job', 'career', 'position', 'candidate',
      'applicant', 'resume', 'cv', 'cover letter', 'hiring'
    ],
    registration: [
      'register', 'sign up', 'create account', 'join', 'member'
    ],
    contact: [
      'contact us', 'get in touch', 'reach out', 'inquiry', 'message'
    ],
    profile: [
      'profile', 'settings', 'account', 'preferences', 'update your'
    ]
  },

  /**
   * Analyze page context (cached)
   * @returns {Object} Page context analysis
   */
  getPageContext() {
    const url = window.location.href;

    // Check cache
    const cached = this._cache.get(url);
    if (cached && (Date.now() - cached.timestamp) < this._cacheExpiry) {
      return cached.context;
    }

    // Analyze page
    const context = this._analyzePage();

    // Cache result
    this._cache.set(url, {
      context,
      timestamp: Date.now()
    });

    return context;
  },

  /**
   * Analyze the current page structure
   * @returns {Object} Page analysis
   */
  _analyzePage() {
    const context = {
      title: document.title,
      formType: null,
      formTypeConfidence: 0,
      sections: [],
      currentSection: null,
      formInstructions: [],
      pageKeywords: [],
      nearbyHeaders: new Map()
    };

    // Analyze page title and URL
    this._analyzePageIdentifiers(context);

    // Find and analyze forms
    this._analyzeForms(context);

    // Extract section information
    this._extractSections(context);

    // Determine form type
    this._determineFormType(context);

    return context;
  },

  /**
   * Analyze page title and URL for context
   * @param {Object} context - Context to populate
   */
  _analyzePageIdentifiers(context) {
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    const keywords = new Set();

    // Extract keywords from title
    for (const [type, typeKeywords] of Object.entries(this.FORM_TYPE_KEYWORDS)) {
      for (const keyword of typeKeywords) {
        if (title.includes(keyword) || pathname.includes(keyword)) {
          keywords.add(keyword);
        }
      }
    }

    // Check URL path segments
    const pathSegments = pathname.split('/').filter(Boolean);
    for (const segment of pathSegments) {
      if (['apply', 'application', 'career', 'jobs', 'careers', 'hiring'].includes(segment)) {
        keywords.add(segment);
      }
    }

    context.pageKeywords = [...keywords];
  },

  /**
   * Analyze forms on the page
   * @param {Object} context - Context to populate
   */
  _analyzeForms(context) {
    const forms = document.querySelectorAll('form');

    forms.forEach((form, index) => {
      // Look for form instructions (text before or inside form)
      const formInstructions = this._extractFormInstructions(form);
      context.formInstructions.push(...formInstructions);

      // Map inputs to their nearest headers
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const nearbyHeader = this._findNearestHeader(input);
        if (nearbyHeader) {
          context.nearbyHeaders.set(input, nearbyHeader);
        }
      });
    });

    // Also check for form-like containers (div with multiple inputs)
    if (forms.length === 0) {
      const containers = document.querySelectorAll('[class*="form"], [class*="application"], [id*="form"], [id*="application"]');
      containers.forEach(container => {
        const inputs = container.querySelectorAll('input, select, textarea');
        if (inputs.length >= 3) {
          const formInstructions = this._extractFormInstructions(container);
          context.formInstructions.push(...formInstructions);

          inputs.forEach(input => {
            const nearbyHeader = this._findNearestHeader(input);
            if (nearbyHeader) {
              context.nearbyHeaders.set(input, nearbyHeader);
            }
          });
        }
      });
    }
  },

  /**
   * Extract form instructions text
   * @param {HTMLElement} formOrContainer - Form or form-like container
   * @returns {Array<string>} Instruction texts
   */
  _extractFormInstructions(formOrContainer) {
    const instructions = [];

    // Check for instruction elements
    const instructionSelectors = [
      '.form-instructions',
      '.instructions',
      '.form-description',
      '.help-text',
      '[class*="instruction"]',
      '[class*="description"]',
      'p:first-of-type',
      '.form-header p'
    ];

    for (const selector of instructionSelectors) {
      const elements = formOrContainer.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 20 && text.length < 500) {
          instructions.push(text);
        }
      });
    }

    // Check preceding sibling for instructions
    const prevSibling = formOrContainer.previousElementSibling;
    if (prevSibling && ['P', 'DIV', 'SPAN'].includes(prevSibling.tagName)) {
      const text = prevSibling.textContent.trim();
      if (text && text.length > 20 && text.length < 500) {
        instructions.push(text);
      }
    }

    return instructions;
  },

  /**
   * Extract page sections based on headers
   * @param {Object} context - Context to populate
   */
  _extractSections(context) {
    const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="heading"], [class*="header"], [class*="title"]');

    headers.forEach(header => {
      const headerText = header.textContent.trim().toLowerCase();
      if (!headerText || headerText.length > 100) return;

      const section = {
        text: header.textContent.trim(),
        element: header,
        type: this._classifySection(headerText),
        confidence: 0
      };

      // Calculate confidence based on keyword matches
      if (section.type) {
        const keywords = this.SECTION_KEYWORDS[section.type] || [];
        const matchCount = keywords.filter(k => headerText.includes(k)).length;
        section.confidence = Math.min(0.60, 0.40 + (matchCount * 0.10));
      }

      context.sections.push(section);
    });
  },

  /**
   * Classify a section based on header text
   * @param {string} headerText - Header text (lowercase)
   * @returns {string|null} Section type
   */
  _classifySection(headerText) {
    for (const [type, keywords] of Object.entries(this.SECTION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (headerText.includes(keyword)) {
          return type;
        }
      }
    }
    return null;
  },

  /**
   * Find the nearest header to an input element
   * @param {HTMLElement} input - Input element
   * @returns {Object|null} Header info
   */
  _findNearestHeader(input) {
    let current = input;
    let distance = 0;
    const maxDistance = 5; // Max parent levels to check

    while (current && distance < maxDistance) {
      // Check previous siblings
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName)) {
          const text = sibling.textContent.trim().toLowerCase();
          return {
            text: sibling.textContent.trim(),
            type: this._classifySection(text),
            distance
          };
        }

        // Check for heading classes
        if (sibling.className && /heading|header|title|section/i.test(sibling.className)) {
          const text = sibling.textContent.trim().toLowerCase();
          if (text.length < 100) {
            return {
              text: sibling.textContent.trim(),
              type: this._classifySection(text),
              distance
            };
          }
        }

        sibling = sibling.previousElementSibling;
      }

      current = current.parentElement;
      distance++;
    }

    return null;
  },

  /**
   * Determine the form type based on collected context
   * @param {Object} context - Context to update
   */
  _determineFormType(context) {
    const scores = {};

    // Score based on page keywords
    for (const [type, keywords] of Object.entries(this.FORM_TYPE_KEYWORDS)) {
      scores[type] = 0;
      for (const keyword of keywords) {
        if (context.pageKeywords.includes(keyword)) {
          scores[type] += 1;
        }
      }

      // Check form instructions
      for (const instruction of context.formInstructions) {
        for (const keyword of keywords) {
          if (instruction.toLowerCase().includes(keyword)) {
            scores[type] += 0.5;
          }
        }
      }
    }

    // Find highest scoring type
    let maxScore = 0;
    let bestType = null;
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = type;
      }
    }

    if (bestType && maxScore >= 1) {
      context.formType = bestType;
      context.formTypeConfidence = Math.min(0.60, 0.30 + (maxScore * 0.15));
    }
  },

  /**
   * Get section context for a specific input element
   * @param {HTMLElement} input - Input element
   * @returns {Object|null} Section context
   */
  getSectionForInput(input) {
    const context = this.getPageContext();

    // Check cached nearby headers
    if (context.nearbyHeaders.has(input)) {
      return context.nearbyHeaders.get(input);
    }

    // Try to find section dynamically
    return this._findNearestHeader(input);
  },

  /**
   * Get inferred field types based on section context
   * @param {string} sectionType - Section type
   * @returns {Array<string>} Likely field types for this section
   */
  getFieldTypesForSection(sectionType) {
    const sectionFieldTypes = {
      personal: ['firstName', 'lastName', 'fullName', 'email', 'phone', 'street', 'city', 'state', 'zipCode', 'country'],
      experience: ['currentCompany', 'currentTitle', 'yearsExperience', 'workStartDate', 'workEndDate', 'workDescription'],
      education: ['school', 'degree', 'fieldOfStudy', 'graduationYear', 'gpa'],
      skills: ['technicalSkills', 'frameworks', 'tools', 'softSkills', 'skills'],
      application: ['coverLetter', 'resume'],
      diversity: ['gender', 'veteranStatus', 'disability', 'nationality'],
      compensation: ['currentCtc', 'expectedCtc', 'noticePeriod']
    };

    return sectionFieldTypes[sectionType] || [];
  },

  /**
   * Get field confidence boost based on section context
   * @param {HTMLElement} input - Input element
   * @param {string} fieldType - Proposed field type
   * @returns {number} Confidence boost (0-0.15)
   */
  getContextConfidenceBoost(input, fieldType) {
    const section = this.getSectionForInput(input);
    if (!section || !section.type) return 0;

    const expectedFields = this.getFieldTypesForSection(section.type);
    if (expectedFields.includes(fieldType)) {
      return 0.10; // Boost confidence when field matches section context
    }

    return 0;
  },

  /**
   * Check if current page is a job application form
   * @returns {boolean}
   */
  isJobApplicationPage() {
    const context = this.getPageContext();
    return context.formType === 'jobApplication';
  },

  /**
   * Clear cache (useful for SPA navigation)
   */
  clearCache() {
    this._cache.clear();
  },

  /**
   * Get confidence range for page context source
   * Used by signal aggregator
   * @returns {Object} { min, max, weight }
   */
  getConfidenceRange() {
    return { min: 0.50, max: 0.60, weight: 0.6 };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ReadabilityContext = ReadabilityContext;
}
