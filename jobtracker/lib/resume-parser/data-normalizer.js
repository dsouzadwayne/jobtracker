/**
 * Data Normalizer - Maps extracted resume data to profile schema
 * Converts raw extracted data to the format expected by the profile storage
 */

const ResumeDataNormalizer = {
  /**
   * Normalize extracted data to profile schema
   * @param {Object} extracted - Raw extracted data from field extractor
   * @returns {Object} - Normalized data matching profile schema
   */
  normalize(extracted) {
    return {
      personal: this.normalizePersonal(extracted.personal || {}),
      workHistory: this.normalizeWorkHistory(extracted.workHistory || []),
      education: this.normalizeEducation(extracted.education || []),
      skills: this.normalizeSkills(extracted.skills || {})
    };
  },

  /**
   * Normalize personal information
   * @param {Object} personal - Extracted personal info
   * @returns {Object} - Normalized personal info
   */
  normalizePersonal(personal) {
    const result = {
      firstName: this.cleanString(personal.firstName) || '',
      middleName: this.cleanString(personal.middleName) || '',
      lastName: this.cleanString(personal.lastName) || '',
      email: this.cleanString(personal.email) || '',
      phone: this.cleanString(personal.phone) || '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      linkedIn: this.cleanString(personal.linkedIn) || '',
      github: this.cleanString(personal.github) || '',
      portfolio: this.cleanString(personal.portfolio) || ''
    };

    // Normalize address if present
    if (personal.address) {
      result.address = {
        street: this.cleanString(personal.address.street) || '',
        city: this.cleanString(personal.address.city) || '',
        state: this.cleanString(personal.address.state) || '',
        zipCode: this.cleanString(personal.address.zipCode) || '',
        country: this.cleanString(personal.address.country) || ''
      };
    }

    return result;
  },

  /**
   * Normalize work history entries
   * @param {Array} workHistory - Extracted work history
   * @returns {Array} - Normalized work entries
   */
  normalizeWorkHistory(workHistory) {
    if (!Array.isArray(workHistory)) return [];

    return workHistory
      .filter(entry => entry && (entry.company || entry.title))
      .map(entry => ({
        id: this.generateId(),
        company: this.cleanString(entry.company) || '',
        title: this.cleanString(entry.title) || '',
        location: this.cleanString(entry.location) || '',
        startDate: this.normalizeDate(entry.startDate) || '',
        endDate: entry.current ? '' : (this.normalizeDate(entry.endDate) || ''),
        current: Boolean(entry.current),
        description: this.cleanString(entry.description) || ''
      }));
  },

  /**
   * Normalize education entries
   * @param {Array} education - Extracted education
   * @returns {Array} - Normalized education entries
   */
  normalizeEducation(education) {
    if (!Array.isArray(education)) return [];

    return education
      .filter(entry => entry && (entry.school || entry.degree))
      .map(entry => ({
        id: this.generateId(),
        school: this.cleanString(entry.school) || '',
        degree: this.cleanString(entry.degree) || '',
        field: this.cleanString(entry.field) || '',
        startDate: this.normalizeDate(entry.startDate) || '',
        endDate: this.normalizeDate(entry.endDate) || '',
        gpa: this.cleanString(entry.gpa) || '',
        location: this.cleanString(entry.location) || ''
      }));
  },

  /**
   * Normalize skills
   * @param {Object} skills - Extracted skills
   * @returns {Object} - Normalized skills by category
   */
  normalizeSkills(skills) {
    return {
      languages: this.normalizeSkillArray(skills.languages),
      frameworks: this.normalizeSkillArray(skills.frameworks),
      tools: this.normalizeSkillArray(skills.tools),
      soft: this.normalizeSkillArray(skills.soft)
    };
  },

  /**
   * Normalize a skill array
   * @param {Array} arr - Array of skills
   * @returns {Array} - Cleaned and deduplicated skills
   */
  normalizeSkillArray(arr) {
    if (!Array.isArray(arr)) return [];

    return [...new Set(
      arr
        .map(s => this.cleanString(s))
        .filter(s => s && s.length > 0)
    )];
  },

  /**
   * Clean a string value
   * @param {string} str - String to clean
   * @returns {string} - Cleaned string
   */
  cleanString(str) {
    if (!str) return '';
    return String(str)
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  },

  /**
   * Normalize date to YYYY-MM format
   * @param {string} date - Date string
   * @returns {string} - Normalized date
   */
  normalizeDate(date) {
    if (!date) return '';

    // If already in YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(date)) {
      return date;
    }

    // If just a year
    if (/^\d{4}$/.test(date)) {
      return `${date}-01`;
    }

    // Try to parse other formats
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

    return '';
  },

  /**
   * Generate a unique ID
   * @returns {string} - UUID
   */
  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback using crypto.getRandomValues for cryptographic randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    // Last resort fallback (should rarely be reached in modern browsers)
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  },

  /**
   * Compare extracted data with existing profile
   * @param {Object} extracted - Normalized extracted data
   * @param {Object} existing - Existing profile data
   * @returns {Object} - Comparison result with field-by-field status
   */
  compareWithExisting(extracted, existing) {
    const comparison = {
      personal: {},
      workHistory: { new: [], existing: [] },
      education: { new: [], existing: [] },
      skills: {}
    };

    // Compare personal fields
    const personalFields = [
      'firstName', 'middleName', 'lastName', 'email', 'phone',
      'linkedIn', 'github', 'portfolio'
    ];

    for (const field of personalFields) {
      const extractedValue = extracted.personal?.[field] || '';
      const existingValue = existing?.personal?.[field] || '';

      comparison.personal[field] = {
        extracted: extractedValue,
        existing: existingValue,
        status: this.getFieldStatus(extractedValue, existingValue),
        selected: extractedValue && !existingValue // Auto-select if extracted has value and existing is empty
      };
    }

    // Compare address fields
    const addressFields = ['street', 'city', 'state', 'zipCode', 'country'];
    for (const field of addressFields) {
      const extractedValue = extracted.personal?.address?.[field] || '';
      const existingValue = existing?.personal?.address?.[field] || '';

      comparison.personal[`address.${field}`] = {
        extracted: extractedValue,
        existing: existingValue,
        status: this.getFieldStatus(extractedValue, existingValue),
        selected: extractedValue && !existingValue
      };
    }

    // Compare work history
    comparison.workHistory = {
      extracted: extracted.workHistory || [],
      existing: existing?.workHistory || [],
      // New entries that don't seem to match existing
      toAdd: extracted.workHistory || []
    };

    // Compare education
    comparison.education = {
      extracted: extracted.education || [],
      existing: existing?.education || [],
      toAdd: extracted.education || []
    };

    // Compare skills
    const skillCategories = ['languages', 'frameworks', 'tools', 'soft'];
    for (const category of skillCategories) {
      const extractedSkills = extracted.skills?.[category] || [];
      const existingSkills = existing?.skills?.[category] || [];

      comparison.skills[category] = {
        extracted: extractedSkills,
        existing: existingSkills,
        new: extractedSkills.filter(s => !existingSkills.includes(s)),
        status: extractedSkills.length > 0 ? 'has_data' : 'empty'
      };
    }

    return comparison;
  },

  /**
   * Get field status based on values
   * @param {string} extracted - Extracted value
   * @param {string} existing - Existing value
   * @returns {string} - Status string
   */
  getFieldStatus(extracted, existing) {
    if (!extracted && !existing) return 'both_empty';
    if (extracted && !existing) return 'new_data';
    if (!extracted && existing) return 'keep_existing';
    if (extracted === existing) return 'same';
    return 'conflict';
  },

  /**
   * Merge selected fields into existing profile
   * @param {Object} existing - Existing profile
   * @param {Object} extracted - Extracted data
   * @param {Object} selections - User selections (which fields to import)
   * @returns {Object} - Merged profile
   */
  mergeProfiles(existing, extracted, selections) {
    const merged = JSON.parse(JSON.stringify(existing)); // Deep clone

    // Merge personal fields
    if (selections.personal) {
      for (const [field, selected] of Object.entries(selections.personal)) {
        if (selected) {
          if (field.startsWith('address.')) {
            const addressField = field.replace('address.', '');
            if (!merged.personal.address) {
              merged.personal.address = {};
            }
            merged.personal.address[addressField] = extracted.personal.address[addressField];
          } else {
            merged.personal[field] = extracted.personal[field];
          }
        }
      }
    }

    // Merge work history
    if (selections.workHistory && Array.isArray(selections.workHistory)) {
      for (const entry of selections.workHistory) {
        if (entry.selected) {
          // Add new entry with fresh ID
          merged.workHistory = merged.workHistory || [];
          merged.workHistory.push({
            ...entry,
            id: this.generateId()
          });
        }
      }
    }

    // Merge education
    if (selections.education && Array.isArray(selections.education)) {
      for (const entry of selections.education) {
        if (entry.selected) {
          merged.education = merged.education || [];
          merged.education.push({
            ...entry,
            id: this.generateId()
          });
        }
      }
    }

    // Merge skills
    if (selections.skills) {
      merged.skills = merged.skills || {};
      for (const [category, selected] of Object.entries(selections.skills)) {
        if (selected && Array.isArray(extracted.skills[category])) {
          merged.skills[category] = merged.skills[category] || [];
          // Add new skills that don't already exist
          for (const skill of extracted.skills[category]) {
            if (!merged.skills[category].includes(skill)) {
              merged.skills[category].push(skill);
            }
          }
        }
      }
    }

    // Update metadata
    merged.meta = merged.meta || {};
    merged.meta.updatedAt = new Date().toISOString();

    return merged;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeDataNormalizer = ResumeDataNormalizer;
}
