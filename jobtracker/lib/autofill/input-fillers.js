/**
 * JobTracker Input Fillers
 * Type-specific input filling with framework-aware event dispatching
 * Handles text, select, checkbox, radio, date, and terms checkbox inputs
 */

const JobTrackerInputFillers = {
  /**
   * Get dependencies
   */
  _getEventDispatcher() {
    return window.JobTrackerEventDispatcher;
  },

  _getDomUtils() {
    return window.JobTrackerDomUtils;
  },

  /**
   * Fill an input element with a value, triggering proper events
   * Works with React, Angular, Vue, and vanilla JS forms
   * @param {HTMLElement} input - Input element to fill
   * @param {*} value - Value to fill
   * @returns {boolean} Whether fill was successful
   */
  fillInput(input, value) {
    if (!input || value === undefined || value === null) return false;

    const tagName = input.tagName.toLowerCase();
    const inputType = input.type?.toLowerCase();

    // Handle different input types
    if (tagName === 'select') {
      return this.fillSelect(input, value);
    } else if (tagName === 'textarea') {
      return this.fillTextInput(input, value, 'textarea');
    } else if (inputType === 'checkbox') {
      return this.fillCheckbox(input, value);
    } else if (inputType === 'radio') {
      return this.fillRadio(input, value);
    } else if (inputType === 'date') {
      return this.fillDateInput(input, value);
    } else {
      return this.fillTextInput(input, value, 'input');
    }
  },

  /**
   * Fill text input or textarea with framework-aware approach
   * @param {HTMLElement} input - Input element
   * @param {*} value - Value to fill
   * @param {string} type - 'input' or 'textarea'
   * @returns {boolean} Whether fill was successful
   */
  fillTextInput(input, value, type = 'input') {
    const dispatcher = this._getEventDispatcher();

    try {
      // Get native setter to bypass React/Vue/Angular controlled components
      const prototype = type === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;

      const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }

      // Use dispatcher if available, otherwise fallback to basic events
      if (dispatcher) {
        // Clear React's internal value tracker (for React 16+)
        dispatcher.clearReactValueTracker(input);

        // Trigger comprehensive events for all frameworks
        dispatcher.triggerAllEvents(input, value);
      } else {
        // Fallback to basic event dispatch
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return true;
    } catch (error) {
      console.log('JobTracker: Error filling input:', error);
      return false;
    }
  },

  /**
   * Fill select element using multiple matching strategies
   * @param {HTMLSelectElement} select - Select element
   * @param {*} value - Value to match
   * @returns {boolean} Whether fill was successful
   */
  fillSelect(select, value) {
    const dispatcher = this._getEventDispatcher();
    const domUtils = this._getDomUtils();

    try {
      const options = Array.from(select.options);
      const valueStr = String(value).toLowerCase().trim();
      let matchedIndex = -1;

      // Strategy 1: Exact value match
      matchedIndex = options.findIndex(opt =>
        opt.value.toLowerCase() === valueStr
      );

      // Strategy 2: Exact text match
      if (matchedIndex === -1) {
        matchedIndex = options.findIndex(opt =>
          opt.textContent.toLowerCase().trim() === valueStr
        );
      }

      // Strategy 3: Word-boundary match in text
      if (matchedIndex === -1) {
        // Use escapeRegex from domUtils if available, otherwise escape manually
        const escapedValue = domUtils?.escapeRegex
          ? domUtils.escapeRegex(valueStr)
          : valueStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const valueRegex = new RegExp(`\\b${escapedValue}\\b`, 'i');
        matchedIndex = options.findIndex(opt =>
          valueRegex.test(opt.textContent.toLowerCase()) ||
          valueRegex.test(opt.value.toLowerCase())
        );
      }

      // Strategy 4: Partial match (value contains search or vice versa)
      if (matchedIndex === -1) {
        matchedIndex = options.findIndex(opt =>
          opt.value.toLowerCase().includes(valueStr) ||
          opt.textContent.toLowerCase().includes(valueStr) ||
          valueStr.includes(opt.value.toLowerCase()) ||
          valueStr.includes(opt.textContent.toLowerCase().trim())
        );
      }

      if (matchedIndex !== -1) {
        // Use selectedIndex for more reliable selection
        select.selectedIndex = matchedIndex;

        // Also set value as fallback
        select.value = options[matchedIndex].value;

        // Trigger events - use dispatcher if available, otherwise fallback
        if (dispatcher) {
          dispatcher.triggerSelectEvents(select);
        } else {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }

      return false;
    } catch (error) {
      console.log('JobTracker: Error filling select:', error);
      return false;
    }
  },

  /**
   * Fill checkbox
   * @param {HTMLInputElement} checkbox - Checkbox element
   * @param {*} value - Boolean or truthy value
   * @returns {boolean} Whether fill was successful
   */
  fillCheckbox(checkbox, value) {
    const dispatcher = this._getEventDispatcher();

    try {
      const shouldCheck = value === true ||
        value === 'true' ||
        value === '1' ||
        value === 'yes' ||
        value === 'Yes' ||
        value === 'YES';

      if (checkbox.checked !== shouldCheck) {
        checkbox.checked = shouldCheck;
        // Use dispatcher if available, otherwise fallback
        if (dispatcher) {
          dispatcher.triggerCheckboxEvents(checkbox);
        } else {
          checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return true;
    } catch (error) {
      console.log('JobTracker: Error filling checkbox:', error);
      return false;
    }
  },

  /**
   * Fill radio button group
   * @param {HTMLInputElement} radio - One radio button in the group
   * @param {*} value - Value to match
   * @returns {boolean} Whether fill was successful
   */
  fillRadio(radio, value) {
    const dispatcher = this._getEventDispatcher();
    const domUtils = this._getDomUtils();

    try {
      const name = radio.name;
      if (!name) return false;

      // Use escapeCSSSelector from domUtils if available, otherwise try CSS.escape with fallback
      let escapedName;
      if (domUtils?.escapeCSSSelector) {
        escapedName = domUtils.escapeCSSSelector(name);
      } else {
        try {
          escapedName = CSS.escape(name);
        } catch (e) {
          escapedName = name;
        }
      }

      const radios = document.querySelectorAll(`input[type="radio"][name="${escapedName}"]`);
      const valueStr = String(value).toLowerCase();

      for (const r of radios) {
        const radioValue = r.value.toLowerCase();
        const radioLabel = r.nextSibling?.textContent?.toLowerCase() || '';
        const parentLabel = r.closest('label')?.textContent?.toLowerCase() || '';

        if (radioValue === valueStr ||
            radioLabel.includes(valueStr) ||
            parentLabel.includes(valueStr)) {
          r.checked = true;
          // Use dispatcher if available, otherwise fallback
          if (dispatcher) {
            dispatcher.triggerCheckboxEvents(r);
          } else {
            r.dispatchEvent(new Event('click', { bubbles: true }));
            r.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return true;
        }
      }

      return false;
    } catch (error) {
      console.log('JobTracker: Error filling radio:', error);
      return false;
    }
  },

  /**
   * Fill date input with proper format conversion
   * @param {HTMLInputElement} input - Date input element
   * @param {*} value - Date value (Date object or string)
   * @returns {boolean} Whether fill was successful
   */
  fillDateInput(input, value) {
    try {
      // Convert to ISO date format if needed (YYYY-MM-DD)
      let dateValue = value;
      if (value instanceof Date) {
        dateValue = value.toISOString().split('T')[0];
      } else if (typeof value === 'string' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try to parse and convert to ISO format
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          dateValue = parsed.toISOString().split('T')[0];
        }
      }

      return this.fillTextInput(input, dateValue, 'input');
    } catch (error) {
      console.log('JobTracker: Error filling date input:', error);
      return false;
    }
  },

  /**
   * Fill terms/agreement checkbox (auto-check)
   * @param {HTMLInputElement} checkbox - Terms checkbox
   * @returns {boolean} Whether fill was successful
   */
  fillTermsCheckbox(checkbox) {
    const dispatcher = this._getEventDispatcher();

    try {
      if (!checkbox.checked) {
        checkbox.checked = true;
        // Use dispatcher if available, otherwise fallback
        if (dispatcher) {
          dispatcher.triggerCheckboxEvents(checkbox);
        } else {
          checkbox.dispatchEvent(new Event('click', { bubbles: true }));
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      return true;
    } catch (error) {
      console.log('JobTracker: Error filling terms checkbox:', error);
      return false;
    }
  },

  /**
   * Fill multiple fields with delay between each
   * @param {Array} matches - Array of match objects with input and value
   * @param {number} delayMs - Delay between fills in ms
   * @returns {Promise<number>} Number of fields filled
   */
  async fillFieldsWithDelay(matches, delayMs = 50) {
    const domUtils = this._getDomUtils();
    let filledCount = 0;

    for (const match of matches) {
      if (!match.input || !match.value) continue;

      // Skip if already filled
      if (match.input.value && match.input.value.trim()) continue;

      // Skip if not visible (use domUtils if available, otherwise assume visible)
      if (domUtils?.isVisible && !domUtils.isVisible(match.input)) continue;

      // Handle auto-check fields (terms checkboxes)
      if (match.autoCheck && match.input.type === 'checkbox') {
        if (this.fillTermsCheckbox(match.input)) {
          filledCount++;
        }
      } else if (this.fillInput(match.input, match.value)) {
        filledCount++;
      }

      if (delayMs > 0) {
        // Use domUtils.delay if available, otherwise use setTimeout
        if (domUtils?.delay) {
          await domUtils.delay(delayMs);
        } else {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    return filledCount;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerInputFillers = JobTrackerInputFillers;
}
