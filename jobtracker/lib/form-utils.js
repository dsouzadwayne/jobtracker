/**
 * JobTracker Form Utilities
 * Helper functions for form detection, filling, and interaction
 */

const JobTrackerFormUtils = {
  // Fill an input element with a value, triggering proper events
  fillInput(input, value) {
    if (!input || value === undefined || value === null) return false;

    const tagName = input.tagName.toLowerCase();
    const inputType = input.type?.toLowerCase();

    // Handle different input types
    if (tagName === 'select') {
      return this.fillSelect(input, value);
    } else if (tagName === 'textarea') {
      return this.fillTextInput(input, value);
    } else if (inputType === 'checkbox') {
      return this.fillCheckbox(input, value);
    } else if (inputType === 'radio') {
      return this.fillRadio(input, value);
    } else {
      return this.fillTextInput(input, value);
    }
  },

  // Fill text input or textarea
  fillTextInput(input, value) {
    try {
      // Use native setter to bypass React/Vue controlled components
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      const setter = input.tagName.toLowerCase() === 'textarea'
        ? nativeTextAreaValueSetter
        : nativeInputValueSetter;

      if (setter) {
        setter.call(input, value);
      } else {
        input.value = value;
      }

      // Trigger events
      this.triggerEvents(input, ['input', 'change', 'blur']);

      return true;
    } catch (error) {
      console.error('JobTracker: Error filling input:', error);
      return false;
    }
  },

  // Fill select element
  fillSelect(select, value) {
    try {
      const options = Array.from(select.options);
      const valueStr = String(value).toLowerCase();

      // Find matching option - prefer exact matches
      let matchedOption = options.find(opt =>
        opt.value.toLowerCase() === valueStr ||
        opt.textContent.toLowerCase().trim() === valueStr
      );

      if (!matchedOption) {
        // Try word-boundary match (value must be a complete word in the option text)
        const valueRegex = new RegExp(`\\b${valueStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        matchedOption = options.find(opt =>
          valueRegex.test(opt.textContent.toLowerCase()) ||
          valueRegex.test(opt.value.toLowerCase())
        );
      }

      if (matchedOption) {
        select.value = matchedOption.value;
        this.triggerEvents(select, ['change', 'input']);
        return true;
      }

      return false;
    } catch (error) {
      console.error('JobTracker: Error filling select:', error);
      return false;
    }
  },

  // Fill checkbox
  fillCheckbox(checkbox, value) {
    try {
      const shouldCheck = value === true ||
        value === 'true' ||
        value === '1' ||
        value === 'yes';

      if (checkbox.checked !== shouldCheck) {
        checkbox.checked = shouldCheck;
        this.triggerEvents(checkbox, ['change', 'click']);
      }
      return true;
    } catch (error) {
      console.error('JobTracker: Error filling checkbox:', error);
      return false;
    }
  },

  // Fill radio button
  fillRadio(radio, value) {
    try {
      const name = radio.name;
      if (!name) return false;

      const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      const valueStr = String(value).toLowerCase();

      for (const r of radios) {
        if (r.value.toLowerCase() === valueStr ||
            r.nextSibling?.textContent?.toLowerCase().includes(valueStr)) {
          r.checked = true;
          this.triggerEvents(r, ['change', 'click']);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('JobTracker: Error filling radio:', error);
      return false;
    }
  },

  // Trigger DOM events
  triggerEvents(element, eventNames) {
    eventNames.forEach(eventName => {
      let event;

      if (eventName === 'click') {
        event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
      } else {
        event = new Event(eventName, {
          bubbles: true,
          cancelable: true
        });
      }

      element.dispatchEvent(event);
    });
  },

  // Detect if element is visible
  isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  // Find form containing job application fields
  findJobApplicationForm() {
    const forms = document.querySelectorAll('form');

    for (const form of forms) {
      if (this.isJobApplicationForm(form)) {
        return form;
      }
    }

    // If no form found, check if there are standalone inputs
    const standaloneContainer = document.querySelector('[class*="application"], [class*="apply"], [id*="application"], [id*="apply"]');
    if (standaloneContainer) {
      return standaloneContainer;
    }

    return document.body;
  },

  // Check if form looks like a job application
  isJobApplicationForm(form) {
    const formText = [
      form.id,
      form.className,
      form.getAttribute('name'),
      form.getAttribute('action')
    ].join(' ').toLowerCase();

    // Check form attributes
    if (/apply|application|candidate|resume|job/i.test(formText)) {
      return true;
    }

    // Check for typical job application fields
    const inputs = form.querySelectorAll('input, select, textarea');
    let score = 0;

    const indicators = ['email', 'phone', 'name', 'resume', 'cv', 'linkedin', 'experience', 'education'];

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

  // Scroll element into view
  scrollIntoView(element) {
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  },

  // Focus element with highlight
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

  // Wait for element to appear
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

  // Delay helper
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Extract text content safely
  getTextContent(element) {
    if (!element) return '';
    return element.textContent?.trim() || element.innerText?.trim() || '';
  },

  // Find closest element matching selector
  findClosest(element, selector) {
    if (!element) return null;
    return element.closest(selector);
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFormUtils = JobTrackerFormUtils;
}
