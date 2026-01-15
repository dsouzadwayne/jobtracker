/**
 * JobTracker Field Matcher
 * Matches form fields to profile data using multi-stage matching with certainty scoring
 */

const JobTrackerFieldMatcher = {
  // Certainty levels for multi-stage matching
  CERTAINTY: {
    EXACT_ATTRIBUTE: 1.0,      // Direct attribute match (data-automation-id, autocomplete)
    CUSTOM_RULE: 0.95,         // User-defined custom regex rule
    INPUT_TYPE: 0.9,           // Input type match (email, tel)
    DIRECT_PATTERN: 0.7,       // Pattern matches name/id directly
    LABEL_MATCH: 0.5,          // Pattern matches label text
    PARENT_LABEL: 0.3,         // Pattern matches parent container label
    PLACEHOLDER: 0.25,         // Pattern matches placeholder
    POSITION_FALLBACK: 0.15    // Position-based fallback
  },

  // Attribute priority for identification (modern frameworks first)
  ATTRIBUTE_PRIORITY: ['data-automation-id', 'data-testid', 'data-field', 'name', 'id', 'autocomplete'],

  // Expanded field patterns with international support
  patterns: {
    // Personal Info - First Name
    firstName: {
      patterns: [
        /first.?name/i, /given.?name/i, /fname/i, /f_name/i,
        /vorname/i, /prenom/i, /nombre/i, /nome/i,           // German, French, Spanish, Portuguese
        /first$/i, /^given$/i
      ],
      autocomplete: ['given-name'],
      profilePath: 'personal.firstName'
    },
    // Middle Name
    middleName: {
      patterns: [
        /middle.?name/i, /mname/i, /m_name/i, /middle.?initial/i,
        /zweiter.?vorname/i, /segundo.?nombre/i               // German, Spanish
      ],
      autocomplete: ['additional-name'],
      profilePath: 'personal.middleName'
    },
    // Last Name
    lastName: {
      patterns: [
        /last.?name/i, /family.?name/i, /surname/i, /lname/i, /l_name/i,
        /nachname/i, /nom.?de.?famille/i, /apellido/i, /sobrenome/i,  // German, French, Spanish, Portuguese
        /last$/i, /^family$/i
      ],
      autocomplete: ['family-name'],
      profilePath: 'personal.lastName'
    },
    // Full Name
    fullName: {
      patterns: [
        /full.?name/i, /^name$/i, /your.?name/i, /candidate.?name/i,
        /applicant.?name/i, /legal.?name/i, /complete.?name/i,
        /vollst.?ndiger.?name/i, /nom.?complet/i, /nombre.?completo/i  // German, French, Spanish
      ],
      autocomplete: ['name'],
      combineFields: ['personal.firstName', 'personal.middleName', 'personal.lastName']
    },
    // Email
    email: {
      patterns: [
        /e?.?mail/i, /email.?address/i, /e.?mail.?addr/i,
        /correo/i, /courriel/i,                               // Spanish, French
        /(?:^|[^k])mail(?!ing)/i                              // "mail" but not "mailing"
      ],
      autocomplete: ['email'],
      inputType: 'email',
      profilePath: 'personal.email'
    },
    // Phone
    phone: {
      patterns: [
        /phone/i, /mobile/i, /tel(?:ephone)?/i, /cell/i, /contact.?number/i,
        /telefon/i, /telefono/i, /numero/i,                   // German, Spanish
        /phon/i, /handynummer/i, /rufnummer/i                 // Variations
      ],
      autocomplete: ['tel', 'tel-national', 'tel-local'],
      inputType: 'tel',
      profilePath: 'personal.phone'
    },

    // Address
    street: {
      patterns: [
        /street/i, /address.?line/i, /^address$/i, /address.?1/i,
        /street.?address/i, /mailing.?address/i,
        /strasse/i, /stra.e/i, /direcci.n/i, /adresse/i       // German, Spanish, French
      ],
      autocomplete: ['street-address', 'address-line1'],
      profilePath: 'personal.address.street'
    },
    addressLine2: {
      patterns: [
        /address.?2/i, /address.?line.?2/i, /apt/i, /suite/i, /unit/i,
        /apartment/i, /building/i
      ],
      autocomplete: ['address-line2'],
      profilePath: 'personal.address.addressLine2'
    },
    city: {
      patterns: [
        /city/i, /town/i, /locality/i, /municipality/i,
        /stadt/i, /ville/i, /ciudad/i, /cidade/i              // German, French, Spanish, Portuguese
      ],
      autocomplete: ['address-level2'],
      profilePath: 'personal.address.city'
    },
    state: {
      patterns: [
        /state/i, /province/i, /region/i, /prefecture/i,
        /bundesland/i, /provincia/i, /estado/i                // German, Spanish
      ],
      autocomplete: ['address-level1'],
      profilePath: 'personal.address.state'
    },
    zipCode: {
      patterns: [
        /zip/i, /postal/i, /post.?code/i, /pin.?code/i,
        /postleitzahl/i, /plz/i, /codigo.?postal/i, /cep/i    // German, Spanish, Portuguese
      ],
      autocomplete: ['postal-code'],
      profilePath: 'personal.address.zipCode'
    },
    country: {
      patterns: [
        /country/i, /nation/i, /country.?code/i,
        /land/i, /pa.s/i, /pais/i                             // German, French, Spanish
      ],
      autocomplete: ['country-name', 'country'],
      profilePath: 'personal.address.country'
    },

    // Social/Professional Links
    linkedIn: {
      patterns: [
        /linkedin/i, /linked.?in/i, /linked_in/i,
        /linkedin.?url/i, /linkedin.?profile/i
      ],
      profilePath: 'personal.linkedIn'
    },
    github: {
      patterns: [/github/i, /git.?hub/i, /github.?url/i, /github.?profile/i],
      profilePath: 'personal.github'
    },
    portfolio: {
      patterns: [
        /portfolio/i, /website/i, /personal.?site/i, /personal.?url/i,
        /homepage/i, /^url$/i, /^web$/i, /personal.?website/i
      ],
      profilePath: 'personal.portfolio'
    },
    twitter: {
      patterns: [/twitter/i, /^x$/i, /x.?handle/i, /twitter.?handle/i],
      profilePath: 'personal.twitter'
    },

    // Work Experience
    currentCompany: {
      patterns: [
        /current.?company/i, /current.?employer/i, /employer/i,
        /company.?name/i, /organization/i, /firm/i,
        /most.?recent.?company/i, /present.?company/i,
        /arbeitgeber/i, /entreprise/i, /empresa/i             // German, French, Spanish
      ],
      profilePath: 'workHistory[0].company'
    },
    currentTitle: {
      patterns: [
        /current.?title/i, /job.?title/i, /current.?position/i,
        /position/i, /role/i, /designation/i,
        /most.?recent.?title/i, /present.?position/i,
        /jobtitel/i, /puesto/i, /poste/i                      // German, Spanish, French
      ],
      profilePath: 'workHistory[0].title'
    },
    workLocation: {
      patterns: [
        /work.?location/i, /job.?location/i, /employer.?location/i,
        /company.?location/i, /office.?location/i,
        /where.?do.?you.?work/i, /current.?location/i
      ],
      profilePath: 'workHistory[0].location'
    },
    workStartDate: {
      patterns: [
        /start.?date/i, /date.?started/i, /joined.?date/i,
        /employment.?start/i, /from.?date/i, /starting.?date/i,
        /when.?did.?you.?start/i, /hire.?date/i
      ],
      profilePath: 'workHistory[0].startDate'
    },
    workEndDate: {
      patterns: [
        /end.?date/i, /date.?ended/i, /left.?date/i,
        /employment.?end/i, /to.?date/i, /ending.?date/i,
        /when.?did.?you.?leave/i, /termination.?date/i
      ],
      profilePath: 'workHistory[0].endDate'
    },
    workDescription: {
      patterns: [
        /job.?description/i, /role.?description/i, /responsibilities/i,
        /duties/i, /job.?duties/i, /work.?description/i,
        /describe.?your.?role/i, /describe.?your.?work/i,
        /what.?did.?you.?do/i, /job.?summary/i
      ],
      profilePath: 'workHistory[0].description',
      textarea: true
    },
    previousCompany: {
      patterns: [
        /previous.?company/i, /previous.?employer/i, /past.?employer/i,
        /former.?company/i, /last.?company/i, /prior.?employer/i
      ],
      profilePath: 'workHistory[1].company'
    },
    previousTitle: {
      patterns: [
        /previous.?title/i, /previous.?position/i, /past.?position/i,
        /former.?title/i, /last.?position/i, /prior.?title/i
      ],
      profilePath: 'workHistory[1].title'
    },
    yearsExperience: {
      patterns: [
        /years?.?(?:of)?.?experience/i, /experience.?years/i,
        /total.?experience/i, /work.?experience/i,
        /berufserfahrung/i, /experiencia/i                    // German, Spanish
      ],
      profilePath: 'personal.yearsExperience'
    },

    // Education
    school: {
      patterns: [
        /school/i, /university/i, /college/i, /institution/i,
        /alma.?mater/i, /educational.?institution/i,
        /universit.t/i, /hochschule/i, /universidad/i         // German, Spanish
      ],
      profilePath: 'education[0].school'
    },
    degree: {
      patterns: [
        /degree/i, /qualification/i, /diploma/i,
        /abschluss/i, /diplom/i, /titulo/i, /grado/i          // German, Spanish
      ],
      profilePath: 'education[0].degree'
    },
    fieldOfStudy: {
      patterns: [
        /field.?of.?study/i, /major/i, /specialization/i,
        /concentration/i, /course/i, /program/i,
        /fachrichtung/i, /especialidad/i, /sp.cialit/i        // German, Spanish, French
      ],
      profilePath: 'education[0].field'
    },
    graduationYear: {
      patterns: [
        /graduation.?year/i, /grad.?year/i, /year.?graduated/i,
        /completion.?year/i, /year.?of.?graduation/i
      ],
      profilePath: 'education[0].graduationYear'
    },
    gpa: {
      patterns: [/gpa/i, /grade.?point/i, /cgpa/i, /grades/i],
      profilePath: 'education[0].gpa'
    },

    // Compensation
    currentCtc: {
      patterns: [
        /current.?ctc/i, /current.?salary/i, /present.?salary/i,
        /current.?compensation/i, /current.?package/i,
        /ctc.?\(?fixed\)?/i, /fixed.?ctc/i, /base.?salary/i,
        /existing.?salary/i, /current.?annual/i,
        /aktuelles.?gehalt/i, /salario.?actual/i              // German, Spanish
      ],
      profilePath: 'personal.currentCtc',
      format: 'ctc'
    },
    expectedCtc: {
      patterns: [
        /expected.?ctc/i, /expected.?salary/i, /desired.?salary/i,
        /expected.?compensation/i, /expected.?package/i,
        /salary.?expectation/i, /asking.?salary/i,
        /target.?salary/i, /preferred.?salary/i,
        /gehaltsvorstellung/i, /salario.?esperado/i           // German, Spanish
      ],
      profilePath: 'personal.expectedCtc',
      format: 'ctc'
    },
    noticePeriod: {
      patterns: [
        /notice.?period/i, /notice/i, /availability/i,
        /joining.?time/i, /start.?date/i, /available.?from/i,
        /k.ndigungsfrist/i, /periodo.?de.?aviso/i             // German, Spanish
      ],
      profilePath: 'personal.noticePeriod'
    },

    // Date of Birth
    birthDay: {
      patterns: [
        /(?:dd)|(?:bday)|(?:birth.?day)|(?:dob.?day)|(?:birth.?1)/i,
        /day.?of.?birth/i, /^day$/i
      ],
      profilePath: 'personal.birthDay'
    },
    birthMonth: {
      patterns: [
        /(?:mm)|(?:bmon)|(?:birth.?mon)|(?:dob.?mon)|(?:birth.?2)/i,
        /month.?of.?birth/i, /^month$/i
      ],
      profilePath: 'personal.birthMonth'
    },
    birthYear: {
      patterns: [
        /(?:yy)|(?:byear)|(?:birth.?year)|(?:dob.?year)|(?:birth.?3)/i,
        /year.?of.?birth/i
      ],
      profilePath: 'personal.birthYear'
    },
    dateOfBirth: {
      patterns: [
        /date.?of.?birth/i, /dob/i, /birth.?date/i, /birthday/i,
        /geburtsdatum/i, /fecha.?de.?nacimiento/i             // German, Spanish
      ],
      profilePath: 'personal.dateOfBirth'
    },

    // Additional fields
    gender: {
      patterns: [
        /gender/i, /sex/i, /geschlecht/i, /genero/i, /sexe/i  // German, Spanish, French
      ],
      profilePath: 'personal.gender'
    },
    nationality: {
      patterns: [
        /nationality/i, /citizenship/i, /citizen/i,
        /staatsangeh.rigkeit/i, /nacionalidad/i               // German, Spanish
      ],
      profilePath: 'personal.nationality'
    },
    veteranStatus: {
      patterns: [/veteran/i, /military/i, /armed.?forces/i, /service.?member/i],
      profilePath: 'personal.veteranStatus'
    },
    disability: {
      patterns: [/disability/i, /disabled/i, /handicap/i, /special.?needs/i],
      profilePath: 'personal.disability'
    },
    authorizedToWork: {
      patterns: [
        /authorized.?to.?work/i, /work.?authorization/i,
        /legally.?authorized/i, /right.?to.?work/i, /work.?permit/i,
        /visa.?status/i, /employment.?eligibility/i
      ],
      profilePath: 'personal.authorizedToWork'
    },
    requireSponsorship: {
      patterns: [
        /sponsor/i, /visa.?sponsor/i, /require.?sponsor/i,
        /need.?sponsor/i, /immigration.?sponsor/i
      ],
      profilePath: 'personal.requireSponsorship'
    },

    // Username (excluding password fields)
    username: {
      patterns: [
        /(?:username|login|user_id|membername)(?!.*pass)/i,
        /^user$/i, /^login$/i
      ],
      autocomplete: ['username'],
      profilePath: 'personal.username'
    },

    // Cover Letter
    coverLetter: {
      patterns: [
        /cover.?letter/i, /covering.?letter/i,
        /motivation.?letter/i, /letter.?of.?motivation/i,
        /intro.?letter/i, /introduction.?letter/i,
        /anschreiben/i, /lettre.?de.?motivation/i, /carta.?de.?presentacion/i  // German, French, Spanish
      ],
      profilePath: 'coverLetters.default',
      requiresSelection: true,  // Indicates this field needs user selection during autofill
      textarea: true
    }
  },

  /**
   * Multi-stage field matching with certainty scoring
   * Returns the best match with highest certainty
   * @param {HTMLElement} input - The input element to match
   * @param {Object} profile - User profile data
   * @param {Array} customRules - Optional custom regex rules from settings
   */
  matchField(input, profile, customRules = []) {
    const matches = [];

    // Stage 0: Check custom rules first (highest priority for user rules)
    const customMatch = this.matchByCustomRules(input, profile, customRules);
    if (customMatch) {
      matches.push(customMatch);
    }

    // Stage 1: Check data-automation-id and autocomplete (highest certainty)
    const exactMatch = this.matchByExactAttribute(input, profile);
    if (exactMatch) {
      matches.push(exactMatch);
    }

    // Stage 2: Check input type
    const typeMatch = this.matchByInputType(input, profile);
    if (typeMatch) {
      matches.push(typeMatch);
    }

    // Stage 3: Check direct attributes (name, id) with patterns
    const directMatch = this.matchByDirectAttributes(input, profile);
    if (directMatch) {
      matches.push(directMatch);
    }

    // Stage 4: Check label text
    const labelMatch = this.matchByLabelText(input, profile);
    if (labelMatch) {
      matches.push(labelMatch);
    }

    // Stage 5: Check parent element text
    const parentMatch = this.matchByParentText(input, profile);
    if (parentMatch) {
      matches.push(parentMatch);
    }

    // Stage 6: Check placeholder
    const placeholderMatch = this.matchByPlaceholder(input, profile);
    if (placeholderMatch) {
      matches.push(placeholderMatch);
    }

    // Return highest certainty match
    if (matches.length === 0) return null;

    matches.sort((a, b) => b.certainty - a.certainty);
    return matches[0];
  },

  /**
   * Stage 1: Match by exact attributes (data-automation-id, autocomplete)
   */
  matchByExactAttribute(input, profile) {
    const autocomplete = input.getAttribute('autocomplete');
    const automationId = input.getAttribute('data-automation-id');
    const testId = input.getAttribute('data-testid');

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      // Check autocomplete attribute
      if (autocomplete && config.autocomplete?.includes(autocomplete)) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.EXACT_ATTRIBUTE);
      }

      // Check data-automation-id
      if (automationId && config.patterns.some(p => p.test(automationId))) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.EXACT_ATTRIBUTE);
      }

      // Check data-testid
      if (testId && config.patterns.some(p => p.test(testId))) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.EXACT_ATTRIBUTE);
      }
    }

    return null;
  },

  /**
   * Stage 0: Match by user-defined custom regex rules
   * Custom rules have high priority to allow users to override default behavior
   */
  matchByCustomRules(input, profile, customRules) {
    if (!customRules || !Array.isArray(customRules) || customRules.length === 0) {
      return null;
    }

    const identifiers = this.getFieldIdentifiers(input);

    for (const rule of customRules) {
      // Skip disabled or invalid rules
      if (!rule.enabled || !rule.pattern || !rule.profilePath) continue;

      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(identifiers)) {
          const value = this.getValueFromProfile(rule.profilePath, profile);
          if (value) {
            return {
              fieldType: rule.name || 'customRule',
              value,
              certainty: this.CERTAINTY.CUSTOM_RULE,
              profilePath: rule.profilePath,
              isCustomRule: true
            };
          }
        }
      } catch (e) {
        // Invalid regex pattern, skip this rule
        console.log('JobTracker: Invalid custom rule regex:', rule.pattern, e);
      }
    }

    return null;
  },

  /**
   * Stage 2: Match by input type
   */
  matchByInputType(input, profile) {
    const inputType = input.type?.toLowerCase();
    if (!inputType) return null;

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      if (config.inputType === inputType) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.INPUT_TYPE);
      }
    }

    return null;
  },

  /**
   * Stage 3: Match by direct attributes (name, id)
   */
  matchByDirectAttributes(input, profile) {
    const directIdentifiers = [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.getAttribute('data-field'),
      input.name,
      input.id
    ].filter(Boolean).join(' ').toLowerCase();

    if (!directIdentifiers) return null;

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      if (config.patterns.some(p => p.test(directIdentifiers))) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.DIRECT_PATTERN);
      }
    }

    return null;
  },

  /**
   * Stage 4: Match by label text
   */
  matchByLabelText(input, profile) {
    const labelText = this.getLabelText(input).toLowerCase();
    if (!labelText) return null;

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      if (config.patterns.some(p => p.test(labelText))) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.LABEL_MATCH);
      }
    }

    return null;
  },

  /**
   * Stage 5: Match by parent element text
   */
  matchByParentText(input, profile) {
    const parent = input.parentElement;
    if (!parent) return null;

    // Get text from parent, excluding the input's own text
    const parentText = this.getParentTextContent(parent, input).toLowerCase();
    if (!parentText) return null;

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      if (config.patterns.some(p => p.test(parentText))) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.PARENT_LABEL);
      }
    }

    return null;
  },

  /**
   * Stage 6: Match by placeholder
   */
  matchByPlaceholder(input, profile) {
    const placeholder = input.placeholder?.toLowerCase();
    if (!placeholder) return null;

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      if (config.patterns.some(p => p.test(placeholder))) {
        return this.createMatch(fieldType, config, profile, this.CERTAINTY.PLACEHOLDER);
      }
    }

    return null;
  },

  /**
   * Get parent element text content excluding child input elements
   */
  getParentTextContent(parent, excludeElement) {
    let text = '';
    for (const node of parent.childNodes) {
      if (node === excludeElement) continue;
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (!['input', 'select', 'textarea', 'button'].includes(tagName)) {
          text += node.textContent;
        }
      }
    }
    return text.trim();
  },

  /**
   * Get all field identifiers for matching (legacy support)
   */
  getFieldIdentifiers(input) {
    return [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.getAttribute('data-field'),
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('autocomplete'),
      this.getLabelText(input)
    ].filter(Boolean).join(' ').toLowerCase();
  },

  /**
   * Get label text for an input using multiple strategies
   */
  getLabelText(input) {
    // Strategy 1: Label with for attribute (most reliable)
    if (input.id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label.textContent.trim();
      } catch (e) {
        // CSS.escape might fail on some IDs
      }
    }

    // Strategy 2: Parent label (input inside <label>)
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    // Strategy 3: aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }

    // Strategy 4: aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Strategy 5: Preceding sibling label
    const prevSibling = input.previousElementSibling;
    if (prevSibling?.tagName === 'LABEL') {
      return prevSibling.textContent.trim();
    }

    // Strategy 6: Label-like element in parent container (Bootstrap, etc.)
    const containers = [
      input.closest('.form-group'),
      input.closest('.field'),
      input.closest('.input-group'),
      input.closest('[class*="field"]'),
      input.closest('[class*="form-field"]'),
      input.closest('.application-question'),  // Lever
      input.closest('[data-automation-id]')    // Workday
    ].filter(Boolean);

    for (const container of containers) {
      const labelEl = container.querySelector('label, .label, .field-label, [class*="label"]:not(input)');
      if (labelEl && labelEl !== input) {
        return labelEl.textContent.trim();
      }
    }

    // Strategy 7: Text element directly before input in DOM
    let sibling = input.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) {
        return sibling.textContent.trim();
      }
      if (sibling.nodeType === Node.ELEMENT_NODE) {
        const tagName = sibling.tagName.toLowerCase();
        if (['span', 'div', 'p', 'label'].includes(tagName)) {
          return sibling.textContent.trim();
        }
        break;
      }
      sibling = sibling.previousSibling;
    }

    return '';
  },

  /**
   * Create a match result with value extraction
   */
  createMatch(fieldType, config, profile, certainty) {
    let value;

    if (config.combineFields) {
      value = config.combineFields
        .map(path => this.getValueFromProfile(path, profile))
        .filter(Boolean)
        .join(' ');
    } else {
      value = this.getValueFromProfile(config.profilePath, profile);
    }

    // Apply formatting if specified
    if (config.format === 'ctc' && value && window.JobTrackerFormat) {
      const currency = profile?.personal?.ctcCurrency;
      value = window.JobTrackerFormat.formatCtc(value, currency) || value;
    }

    return {
      fieldType,
      value,
      certainty,
      profilePath: config.profilePath
    };
  },

  /**
   * Get value from profile using path notation
   * Supports: "personal.firstName", "workHistory[0].company", etc.
   */
  getValueFromProfile(path, profile) {
    if (!path || !profile) return '';

    // Special handling for cover letter - get default cover letter
    if (path === 'coverLetters.default') {
      const coverLetters = profile.coverLetters || [];
      const defaultCL = coverLetters.find(cl => cl.isDefault) || coverLetters[0];
      return defaultCL?.content || '';
    }

    // Handle array notation like workHistory[0].company
    const arrayMatch = path.match(/^(\w+)\[(\d+)\]\.(.+)$/);
    if (arrayMatch) {
      const [, arrayName, index, subPath] = arrayMatch;
      const array = profile[arrayName];
      if (!Array.isArray(array) || !array[index]) return '';
      return this.getValueFromProfile(subPath, array[index]);
    }

    // Handle simple dot notation
    return path.split('.').reduce((obj, key) => obj?.[key], profile) || '';
  },

  /**
   * Match all fields in a form with certainty scoring
   * @param {HTMLFormElement} form - The form element to match fields in
   * @param {Object} profile - User profile data
   * @param {Array} customRules - Optional custom regex rules from settings
   */
  matchFormFields(form, profile, customRules = []) {
    const matches = [];
    const processedFields = new Set();
    const inputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    );

    inputs.forEach(input => {
      // Skip already filled or processed fields
      if (input.value && input.value.trim()) return;
      if (processedFields.has(input)) return;

      const match = this.matchField(input, profile, customRules);
      if (match && match.value) {
        matches.push({
          input,
          ...match
        });
        processedFields.add(input);
      }
    });

    // Sort by certainty (highest first)
    matches.sort((a, b) => b.certainty - a.certainty);

    return matches;
  },

  /**
   * Get unique identifier for an element (for position-based matching)
   */
  getUniqueId(element) {
    const form = element.closest('form');
    const root = form || document.body;

    // Try attributes in priority order
    for (const attr of this.ATTRIBUTE_PRIORITY) {
      const value = element.getAttribute(attr);
      if (value) {
        try {
          const match = root.querySelector(`[${attr}="${CSS.escape(value)}"]`);
          if (match === element) return value;
        } catch (e) {
          // CSS.escape might fail
        }
      }
    }

    // Fallback to placeholder
    if (element.placeholder) {
      return element.placeholder.replace(/\s/g, '_');
    }

    return element.name || element.id || null;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFieldMatcher = JobTrackerFieldMatcher;
}
