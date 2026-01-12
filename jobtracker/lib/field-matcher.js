/**
 * JobTracker Field Matcher
 * Matches form fields to profile data using patterns and heuristics
 */

const JobTrackerFieldMatcher = {
  // Field patterns for matching
  patterns: {
    // Personal Info
    firstName: {
      patterns: [/first.?name/i, /given.?name/i, /fname/i, /vorname/i, /prenom/i],
      autocomplete: ['given-name'],
      profilePath: 'personal.firstName'
    },
    lastName: {
      patterns: [/last.?name/i, /family.?name/i, /surname/i, /lname/i, /nachname/i, /nom/i],
      autocomplete: ['family-name'],
      profilePath: 'personal.lastName'
    },
    fullName: {
      patterns: [/full.?name/i, /^name$/i, /your.?name/i, /candidate.?name/i],
      autocomplete: ['name'],
      combineFields: ['personal.firstName', 'personal.lastName']
    },
    email: {
      patterns: [/e?.?mail/i, /email.?address/i],
      autocomplete: ['email'],
      inputType: 'email',
      profilePath: 'personal.email'
    },
    phone: {
      patterns: [/phone/i, /mobile/i, /tel/i, /cell/i, /contact.?number/i],
      autocomplete: ['tel'],
      inputType: 'tel',
      profilePath: 'personal.phone'
    },

    // Address
    street: {
      patterns: [/street/i, /address.?line/i, /^address$/i, /address.?1/i],
      autocomplete: ['street-address', 'address-line1'],
      profilePath: 'personal.address.street'
    },
    city: {
      patterns: [/city/i, /town/i, /locality/i],
      autocomplete: ['address-level2'],
      profilePath: 'personal.address.city'
    },
    state: {
      patterns: [/state/i, /province/i, /region/i],
      autocomplete: ['address-level1'],
      profilePath: 'personal.address.state'
    },
    zipCode: {
      patterns: [/zip/i, /postal/i, /post.?code/i],
      autocomplete: ['postal-code'],
      profilePath: 'personal.address.zipCode'
    },
    country: {
      patterns: [/country/i, /nation/i],
      autocomplete: ['country-name', 'country'],
      profilePath: 'personal.address.country'
    },

    // Social/Professional Links
    linkedIn: {
      patterns: [/linkedin/i, /linked.?in/i],
      profilePath: 'personal.linkedIn'
    },
    github: {
      patterns: [/github/i],
      profilePath: 'personal.github'
    },
    portfolio: {
      patterns: [/portfolio/i, /website/i, /personal.?site/i, /personal.?url/i],
      profilePath: 'personal.portfolio'
    },

    // Work Experience (for text areas)
    currentCompany: {
      patterns: [/current.?company/i, /current.?employer/i, /employer/i],
      profilePath: 'workHistory[0].company'
    },
    currentTitle: {
      patterns: [/current.?title/i, /job.?title/i, /current.?position/i],
      profilePath: 'workHistory[0].title'
    },

    // Education
    school: {
      patterns: [/school/i, /university/i, /college/i, /institution/i],
      profilePath: 'education[0].school'
    },
    degree: {
      patterns: [/degree/i, /qualification/i],
      profilePath: 'education[0].degree'
    },
    fieldOfStudy: {
      patterns: [/field.?of.?study/i, /major/i, /specialization/i],
      profilePath: 'education[0].field'
    }
  },

  // Match a field to profile data
  matchField(input, profile) {
    const identifiers = this.getFieldIdentifiers(input);
    const autocomplete = input.autocomplete;
    const inputType = input.type;

    for (const [fieldType, config] of Object.entries(this.patterns)) {
      // Check autocomplete first (most reliable)
      if (autocomplete && config.autocomplete?.includes(autocomplete)) {
        return this.createMatch(fieldType, config, profile, 'high');
      }

      // Check input type
      if (inputType && config.inputType === inputType) {
        return this.createMatch(fieldType, config, profile, 'high');
      }

      // Check patterns against identifiers
      if (config.patterns.some(p => p.test(identifiers))) {
        return this.createMatch(fieldType, config, profile, 'medium');
      }
    }

    return null;
  },

  // Get field identifiers for matching
  getFieldIdentifiers(input) {
    return [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      this.getLabelText(input),
      input.getAttribute('data-field'),
      input.getAttribute('data-qa')
    ].filter(Boolean).join(' ').toLowerCase();
  },

  // Get label text for an input
  getLabelText(input) {
    // Check for associated label via for attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent;
    }

    // Check for parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent;

    // Check for aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent;
    }

    // Check for preceding label sibling
    const prevSibling = input.previousElementSibling;
    if (prevSibling?.tagName === 'LABEL') {
      return prevSibling.textContent;
    }

    // Check parent for label-like elements
    const parent = input.parentElement;
    if (parent) {
      const labelLike = parent.querySelector('.label, .field-label, [class*="label"]');
      if (labelLike) return labelLike.textContent;
    }

    return '';
  },

  // Create a match result
  createMatch(fieldType, config, profile, confidence) {
    let value;

    if (config.combineFields) {
      value = config.combineFields
        .map(path => this.getValueFromProfile(path, profile))
        .filter(Boolean)
        .join(' ');
    } else {
      value = this.getValueFromProfile(config.profilePath, profile);
    }

    return {
      fieldType,
      value,
      confidence,
      profilePath: config.profilePath
    };
  },

  // Get value from profile using path like "personal.firstName" or "workHistory[0].company"
  getValueFromProfile(path, profile) {
    if (!path || !profile) return '';

    // Handle array notation like workHistory[0].company
    const arrayMatch = path.match(/^(\w+)\[(\d+)\]\.(.+)$/);
    if (arrayMatch) {
      const [, arrayName, index, subPath] = arrayMatch;
      const array = profile[arrayName];
      if (!Array.isArray(array)) {
        console.warn(`JobTracker: Profile path "${arrayName}" is not an array`);
        return '';
      }
      if (!array[index]) {
        console.warn(`JobTracker: Profile array "${arrayName}" has no item at index ${index}`);
        return '';
      }
      return this.getValueFromProfile(subPath, array[index]);
    }

    // Handle simple dot notation
    return path.split('.').reduce((obj, key) => obj?.[key], profile) || '';
  },

  // Match all fields in a form
  matchFormFields(form, profile) {
    const matches = [];
    const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');

    inputs.forEach(input => {
      if (input.value && input.value.trim()) return; // Skip already filled

      const match = this.matchField(input, profile);
      if (match && match.value) {
        matches.push({
          input,
          ...match
        });
      }
    });

    return matches;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFieldMatcher = JobTrackerFieldMatcher;
}
