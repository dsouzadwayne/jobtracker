/**
 * NLP Label Analyzer for Enhanced Field Detection
 * Uses Compromise.js for semantic label analysis
 * Integrates with existing normalizeLabel() in compromise-extractor.js
 */

const NLPLabelAnalyzer = {
  // Semantic mappings: natural language → profile field type
  SEMANTIC_MAPPINGS: {
    // LinkedIn variations
    'linkedin profile': 'linkedIn',
    'linkedin url': 'linkedIn',
    'linkedin profile url': 'linkedIn',
    'linkedin address': 'linkedIn',
    'your linkedin': 'linkedIn',

    // Salary/CTC variations
    'expected salary': 'expectedCtc',
    'expected ctc': 'expectedCtc',
    'desired salary': 'expectedCtc',
    'salary expectation': 'expectedCtc',
    'expected compensation': 'expectedCtc',
    'expected annual salary': 'expectedCtc',
    'target salary': 'expectedCtc',
    'preferred salary': 'expectedCtc',
    'asking salary': 'expectedCtc',

    'current salary': 'currentCtc',
    'current ctc': 'currentCtc',
    'present salary': 'currentCtc',
    'existing salary': 'currentCtc',
    'current compensation': 'currentCtc',
    'current annual salary': 'currentCtc',

    // Name variations
    'full name': 'fullName',
    'complete name': 'fullName',
    'your name': 'fullName',
    'legal name': 'fullName',
    'candidate name': 'fullName',
    'applicant name': 'fullName',

    'first name': 'firstName',
    'given name': 'firstName',
    'forename': 'firstName',

    'last name': 'lastName',
    'family name': 'lastName',
    'surname': 'lastName',

    'middle name': 'middleName',
    'middle initial': 'middleName',

    // Contact variations
    'email address': 'email',
    'e-mail address': 'email',
    'your email': 'email',
    'contact email': 'email',

    'phone number': 'phone',
    'telephone number': 'phone',
    'mobile number': 'phone',
    'cell number': 'phone',
    'contact number': 'phone',
    'your phone': 'phone',

    // Social/Professional links
    'github profile': 'github',
    'github url': 'github',
    'github username': 'github',

    'portfolio url': 'portfolio',
    'portfolio website': 'portfolio',
    'personal website': 'portfolio',
    'personal site': 'portfolio',
    'your website': 'portfolio',

    'twitter handle': 'twitter',
    'twitter profile': 'twitter',
    'x handle': 'twitter',

    // Address variations
    'street address': 'street',
    'address line 1': 'street',
    'mailing address': 'street',

    'address line 2': 'addressLine2',
    'apartment number': 'addressLine2',
    'suite number': 'addressLine2',
    'unit number': 'addressLine2',

    'city name': 'city',
    'your city': 'city',

    'state province': 'state',
    'state region': 'state',
    'your state': 'state',

    'zip code': 'zipCode',
    'postal code': 'zipCode',
    'pin code': 'zipCode',

    'country name': 'country',
    'your country': 'country',

    // Work experience
    'current company': 'currentCompany',
    'current employer': 'currentCompany',
    'company name': 'currentCompany',
    'employer name': 'currentCompany',
    'present employer': 'currentCompany',

    'current title': 'currentTitle',
    'job title': 'currentTitle',
    'current position': 'currentTitle',
    'current role': 'currentTitle',
    'position title': 'currentTitle',

    'years of experience': 'yearsExperience',
    'total experience': 'yearsExperience',
    'work experience': 'yearsExperience',
    'professional experience': 'yearsExperience',

    'notice period': 'noticePeriod',
    'joining time': 'noticePeriod',
    'availability': 'noticePeriod',

    // Education
    'school name': 'school',
    'university name': 'school',
    'college name': 'school',
    'institution name': 'school',

    'degree name': 'degree',
    'qualification': 'degree',
    'educational qualification': 'degree',

    'field of study': 'fieldOfStudy',
    'major subject': 'fieldOfStudy',
    'specialization': 'fieldOfStudy',

    'graduation year': 'graduationYear',
    'year of graduation': 'graduationYear',

    // Cover letter
    'cover letter': 'coverLetter',
    'motivation letter': 'coverLetter',
    'introduction letter': 'coverLetter',

    // Skills
    'technical skills': 'technicalSkills',
    'programming languages': 'technicalSkills',
    'coding skills': 'technicalSkills',

    'soft skills': 'softSkills',
    'interpersonal skills': 'softSkills'
  },

  // Keyword patterns for fallback matching
  KEYWORD_PATTERNS: {
    email: /\b(email|e-mail|mail)\b/i,
    phone: /\b(phone|mobile|cell|tel|telephone)\b/i,
    firstName: /\b(first|given|forename)\b.*\bname\b|\bfirst\s*name\b/i,
    lastName: /\b(last|family|surname)\b.*\bname\b|\blast\s*name\b/i,
    fullName: /\b(full|complete|your|legal)\s*name\b/i,
    linkedIn: /\blinkedin\b/i,
    github: /\bgithub\b/i,
    portfolio: /\b(portfolio|website|site)\b/i,
    street: /\b(street|address)\b/i,
    city: /\bcity\b/i,
    state: /\b(state|province|region)\b/i,
    zipCode: /\b(zip|postal|pin)\s*(code)?\b/i,
    country: /\bcountry\b/i,
    currentCtc: /\b(current|present|existing)\s*(salary|ctc|compensation)\b/i,
    expectedCtc: /\b(expected|desired|target|asking)\s*(salary|ctc|compensation)\b/i,
    yearsExperience: /\b(years?|total)\s*(of)?\s*(experience|exp)\b/i,
    noticePeriod: /\bnotice\s*period\b/i,
    school: /\b(school|university|college|institution)\b/i,
    degree: /\b(degree|qualification|diploma)\b/i,
    coverLetter: /\bcover\s*letter\b/i
  },

  // Question words to strip during extraction
  QUESTION_WORDS: ['what', 'which', 'where', 'who', 'how', 'when', 'please', 'enter', 'provide', 'type', 'input', 'your', 'the', 'is', 'are', 'do', 'does'],

  /**
   * Analyze a label and return field type with confidence
   * @param {string} labelText - The label text to analyze
   * @returns {Object|null} { fieldType, confidence, method }
   */
  analyzeLabel(labelText) {
    if (!labelText || typeof labelText !== 'string') {
      return null;
    }

    const cleanedLabel = this._cleanLabel(labelText);
    if (!cleanedLabel) return null;

    // Step 1: Try semantic mapping (highest confidence)
    const semanticMatch = this._matchSemanticMapping(cleanedLabel);
    if (semanticMatch) {
      return {
        fieldType: semanticMatch.fieldType,
        confidence: semanticMatch.confidence,
        method: 'semantic-mapping'
      };
    }

    // Step 2: Try question extraction
    const questionMatch = this._extractFromQuestion(labelText);
    if (questionMatch) {
      return {
        fieldType: questionMatch.fieldType,
        confidence: questionMatch.confidence,
        method: 'question-extraction'
      };
    }

    // Step 3: Try keyword fallback
    const keywordMatch = this._matchKeywordPatterns(cleanedLabel);
    if (keywordMatch) {
      return {
        fieldType: keywordMatch.fieldType,
        confidence: keywordMatch.confidence,
        method: 'keyword-fallback'
      };
    }

    return null;
  },

  /**
   * Clean and normalize label text
   * @param {string} text - Raw label text
   * @returns {string} Cleaned label
   */
  _cleanLabel(text) {
    return text
      .toLowerCase()
      .replace(/[*:?!]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  },

  /**
   * Match against semantic mappings
   * @param {string} cleanedLabel - Cleaned label text
   * @returns {Object|null} Match result
   */
  _matchSemanticMapping(cleanedLabel) {
    // Direct match
    if (this.SEMANTIC_MAPPINGS[cleanedLabel]) {
      return {
        fieldType: this.SEMANTIC_MAPPINGS[cleanedLabel],
        confidence: 0.85
      };
    }

    // Partial/fuzzy match - check if label contains a mapping key
    for (const [key, fieldType] of Object.entries(this.SEMANTIC_MAPPINGS)) {
      // Check if cleaned label contains the key
      if (cleanedLabel.includes(key)) {
        return {
          fieldType,
          confidence: 0.80
        };
      }

      // Check if key contains cleaned label (for shorter inputs)
      if (key.includes(cleanedLabel) && cleanedLabel.length >= 4) {
        return {
          fieldType,
          confidence: 0.75
        };
      }
    }

    return null;
  },

  /**
   * Extract field type from question-style labels
   * e.g., "What is your LinkedIn profile URL?" → linkedIn
   * @param {string} labelText - Original label text
   * @returns {Object|null} Match result
   */
  _extractFromQuestion(labelText) {
    const lowerText = labelText.toLowerCase();

    // Check if it looks like a question
    const isQuestion = /^(what|which|where|who|how|please|enter|provide)/i.test(lowerText) ||
                       lowerText.includes('?');

    if (!isQuestion) return null;

    // Remove question words and common filler words
    let extracted = lowerText;
    for (const word of this.QUESTION_WORDS) {
      extracted = extracted.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    }

    // Clean up
    extracted = extracted
      .replace(/[?!.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!extracted) return null;

    // Now try to match the extracted phrase
    const semanticMatch = this._matchSemanticMapping(extracted);
    if (semanticMatch) {
      return {
        fieldType: semanticMatch.fieldType,
        confidence: Math.min(semanticMatch.confidence, 0.80)  // Slightly lower confidence for extracted phrases
      };
    }

    // Try keyword matching on extracted phrase
    const keywordMatch = this._matchKeywordPatterns(extracted);
    if (keywordMatch) {
      return {
        fieldType: keywordMatch.fieldType,
        confidence: Math.min(keywordMatch.confidence, 0.75)
      };
    }

    return null;
  },

  /**
   * Match against keyword patterns (fallback)
   * @param {string} text - Text to match
   * @returns {Object|null} Match result
   */
  _matchKeywordPatterns(text) {
    for (const [fieldType, pattern] of Object.entries(this.KEYWORD_PATTERNS)) {
      if (pattern.test(text)) {
        return {
          fieldType,
          confidence: 0.60  // Lower confidence for keyword fallback
        };
      }
    }
    return null;
  },

  /**
   * Batch analyze multiple labels
   * @param {Array<string>} labels - Array of label texts
   * @returns {Array<Object>} Array of analysis results
   */
  analyzeLabels(labels) {
    return labels.map(label => ({
      original: label,
      ...this.analyzeLabel(label)
    }));
  },

  /**
   * Get confidence range for a method type
   * Used by signal aggregator
   * @param {string} method - Method name
   * @returns {Object} { min, max, weight }
   */
  getConfidenceRange(method) {
    const ranges = {
      'semantic-mapping': { min: 0.75, max: 0.85, weight: 1.0 },
      'question-extraction': { min: 0.70, max: 0.80, weight: 1.0 },
      'keyword-fallback': { min: 0.55, max: 0.65, weight: 1.0 }
    };
    return ranges[method] || { min: 0.50, max: 0.60, weight: 0.8 };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.NLPLabelAnalyzer = NLPLabelAnalyzer;

  // Add method to get semantic mappings from registry if available
  NLPLabelAnalyzer.getSemanticMappings = function() {
    // Prefer registry mappings if available
    if (window.JobTrackerFieldRegistry) {
      return window.JobTrackerFieldRegistry.getSemanticMapping();
    }
    return this.SEMANTIC_MAPPINGS;
  };

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('nlp-label-analyzer');
  }
}
