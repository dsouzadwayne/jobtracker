/**
 * Smart Field Matcher
 * Uses multi-signal scoring system (similar to job extraction) to identify form fields
 * Combines: field attributes, labels, context, position, and ML-like confidence scoring
 */

(function() {
  'use strict';

  if (window.__jobTrackerSmartFieldMatcherInitialized) return;
  window.__jobTrackerSmartFieldMatcherInitialized = true;

  /**
   * Field type definitions with weighted signals
   * Each field type has patterns for different signal sources
   */
  const FIELD_TYPES = {
    firstName: {
      weight: 1.0,
      patterns: {
        id: [/^first[-_]?name$/i, /^fname$/i, /^given[-_]?name$/i, /^first$/i],
        name: [/first[-_]?name/i, /fname/i, /given[-_]?name/i],
        label: [/first\s*name/i, /given\s*name/i, /^first$/i, /prénom/i, /vorname/i, /nombre/i],
        placeholder: [/first\s*name/i, /given\s*name/i, /e\.?g\.?\s*john/i],
        autocomplete: [/^given-name$/i, /^first-name$/i],
        dataTest: [/first[-_]?name/i, /personal.*first/i]
      },
      negativePatterns: [/middle/i, /last/i, /surname/i, /company/i],
      contextClues: ['personal', 'contact', 'name', 'info'],
      inputType: ['text'],
      profilePath: 'personal.firstName'
    },

    lastName: {
      weight: 1.0,
      patterns: {
        id: [/^last[-_]?name$/i, /^lname$/i, /^surname$/i, /^family[-_]?name$/i],
        name: [/last[-_]?name/i, /lname/i, /surname/i, /family[-_]?name/i],
        label: [/last\s*name/i, /family\s*name/i, /surname/i, /^last$/i, /nom\s*de\s*famille/i, /nachname/i, /apellido/i],
        placeholder: [/last\s*name/i, /family\s*name/i, /surname/i, /e\.?g\.?\s*doe/i],
        autocomplete: [/^family-name$/i, /^last-name$/i, /^surname$/i],
        dataTest: [/last[-_]?name/i, /personal.*last/i]
      },
      negativePatterns: [/first/i, /middle/i, /given/i, /company/i],
      contextClues: ['personal', 'contact', 'name', 'info'],
      inputType: ['text'],
      profilePath: 'personal.lastName'
    },

    email: {
      weight: 1.2, // Slightly higher weight - very identifiable
      patterns: {
        id: [/^e?-?mail$/i, /^email[-_]?address$/i, /^user[-_]?email$/i],
        name: [/e?-?mail/i, /email[-_]?address/i],
        label: [/e[-]?mail/i, /email\s*address/i, /correo/i, /courriel/i],
        placeholder: [/e[-]?mail/i, /you@example/i, /your@email/i, /email@/i],
        autocomplete: [/^email$/i],
        dataTest: [/email/i, /mail/i]
      },
      negativePatterns: [/confirm/i, /verify/i, /repeat/i, /re[-_]?enter/i],
      contextClues: ['contact', 'personal', 'account', 'login'],
      inputType: ['email', 'text'],
      profilePath: 'personal.email'
    },

    emailConfirm: {
      weight: 1.0,
      patterns: {
        id: [/confirm[-_]?email/i, /email[-_]?confirm/i, /verify[-_]?email/i, /re[-_]?email/i],
        name: [/confirm[-_]?email/i, /email[-_]?confirm/i, /email2/i],
        label: [/confirm.*email/i, /verify.*email/i, /re[-_]?enter.*email/i, /email.*again/i],
        placeholder: [/confirm.*email/i, /re[-_]?enter/i, /type.*again/i],
        autocomplete: [/^email$/i],
        dataTest: [/confirm.*email/i, /email.*confirm/i]
      },
      negativePatterns: [],
      requiresPatterns: [/confirm/i, /verify/i, /re[-_]?enter/i, /again/i], // Must match one of these
      contextClues: ['contact', 'personal'],
      inputType: ['email', 'text'],
      profilePath: 'personal.email'
    },

    phone: {
      weight: 1.1,
      patterns: {
        id: [/^phone$/i, /^mobile$/i, /^tel$/i, /^phone[-_]?number$/i, /^cell$/i],
        name: [/phone/i, /mobile/i, /tel/i, /cell/i],
        label: [/phone/i, /mobile/i, /telephone/i, /cell/i, /contact\s*number/i, /téléphone/i, /telefon/i],
        placeholder: [/phone/i, /mobile/i, /\(\d{3}\)/i, /xxx[-\s]xxx/i],
        autocomplete: [/^tel$/i, /^phone$/i, /^mobile$/i],
        dataTest: [/phone/i, /mobile/i, /tel/i]
      },
      negativePatterns: [/fax/i, /work[-_]?phone/i, /office/i, /alternate/i],
      contextClues: ['contact', 'personal', 'phone'],
      inputType: ['tel', 'text', 'number'],
      profilePath: 'personal.phone'
    },

    linkedin: {
      weight: 1.0,
      patterns: {
        id: [/linkedin/i, /linked[-_]?in/i],
        name: [/linkedin/i, /linked[-_]?in/i],
        label: [/linkedin/i, /linked\s*in/i],
        placeholder: [/linkedin\.com/i, /linkedin.*url/i, /linkedin.*profile/i],
        autocomplete: [],
        dataTest: [/linkedin/i]
      },
      negativePatterns: [],
      contextClues: ['social', 'profile', 'web', 'links'],
      inputType: ['text', 'url'],
      profilePath: 'personal.linkedIn'
    },

    github: {
      weight: 1.0,
      patterns: {
        id: [/github/i, /git[-_]?hub/i],
        name: [/github/i, /git[-_]?hub/i],
        label: [/github/i, /git\s*hub/i],
        placeholder: [/github\.com/i, /github.*url/i, /github.*profile/i],
        autocomplete: [],
        dataTest: [/github/i]
      },
      negativePatterns: [],
      contextClues: ['social', 'profile', 'web', 'developer', 'code'],
      inputType: ['text', 'url'],
      profilePath: 'personal.github'
    },

    twitter: {
      weight: 1.0,
      patterns: {
        id: [/twitter/i, /^x$/i],
        name: [/twitter/i],
        label: [/twitter/i, /x\s*\(.*twitter\)/i, /^x$/i],
        placeholder: [/twitter\.com/i, /x\.com/i, /@username/i],
        autocomplete: [],
        dataTest: [/twitter/i]
      },
      negativePatterns: [],
      contextClues: ['social', 'profile', 'web'],
      inputType: ['text', 'url'],
      profilePath: 'personal.twitter'
    },

    facebook: {
      weight: 1.0,
      patterns: {
        id: [/facebook/i, /fb/i],
        name: [/facebook/i, /fb/i],
        label: [/facebook/i],
        placeholder: [/facebook\.com/i, /fb\.com/i],
        autocomplete: [],
        dataTest: [/facebook/i]
      },
      negativePatterns: [],
      contextClues: ['social', 'profile', 'web'],
      inputType: ['text', 'url'],
      profilePath: 'personal.facebook'
    },

    website: {
      weight: 0.9,
      patterns: {
        id: [/website/i, /portfolio/i, /homepage/i, /personal[-_]?url/i, /blog/i],
        name: [/website/i, /portfolio/i, /homepage/i, /url/i],
        label: [/website/i, /portfolio/i, /personal.*site/i, /homepage/i, /blog/i, /your.*url/i],
        placeholder: [/https?:\/\//i, /your.*website/i, /example\.com/i],
        autocomplete: [/^url$/i],
        dataTest: [/website/i, /portfolio/i]
      },
      negativePatterns: [/linkedin/i, /github/i, /twitter/i, /facebook/i, /company/i],
      contextClues: ['social', 'profile', 'web', 'links'],
      inputType: ['text', 'url'],
      profilePath: 'personal.portfolio'
    },

    city: {
      weight: 0.9,
      patterns: {
        id: [/^city$/i, /^location$/i, /^town$/i],
        name: [/city/i, /location/i, /town/i],
        label: [/^city$/i, /city\s*\//i, /location/i, /town/i, /place.*residence/i],
        placeholder: [/city/i, /e\.?g\.?\s*(new york|london|mumbai)/i],
        autocomplete: [/^address-level2$/i, /^city$/i],
        dataTest: [/city/i, /location/i]
      },
      negativePatterns: [/job[-_]?location/i, /work[-_]?location/i, /country/i, /state/i, /zip/i],
      contextClues: ['address', 'personal', 'location', 'residence'],
      inputType: ['text'],
      profilePath: 'personal.address.city'
    },

    state: {
      weight: 0.9,
      patterns: {
        id: [/^state$/i, /^province$/i, /^region$/i],
        name: [/state/i, /province/i, /region/i],
        label: [/state/i, /province/i, /region/i, /county/i],
        placeholder: [/state/i, /province/i],
        autocomplete: [/^address-level1$/i, /^state$/i],
        dataTest: [/state/i, /province/i]
      },
      negativePatterns: [/country/i, /city/i, /zip/i],
      contextClues: ['address', 'personal', 'location'],
      inputType: ['text'],
      profilePath: 'personal.address.state'
    },

    country: {
      weight: 0.9,
      patterns: {
        id: [/^country$/i, /^nation$/i],
        name: [/country/i, /nation/i],
        label: [/country/i, /nation/i],
        placeholder: [/country/i, /select.*country/i],
        autocomplete: [/^country$/i, /^country-name$/i],
        dataTest: [/country/i]
      },
      negativePatterns: [/city/i, /state/i, /zip/i, /code/i],
      contextClues: ['address', 'personal', 'location'],
      inputType: ['text'],
      profilePath: 'personal.address.country'
    },

    zipCode: {
      weight: 0.9,
      patterns: {
        id: [/zip/i, /postal/i, /postcode/i, /pin[-_]?code/i],
        name: [/zip/i, /postal/i, /postcode/i, /pin[-_]?code/i],
        label: [/zip/i, /postal/i, /post\s*code/i, /pin\s*code/i],
        placeholder: [/zip/i, /postal/i, /\d{5}/i, /\d{6}/i],
        autocomplete: [/^postal-code$/i, /^zip$/i],
        dataTest: [/zip/i, /postal/i, /pincode/i]
      },
      negativePatterns: [/city/i, /state/i, /country/i],
      contextClues: ['address', 'personal', 'location'],
      inputType: ['text', 'number'],
      profilePath: 'personal.address.zipCode'
    },

    street: {
      weight: 0.8,
      patterns: {
        id: [/street/i, /address[-_]?1/i, /address[-_]?line/i],
        name: [/street/i, /address/i, /addr1/i],
        label: [/street/i, /address\s*(line)?\s*1?$/i, /mailing.*address/i],
        placeholder: [/street/i, /address/i, /123.*main/i],
        autocomplete: [/^street-address$/i, /^address-line1$/i],
        dataTest: [/street/i, /address/i]
      },
      negativePatterns: [/email/i, /web/i, /url/i, /city/i, /state/i, /zip/i, /country/i],
      contextClues: ['address', 'personal', 'location', 'mailing'],
      inputType: ['text'],
      profilePath: 'personal.address.street'
    },

    currentCompany: {
      weight: 0.8,
      patterns: {
        id: [/current[-_]?company/i, /employer/i, /company[-_]?name/i],
        name: [/current[-_]?company/i, /employer/i, /company/i],
        label: [/current.*company/i, /current.*employer/i, /company\s*name/i, /employer/i, /organization/i],
        placeholder: [/company/i, /employer/i, /organization/i],
        autocomplete: [/^organization$/i],
        dataTest: [/company/i, /employer/i]
      },
      negativePatterns: [/previous/i, /past/i, /former/i],
      contextClues: ['experience', 'work', 'employment', 'professional'],
      inputType: ['text'],
      profilePath: 'workHistory.0.company'
    },

    currentTitle: {
      weight: 0.8,
      patterns: {
        id: [/current[-_]?title/i, /job[-_]?title/i, /position/i, /role/i, /designation/i],
        name: [/title/i, /position/i, /role/i, /designation/i],
        label: [/current.*title/i, /job.*title/i, /position/i, /role/i, /designation/i],
        placeholder: [/title/i, /position/i, /role/i, /e\.?g\.?\s*software/i],
        autocomplete: [/^organization-title$/i],
        dataTest: [/title/i, /position/i, /role/i]
      },
      negativePatterns: [/previous/i, /past/i, /former/i, /mr\./i, /mrs\./i, /ms\./i, /dr\./i],
      contextClues: ['experience', 'work', 'employment', 'professional'],
      inputType: ['text'],
      profilePath: 'workHistory.0.title'
    },

    school: {
      weight: 0.8,
      patterns: {
        id: [/school/i, /university/i, /college/i, /institution/i, /edu[-_]?name/i],
        name: [/school/i, /university/i, /college/i, /institution/i],
        label: [/school/i, /university/i, /college/i, /institution/i, /alma\s*mater/i],
        placeholder: [/school/i, /university/i, /college/i],
        autocomplete: [],
        dataTest: [/school/i, /university/i, /college/i, /institution/i]
      },
      negativePatterns: [/high\s*school/i],
      contextClues: ['education', 'academic', 'study'],
      inputType: ['text'],
      profilePath: 'education.0.school'
    },

    degree: {
      weight: 0.8,
      patterns: {
        id: [/degree/i, /qualification/i, /diploma/i],
        name: [/degree/i, /qualification/i],
        label: [/degree/i, /qualification/i, /diploma/i, /level.*education/i],
        placeholder: [/degree/i, /bachelor/i, /master/i, /phd/i],
        autocomplete: [],
        dataTest: [/degree/i, /qualification/i]
      },
      negativePatterns: [],
      contextClues: ['education', 'academic', 'study'],
      inputType: ['text'],
      profilePath: 'education.0.degree'
    },

    fieldOfStudy: {
      weight: 0.8,
      patterns: {
        id: [/field[-_]?of[-_]?study/i, /major/i, /specialization/i, /course/i],
        name: [/field/i, /major/i, /specialization/i, /course/i],
        label: [/field.*study/i, /major/i, /specialization/i, /course/i, /subject/i],
        placeholder: [/major/i, /field/i, /computer\s*science/i],
        autocomplete: [],
        dataTest: [/field/i, /major/i, /specialization/i]
      },
      negativePatterns: [],
      contextClues: ['education', 'academic', 'study'],
      inputType: ['text'],
      profilePath: 'education.0.fieldOfStudy'
    },

    currentSalary: {
      weight: 0.7,
      patterns: {
        id: [/current[-_]?salary/i, /current[-_]?ctc/i, /present[-_]?salary/i],
        name: [/current[-_]?salary/i, /current[-_]?ctc/i, /ctc/i],
        label: [/current.*salary/i, /current.*ctc/i, /present.*salary/i, /existing.*salary/i],
        placeholder: [/salary/i, /ctc/i, /lpa/i, /lakhs/i],
        autocomplete: [],
        dataTest: [/current.*salary/i, /current.*ctc/i]
      },
      negativePatterns: [/expected/i, /desired/i],
      contextClues: ['salary', 'compensation', 'ctc', 'pay'],
      inputType: ['text', 'number'],
      profilePath: 'personal.currentCtc'
    },

    expectedSalary: {
      weight: 0.7,
      patterns: {
        id: [/expected[-_]?salary/i, /expected[-_]?ctc/i, /desired[-_]?salary/i],
        name: [/expected[-_]?salary/i, /expected[-_]?ctc/i, /desired/i],
        label: [/expected.*salary/i, /expected.*ctc/i, /desired.*salary/i, /salary.*expectation/i],
        placeholder: [/expected/i, /desired/i, /lpa/i],
        autocomplete: [],
        dataTest: [/expected.*salary/i, /expected.*ctc/i, /desired/i]
      },
      negativePatterns: [/current/i, /present/i],
      contextClues: ['salary', 'compensation', 'ctc', 'pay', 'expectation'],
      inputType: ['text', 'number'],
      profilePath: 'personal.expectedCtc'
    },

    noticePeriod: {
      weight: 0.7,
      patterns: {
        id: [/notice[-_]?period/i, /notice/i, /availability/i],
        name: [/notice/i, /availability/i],
        label: [/notice.*period/i, /notice/i, /availability/i, /when.*join/i, /start.*date/i],
        placeholder: [/notice/i, /days/i, /weeks/i, /immediate/i],
        autocomplete: [],
        dataTest: [/notice/i, /availability/i]
      },
      negativePatterns: [],
      contextClues: ['notice', 'availability', 'joining'],
      inputType: ['text', 'number'],
      profilePath: 'personal.noticePeriod'
    }
  };

  /**
   * Signal weights for scoring
   * Uses centralized config if available
   */
  const SIGNAL_WEIGHTS = (() => {
    if (window.JobTrackerConfig?.SIGNAL_WEIGHTS) {
      return window.JobTrackerConfig.SIGNAL_WEIGHTS;
    }
    return {
      id: 25,
      name: 20,
      autocomplete: 30,
      label: 20,
      placeholder: 15,
      dataTest: 18,
      formcontrolname: 22,
      ariaLabel: 18,
      contextBonus: 10,
      typeMatch: 8,
      negativePenalty: -40
    };
  })();

  /**
   * Get cache manager reference
   */
  function getCacheManager() {
    return window.JobTrackerCacheManager;
  }

  /**
   * Extract all signals from a field (with caching)
   */
  function extractSignals(field) {
    const cacheManager = getCacheManager();

    // Check cache first
    if (cacheManager) {
      const cached = cacheManager.getSignals(field);
      if (cached !== null) {
        return cached;
      }
    }

    // Extract signals
    const signals = _extractSignalsUncached(field);

    // Cache result
    if (cacheManager) {
      cacheManager.setSignals(field, signals);
    }

    return signals;
  }

  /**
   * Internal method to extract signals (uncached)
   */
  function _extractSignalsUncached(field) {
    const signals = {
      id: (field.getAttribute('id') || '').toLowerCase(),
      name: (field.getAttribute('name') || '').toLowerCase(),
      autocomplete: (field.getAttribute('autocomplete') || '').toLowerCase(),
      label: '',
      placeholder: (field.getAttribute('placeholder') || '').toLowerCase(),
      dataTest: (field.getAttribute('data-test') || field.closest('[data-test]')?.getAttribute('data-test') || '').toLowerCase(),
      formcontrolname: (field.getAttribute('formcontrolname') || field.closest('[formcontrolname]')?.getAttribute('formcontrolname') || '').toLowerCase(),
      ariaLabel: (field.getAttribute('aria-label') || '').toLowerCase(),
      type: (field.getAttribute('type') || field.tagName.toLowerCase()).toLowerCase(),
      context: ''
    };

    // Extract label text
    signals.label = extractLabelText(field).toLowerCase();

    // Extract context (section/parent info)
    signals.context = extractContext(field).toLowerCase();

    return signals;
  }

  /**
   * Extract label text for a field
   */
  function extractLabelText(field) {
    const texts = [];

    // Check for label attribute on custom components
    const labelAttr = field.getAttribute('label');
    if (labelAttr) texts.push(labelAttr);

    // Check for associated label via for/id
    const id = field.getAttribute('id');
    if (id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) texts.push(label.textContent);
      } catch (e) {}
    }

    // Check for parent label
    const parentLabel = field.closest('label');
    if (parentLabel) texts.push(parentLabel.textContent);

    // Check for nearby label in form group
    const formGroup = field.closest('.form-group, .field, [class*="field"], .spl-w-full, [class*="form-element"]');
    if (formGroup) {
      const label = formGroup.querySelector('label, .label, [class*="label"]');
      if (label) texts.push(label.textContent);
    }

    // Check for aria-labelledby
    const labelledBy = field.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) texts.push(labelEl.textContent);
    }

    return texts.filter(Boolean).join(' ').trim();
  }

  /**
   * Extract context from surrounding elements
   */
  function extractContext(field) {
    const contextParts = [];

    // Check parent sections
    const section = field.closest('section, fieldset, [data-test*="section"], [class*="section"], .form-section');
    if (section) {
      const header = section.querySelector('h1, h2, h3, h4, legend, [class*="title"], [class*="header"]');
      if (header) contextParts.push(header.textContent);

      // Also get section data-test or class
      const sectionTest = section.getAttribute('data-test');
      if (sectionTest) contextParts.push(sectionTest);
    }

    // Check wrapper element data-test
    const wrapper = field.closest('[data-test]');
    if (wrapper) {
      contextParts.push(wrapper.getAttribute('data-test'));
    }

    return contextParts.filter(Boolean).join(' ').trim();
  }

  /**
   * Calculate match score for a field against a field type
   */
  function calculateScore(signals, fieldType) {
    const config = FIELD_TYPES[fieldType];
    if (!config) return { score: 0, confidence: 0, matches: [] };

    let score = 0;
    const matches = [];

    // Check each pattern source
    for (const [source, patterns] of Object.entries(config.patterns)) {
      const signalValue = signals[source];
      if (!signalValue) continue;

      for (const pattern of patterns) {
        if (pattern.test(signalValue)) {
          const weight = SIGNAL_WEIGHTS[source] || 10;
          score += weight;
          matches.push({ source, pattern: pattern.toString(), weight });
          break; // Only count first match per source
        }
      }
    }

    // Check formcontrolname (very reliable for Angular apps)
    if (signals.formcontrolname) {
      for (const pattern of config.patterns.name || []) {
        if (pattern.test(signals.formcontrolname)) {
          score += SIGNAL_WEIGHTS.formcontrolname;
          matches.push({ source: 'formcontrolname', pattern: pattern.toString(), weight: SIGNAL_WEIGHTS.formcontrolname });
          break;
        }
      }
    }

    // Check aria-label
    if (signals.ariaLabel) {
      for (const pattern of config.patterns.label || []) {
        if (pattern.test(signals.ariaLabel)) {
          score += SIGNAL_WEIGHTS.ariaLabel;
          matches.push({ source: 'ariaLabel', pattern: pattern.toString(), weight: SIGNAL_WEIGHTS.ariaLabel });
          break;
        }
      }
    }

    // Check for negative patterns (penalties)
    const allSignals = Object.values(signals).join(' ');
    for (const negPattern of config.negativePatterns || []) {
      if (negPattern.test(allSignals)) {
        score += SIGNAL_WEIGHTS.negativePenalty;
        matches.push({ source: 'negative', pattern: negPattern.toString(), weight: SIGNAL_WEIGHTS.negativePenalty });
      }
    }

    // Check for required patterns (for fields like emailConfirm)
    if (config.requiresPatterns) {
      const hasRequired = config.requiresPatterns.some(p => p.test(allSignals));
      if (!hasRequired) {
        score = 0; // Must match required pattern
      }
    }

    // Context bonus
    if (config.contextClues && signals.context) {
      for (const clue of config.contextClues) {
        if (signals.context.includes(clue)) {
          score += SIGNAL_WEIGHTS.contextBonus;
          matches.push({ source: 'context', pattern: clue, weight: SIGNAL_WEIGHTS.contextBonus });
          break;
        }
      }
    }

    // Input type match bonus
    if (config.inputType && config.inputType.includes(signals.type)) {
      score += SIGNAL_WEIGHTS.typeMatch;
      matches.push({ source: 'type', pattern: signals.type, weight: SIGNAL_WEIGHTS.typeMatch });
    }

    // Apply field type weight
    score *= config.weight;

    // Calculate confidence (0-100)
    const maxPossibleScore = 120 * config.weight; // Rough max
    const confidence = Math.min(100, Math.round((score / maxPossibleScore) * 100));

    return { score, confidence, matches };
  }

  /**
   * Identify a field's type using multi-signal scoring
   */
  function identifyField(field) {
    const signals = extractSignals(field);
    const results = [];

    for (const [fieldType, config] of Object.entries(FIELD_TYPES)) {
      const { score, confidence, matches } = calculateScore(signals, fieldType);
      if (score > 0) {
        results.push({
          fieldType,
          score,
          confidence,
          matches,
          profilePath: config.profilePath
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return {
      signals,
      matches: results,
      bestMatch: results[0] || null
    };
  }

  /**
   * Get value from profile using dot notation path
   */
  function getProfileValue(profile, path) {
    if (!path || !profile) return null;

    const parts = path.split('.');
    let value = profile;

    for (const part of parts) {
      if (value === null || value === undefined) return null;

      // Handle array index like "workHistory.0.company"
      if (/^\d+$/.test(part)) {
        value = value[parseInt(part)];
      } else {
        value = value[part];
      }
    }

    return value || null;
  }

  /**
   * Main function: Match fields on a page to profile values
   * Returns array of { field, fieldType, confidence, value }
   */
  function matchFieldsToProfile(fields, profile, minConfidence = 30) {
    const results = [];

    for (const field of fields) {
      const identification = identifyField(field);

      if (identification.bestMatch && identification.bestMatch.confidence >= minConfidence) {
        const value = getProfileValue(profile, identification.bestMatch.profilePath);

        if (value) {
          results.push({
            field,
            fieldType: identification.bestMatch.fieldType,
            confidence: identification.bestMatch.confidence,
            score: identification.bestMatch.score,
            value,
            profilePath: identification.bestMatch.profilePath,
            signals: identification.signals,
            allMatches: identification.matches
          });
        }
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  // Expose the API
  window.JobTrackerSmartFieldMatcher = {
    identifyField,
    matchFieldsToProfile,
    extractSignals,
    FIELD_TYPES,
    SIGNAL_WEIGHTS,
    getProfileValue,

    // Get minimum confidence threshold from config
    getMinConfidence() {
      return window.JobTrackerConfig?.THRESHOLDS?.MIN_SMART_MATCHER || 30;
    }
  };

  // Register with namespace if available
  window.JobTrackerNamespace?.registerModule('smart-field-matcher');

  console.log('JobTracker: Smart Field Matcher loaded');
})();
