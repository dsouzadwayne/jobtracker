/**
 * JobTracker Event Dispatcher
 * Framework-aware event firing for React, Angular, Vue, and vanilla JS
 */

const JobTrackerEventDispatcher = {
  /**
   * Clear React's internal value tracker
   * React uses _valueTracker to track input changes for synthetic events
   * @param {HTMLElement} input - Input element
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
   * @param {HTMLElement} element - Element to dispatch events on
   * @param {*} value - Value being set (used for keyboard event simulation)
   */
  triggerAllEvents(element, value) {
    // Focus the element first
    try {
      element.focus();
    } catch (e) {}

    // Dispatch keyboard events (important for Angular/Vue)
    this.dispatchKeyboardEvents(element, value);

    // Dispatch standard input/change/blur events
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    const blurEvent = new Event('blur', { bubbles: true, cancelable: true });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
    element.dispatchEvent(blurEvent);

    // For React: Also try InputEvent with data property
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
   * Simulates typing the last character of the value
   * @param {HTMLElement} element - Element to dispatch events on
   * @param {*} value - Value to simulate typing
   */
  dispatchKeyboardEvents(element, value) {
    if (!value) return;

    const valueStr = String(value);
    const lastChar = valueStr.charAt(valueStr.length - 1);
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
   * Trigger events specifically for select elements
   * Includes space key press for some frameworks
   * @param {HTMLSelectElement} select - Select element
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
   * Trigger click and change events for checkboxes/radios
   * @param {HTMLInputElement} input - Checkbox or radio input
   */
  triggerCheckboxEvents(input) {
    // Clear React tracker first
    this.clearReactValueTracker(input);

    // Trigger click and change events
    input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  },

  /**
   * Detect if page is using React
   * @returns {boolean}
   */
  isReactPage() {
    return !!(
      document.querySelector('[data-reactroot]') ||
      document.querySelector('[data-react-checksum]') ||
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
      Object.keys(document.documentElement).some(key => key.startsWith('__react'))
    );
  },

  /**
   * Detect if page is using Angular
   * @returns {boolean}
   */
  isAngularPage() {
    return !!(
      window.ng ||
      window.getAllAngularRootElements ||
      document.querySelector('[ng-version]') ||
      document.querySelector('[ng-app]') ||
      document.querySelector('.ng-binding')
    );
  },

  /**
   * Detect if page is using Vue
   * @returns {boolean}
   */
  isVuePage() {
    return !!(
      window.__VUE__ ||
      window.Vue ||
      document.querySelector('[data-v-]') ||
      Array.from(document.querySelectorAll('*')).some(el =>
        el.__vue__ || el.__vueParentComponent
      )
    );
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerEventDispatcher = JobTrackerEventDispatcher;
}
