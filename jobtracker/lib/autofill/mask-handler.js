/**
 * JobTracker Mask Handler
 * Detects and handles masked input fields (phone, SSN, ZIP, etc.)
 * Supports common masking libraries: IMask, Cleave.js, inputmask, jQuery Mask
 */

const JobTrackerMaskHandler = {
  /**
   * Mask type patterns
   */
  MASK_TYPES: {
    PHONE: 'phone',
    SSN: 'ssn',
    ZIP: 'zip',
    DATE: 'date',
    CREDIT_CARD: 'creditCard',
    CURRENCY: 'currency',
    CUSTOM: 'custom'
  },

  /**
   * Detect if an input has a mask applied
   * @param {HTMLInputElement} input - Input element
   * @returns {Object|null} Mask info or null if no mask detected
   */
  detectMask(input) {
    // Check for IMask
    if (input._imask || input.imask) {
      return {
        library: 'imask',
        instance: input._imask || input.imask,
        type: this._detectMaskType(input)
      };
    }

    // Check for Cleave.js
    if (input.cleave || input._cleave) {
      return {
        library: 'cleave',
        instance: input.cleave || input._cleave,
        type: this._detectMaskType(input)
      };
    }

    // Check for jQuery inputmask
    if (input.inputmask || (window.jQuery && window.jQuery(input).data('inputmask'))) {
      return {
        library: 'inputmask',
        instance: input.inputmask || window.jQuery?.(input).data('inputmask'),
        type: this._detectMaskType(input)
      };
    }

    // Check for data-mask attribute (common pattern)
    const dataMask = input.getAttribute('data-mask') ||
                     input.getAttribute('data-inputmask') ||
                     input.getAttribute('data-input-mask');
    if (dataMask) {
      return {
        library: 'data-attribute',
        mask: dataMask,
        type: this._detectMaskType(input, dataMask)
      };
    }

    // Check for mask in placeholder pattern
    const placeholder = input.placeholder || '';
    if (this._looksLikeMaskedPlaceholder(placeholder)) {
      return {
        library: 'pattern',
        mask: placeholder,
        type: this._detectMaskTypeFromPlaceholder(placeholder)
      };
    }

    // Check for pattern attribute
    const pattern = input.getAttribute('pattern');
    if (pattern && this._looksLikeMaskPattern(pattern)) {
      return {
        library: 'pattern-attribute',
        mask: pattern,
        type: this._detectMaskType(input)
      };
    }

    return null;
  },

  /**
   * Detect mask type from input attributes
   * @param {HTMLInputElement} input - Input element
   * @param {string} mask - Optional mask string
   * @returns {string} Mask type
   */
  _detectMaskType(input, mask = '') {
    const inputType = input.type?.toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${autocomplete} ${mask}`;

    // Phone detection
    if (inputType === 'tel' ||
        /phone|mobile|cell|tel/i.test(combined) ||
        /\(\d{3}\)|\d{3}[-.]?\d{3}[-.]?\d{4}/i.test(mask)) {
      return this.MASK_TYPES.PHONE;
    }

    // SSN detection
    if (/ssn|social.*security/i.test(combined) ||
        /\d{3}[-.]?\d{2}[-.]?\d{4}/i.test(mask)) {
      return this.MASK_TYPES.SSN;
    }

    // ZIP code detection
    if (/zip|postal/i.test(combined) ||
        /\d{5}(-\d{4})?/i.test(mask)) {
      return this.MASK_TYPES.ZIP;
    }

    // Date detection
    if (inputType === 'date' ||
        /date|birth|dob/i.test(combined) ||
        /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/i.test(mask)) {
      return this.MASK_TYPES.DATE;
    }

    // Credit card detection
    if (/credit.*card|card.*number|cc[-_]?num/i.test(combined) ||
        /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/i.test(mask)) {
      return this.MASK_TYPES.CREDIT_CARD;
    }

    // Currency detection
    if (/currency|price|amount|salary|ctc/i.test(combined) ||
        /^\$|,\d{3}/i.test(mask)) {
      return this.MASK_TYPES.CURRENCY;
    }

    return this.MASK_TYPES.CUSTOM;
  },

  /**
   * Detect mask type from placeholder pattern
   * @param {string} placeholder - Placeholder text
   * @returns {string} Mask type
   */
  _detectMaskTypeFromPlaceholder(placeholder) {
    if (/\(\d{3}\)\s?\d{3}[-.]?\d{4}|\d{3}[-.]?\d{3}[-.]?\d{4}/i.test(placeholder)) {
      return this.MASK_TYPES.PHONE;
    }
    if (/\d{3}[-.]?\d{2}[-.]?\d{4}/i.test(placeholder)) {
      return this.MASK_TYPES.SSN;
    }
    if (/\d{5}(-\d{4})?/i.test(placeholder)) {
      return this.MASK_TYPES.ZIP;
    }
    if (/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/i.test(placeholder)) {
      return this.MASK_TYPES.DATE;
    }
    return this.MASK_TYPES.CUSTOM;
  },

  /**
   * Check if placeholder looks like a mask pattern
   * @param {string} placeholder - Placeholder text
   * @returns {boolean}
   */
  _looksLikeMaskedPlaceholder(placeholder) {
    // Patterns like (___) ___-____ or ###-##-#### or __/__/____
    return /[_#X]{2,}|[(]\d*[)].*\d|^\d+[-./]\d+[-./]\d+$/i.test(placeholder);
  },

  /**
   * Check if pattern attribute looks like a mask
   * @param {string} pattern - Pattern string
   * @returns {boolean}
   */
  _looksLikeMaskPattern(pattern) {
    // Patterns for phone, SSN, dates, etc.
    return /\[0-9\]|\d+|\(\?:.*\)/.test(pattern);
  },

  /**
   * Format a raw value for a specific mask type
   * @param {string} rawValue - Raw unformatted value
   * @param {string} maskType - Type of mask
   * @returns {string} Formatted value
   */
  formatForMask(rawValue, maskType) {
    // Remove all non-digit characters for numeric masks
    const digits = rawValue.replace(/\D/g, '');

    switch (maskType) {
      case this.MASK_TYPES.PHONE:
        return this._formatPhone(digits);

      case this.MASK_TYPES.SSN:
        return this._formatSSN(digits);

      case this.MASK_TYPES.ZIP:
        return this._formatZip(digits);

      case this.MASK_TYPES.DATE:
        return this._formatDate(rawValue);

      case this.MASK_TYPES.CREDIT_CARD:
        return this._formatCreditCard(digits);

      case this.MASK_TYPES.CURRENCY:
        return this._formatCurrency(rawValue);

      default:
        return rawValue;
    }
  },

  /**
   * Format phone number
   * @param {string} digits - Digits only
   * @returns {string} Formatted phone
   */
  _formatPhone(digits) {
    if (digits.length === 10) {
      // US format: (555) 123-4567
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      // US with country code
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return digits;
  },

  /**
   * Format SSN
   * @param {string} digits - Digits only
   * @returns {string} Formatted SSN
   */
  _formatSSN(digits) {
    if (digits.length === 9) {
      // Format: 123-45-6789
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }
    return digits;
  },

  /**
   * Format ZIP code
   * @param {string} digits - Digits only
   * @returns {string} Formatted ZIP
   */
  _formatZip(digits) {
    if (digits.length === 9) {
      // ZIP+4 format: 12345-6789
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else if (digits.length === 5) {
      return digits;
    }
    return digits;
  },

  /**
   * Format date
   * @param {string} value - Date value
   * @returns {string} Formatted date
   */
  _formatDate(value) {
    // Try to parse and format as MM/DD/YYYY
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
      }
    } catch (e) {}
    return value;
  },

  /**
   * Format credit card number
   * @param {string} digits - Digits only
   * @returns {string} Formatted card number
   */
  _formatCreditCard(digits) {
    if (digits.length === 16) {
      // Format: 1234 5678 9012 3456
      return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    }
    return digits;
  },

  /**
   * Format currency
   * @param {string} value - Value
   * @returns {string} Formatted currency
   */
  _formatCurrency(value) {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (!isNaN(num)) {
      return num.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }
    return value;
  },

  /**
   * Fill a masked input with proper handling
   * @param {HTMLInputElement} input - Input element
   * @param {string} value - Value to fill
   * @returns {boolean} Whether fill was successful
   */
  fillMaskedInput(input, value) {
    const maskInfo = this.detectMask(input);

    if (!maskInfo) {
      // No mask detected, fill normally
      return false;
    }

    // Format value for the mask type
    const formattedValue = this.formatForMask(value, maskInfo.type);

    // Try using the mask library's API if available
    if (maskInfo.library === 'imask' && maskInfo.instance) {
      try {
        maskInfo.instance.unmaskedValue = value.replace(/\D/g, '');
        return true;
      } catch (e) {}
    }

    if (maskInfo.library === 'cleave' && maskInfo.instance) {
      try {
        maskInfo.instance.setRawValue(value.replace(/\D/g, ''));
        return true;
      } catch (e) {}
    }

    if (maskInfo.library === 'inputmask' && maskInfo.instance) {
      try {
        // jQuery inputmask
        if (window.jQuery) {
          window.jQuery(input).val(formattedValue);
          window.jQuery(input).trigger('input').trigger('change');
          return true;
        }
      } catch (e) {}
    }

    // Fallback: simulate character-by-character typing
    return this._simulateTyping(input, formattedValue);
  },

  /**
   * Simulate character-by-character typing for masked inputs
   * @param {HTMLInputElement} input - Input element
   * @param {string} value - Value to type
   * @returns {boolean} Whether typing was successful
   */
  _simulateTyping(input, value) {
    try {
      // Focus the input
      input.focus();

      // Clear existing value
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Type each character with events
      for (const char of value) {
        // Skip non-printable characters for non-numeric masks
        const charCode = char.charCodeAt(0);

        // Simulate keydown
        const keydownEvent = new KeyboardEvent('keydown', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          charCode: charCode,
          keyCode: charCode,
          which: charCode,
          bubbles: true
        });
        input.dispatchEvent(keydownEvent);

        // Simulate keypress
        const keypressEvent = new KeyboardEvent('keypress', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          charCode: charCode,
          keyCode: charCode,
          which: charCode,
          bubbles: true
        });
        input.dispatchEvent(keypressEvent);

        // Update value and dispatch input event
        // Use native setter to bypass React/Vue
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;

        if (nativeSetter) {
          nativeSetter.call(input, input.value + char);
        } else {
          input.value += char;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));

        // Simulate keyup
        const keyupEvent = new KeyboardEvent('keyup', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          charCode: charCode,
          keyCode: charCode,
          which: charCode,
          bubbles: true
        });
        input.dispatchEvent(keyupEvent);
      }

      // Final change event
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      return true;
    } catch (error) {
      console.log('JobTracker: Error simulating typing:', error);
      return false;
    }
  },

  /**
   * Check if a value needs formatting for a masked input
   * @param {HTMLInputElement} input - Input element
   * @param {string} value - Value to check
   * @returns {boolean}
   */
  needsFormatting(input, value) {
    const maskInfo = this.detectMask(input);
    if (!maskInfo) return false;

    // Check if value is already formatted
    const formatted = this.formatForMask(value, maskInfo.type);
    return formatted !== value;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerMaskHandler = JobTrackerMaskHandler;

  // Register with namespace if available
  if (window.JobTrackerNamespace) {
    window.JobTrackerNamespace.registerModule('mask-handler');
  }
}

console.log('JobTracker: Mask Handler loaded');
