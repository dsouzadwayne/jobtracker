/**
 * JobTracker Form Utilities
 * Helper functions for form detection, filling, and interaction
 * Includes framework-aware filling for React, Angular, and Vue
 */

const JobTrackerFormUtils = {
  /**
   * Fill an input element with a value, triggering proper events
   * Works with React, Angular, Vue, and vanilla JS forms
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
   */
  fillTextInput(input, value, type = 'input') {
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

      // Clear React's internal value tracker (for React 16+)
      this.clearReactValueTracker(input);

      // Trigger comprehensive events for all frameworks
      this.triggerAllEvents(input, value);

      return true;
    } catch (error) {
      console.log('JobTracker: Error filling input:', error);
      return false;
    }
  },

  /**
   * Clear React's internal value tracker
   * React uses _valueTracker to track input changes for synthetic events
   */
  clearReactValueTracker(input) {
    try {
      const tracker = input._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }
    } catch (e) {
      // Silently ignore if tracker doesn't exist
    }
  },

  /**
   * Trigger all necessary events for React, Angular, Vue, and vanilla JS
   */
  triggerAllEvents(element, value) {
    // Focus the element first
    try {
      element.focus();
    } catch (e) {}

    // Dispatch keyboard events (important for Angular/Vue)
    this.dispatchKeyboardEvents(element, value);

    // Dispatch input/change events
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    const blurEvent = new Event('blur', { bubbles: true, cancelable: true });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
    element.dispatchEvent(blurEvent);

    // For React: Also try InputEvent
    try {
      const reactInputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value
      });
      element.dispatchEvent(reactInputEvent);
    } catch (e) {
      // InputEvent might not be supported in older browsers
    }
  },

  /**
   * Dispatch keyboard events for frameworks that require them (Angular, Vue)
   */
  dispatchKeyboardEvents(element, value) {
    if (!value) return;

    const lastChar = value.charAt(value.length - 1);
    const keyCode = lastChar.charCodeAt(0);

    const keyboardEventInit = {
      key: lastChar,
      code: lastChar === ' ' ? 'Space' : `Key${lastChar.toUpperCase()}`,
      keyCode: keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      cancelable: true
    };

    try {
      element.dispatchEvent(new KeyboardEvent('keydown', keyboardEventInit));
      element.dispatchEvent(new KeyboardEvent('keypress', keyboardEventInit));
      element.dispatchEvent(new KeyboardEvent('keyup', keyboardEventInit));
    } catch (e) {
      // KeyboardEvent constructor might fail in some environments
    }
  },

  /**
   * Fill select element using selectedIndex (more reliable)
   */
  fillSelect(select, value) {
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
        const valueRegex = new RegExp(`\\b${this.escapeRegex(valueStr)}\\b`, 'i');
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

        // Trigger events
        this.triggerSelectEvents(select);
        return true;
      }

      return false;
    } catch (error) {
      console.log('JobTracker: Error filling select:', error);
      return false;
    }
  },

  /**
   * Trigger events specifically for select elements
   */
  triggerSelectEvents(select) {
    // Dispatch keyboard event (space key) for some frameworks
    try {
      const keyEvent = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        which: 32,
        bubbles: true
      });
      select.dispatchEvent(keyEvent);
    } catch (e) {}

    // Standard events
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('blur', { bubbles: true }));
  },

  /**
   * Fill checkbox
   */
  fillCheckbox(checkbox, value) {
    try {
      const shouldCheck = value === true ||
        value === 'true' ||
        value === '1' ||
        value === 'yes' ||
        value === 'Yes' ||
        value === 'YES';

      if (checkbox.checked !== shouldCheck) {
        checkbox.checked = shouldCheck;

        // Clear React tracker
        this.clearReactValueTracker(checkbox);

        // Trigger click and change events
        checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    } catch (error) {
      console.log('JobTracker: Error filling checkbox:', error);
      return false;
    }
  },

  /**
   * Fill radio button group
   */
  fillRadio(radio, value) {
    try {
      const name = radio.name;
      if (!name) return false;

      const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
      const valueStr = String(value).toLowerCase();

      for (const r of radios) {
        const radioValue = r.value.toLowerCase();
        const radioLabel = r.nextSibling?.textContent?.toLowerCase() || '';
        const parentLabel = r.closest('label')?.textContent?.toLowerCase() || '';

        if (radioValue === valueStr ||
            radioLabel.includes(valueStr) ||
            parentLabel.includes(valueStr)) {
          r.checked = true;

          // Clear React tracker
          this.clearReactValueTracker(r);

          // Trigger events
          r.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          r.dispatchEvent(new Event('change', { bubbles: true }));
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
   * Fill date input
   */
  fillDateInput(input, value) {
    try {
      // Convert to ISO date format if needed
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
   * Escape special regex characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Check if element is visible
   */
  isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Check if element is disabled or readonly
   */
  isDisabledOrReadonly(element) {
    return element.disabled || element.readOnly || element.getAttribute('aria-disabled') === 'true';
  },

  /**
   * Find form containing job application fields
   */
  findJobApplicationForm() {
    const forms = document.querySelectorAll('form');

    for (const form of forms) {
      if (this.isJobApplicationForm(form)) {
        return form;
      }
    }

    // If no form found, check for standalone application container
    const standaloneContainer = document.querySelector(
      '[class*="application"], [class*="apply"], [id*="application"], [id*="apply"], ' +
      '[class*="candidate"], [data-automation-id*="application"]'
    );
    if (standaloneContainer) {
      return standaloneContainer;
    }

    return document.body;
  },

  /**
   * Check if form looks like a job application
   */
  isJobApplicationForm(form) {
    const formText = [
      form.id,
      form.className,
      form.getAttribute('name'),
      form.getAttribute('action'),
      form.getAttribute('data-automation-id')
    ].join(' ').toLowerCase();

    // Check form attributes
    if (/apply|application|candidate|resume|job|career/i.test(formText)) {
      return true;
    }

    // Check for typical job application fields
    const inputs = form.querySelectorAll('input, select, textarea');
    let score = 0;

    const indicators = [
      'email', 'phone', 'name', 'resume', 'cv', 'linkedin',
      'experience', 'education', 'salary', 'ctc', 'cover'
    ];

    for (const input of inputs) {
      const inputText = [input.name, input.id, input.placeholder].join(' ').toLowerCase();
      if (indicators.some(ind => inputText.includes(ind))) {
        score++;
      }
    }

    // Check for file upload (resume)
    if (form.querySelector('input[type="file"]')) {
      score += 2;
    }

    return score >= 2;
  },

  /**
   * Get all fillable inputs from a container
   */
  getFillableInputs(container) {
    const inputs = new Set();
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea';

    // First, check for inputs with data-automation-id (modern frameworks)
    container.querySelectorAll('[data-automation-id], [data-testid], [name]').forEach(el => {
      if (el.matches(selector) && !this.isDisabledOrReadonly(el)) {
        inputs.add(el);
      }
    });

    // Then add remaining inputs
    container.querySelectorAll(selector).forEach(el => {
      if (!this.isDisabledOrReadonly(el)) {
        inputs.add(el);
      }
    });

    return Array.from(inputs);
  },

  /**
   * Scroll element into view
   */
  scrollIntoView(element) {
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  },

  /**
   * Focus element with highlight
   */
  focusWithHighlight(element) {
    if (!element) return;

    element.focus();

    // Add temporary highlight
    const originalOutline = element.style.outline;
    element.style.outline = '2px solid #3B82F6';

    setTimeout(() => {
      element.style.outline = originalOutline;
    }, 2000);
  },

  /**
   * Wait for element to appear
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      let timeoutId;
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);
    });
  },

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Extract text content safely
   */
  getTextContent(element) {
    if (!element) return '';
    return element.textContent?.trim() || element.innerText?.trim() || '';
  },

  /**
   * Find closest element matching selector
   */
  findClosest(element, selector) {
    if (!element) return null;
    return element.closest(selector);
  },

  /**
   * Fill multiple fields with delay between each
   */
  async fillFieldsWithDelay(matches, delayMs = 50) {
    let filledCount = 0;

    for (const match of matches) {
      if (!match.input || !match.value) continue;

      // Skip if already filled
      if (match.input.value && match.input.value.trim()) continue;

      // Skip if not visible
      if (!this.isVisible(match.input)) continue;

      if (this.fillInput(match.input, match.value)) {
        filledCount++;
        if (delayMs > 0) {
          await this.delay(delayMs);
        }
      }
    }

    return filledCount;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFormUtils = JobTrackerFormUtils;
}
