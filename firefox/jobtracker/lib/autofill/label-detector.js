/**
 * JobTracker Label Detector
 * Multi-strategy label and text extraction for form field identification
 */

const JobTrackerLabelDetector = {
  /**
   * Get cache manager reference
   */
  _getCacheManager() {
    return window.JobTrackerCacheManager;
  },

  /**
   * Get label text for an input using multiple strategies (7 total)
   * Uses caching to avoid repeated DOM queries
   * @param {HTMLElement} input - Input element to find label for
   * @returns {string} Label text or empty string
   */
  getLabelText(input) {
    const cacheManager = this._getCacheManager();

    // Check cache first
    if (cacheManager) {
      const cached = cacheManager.getLabelText(input);
      if (cached !== null) {
        return cached;
      }
    }

    // Extract label text using multiple strategies
    const labelText = this._extractLabelText(input);

    // Cache result
    if (cacheManager) {
      cacheManager.setLabelText(input, labelText);
    }

    return labelText;
  },

  /**
   * Internal method to extract label text (uncached)
   * @param {HTMLElement} input - Input element to find label for
   * @returns {string} Label text or empty string
   */
  _extractLabelText(input) {
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

    // Strategy 3: aria-labelledby (enhanced - supports multiple space-separated IDs)
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelIds = labelledBy.split(/\s+/);
      const labelTexts = labelIds.map(id => {
        const el = document.getElementById(id);
        return el ? el.textContent.trim() : '';
      }).filter(Boolean);
      if (labelTexts.length) return labelTexts.join(' ');
    }

    // Strategy 4: aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Strategy 5: Preceding sibling label
    const prevSibling = input.previousElementSibling;
    if (prevSibling?.tagName === 'LABEL') {
      return prevSibling.textContent.trim();
    }

    // Strategy 6: Label-like element in parent container (Bootstrap, Material, etc.)
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
   * Get all field identifiers combined for pattern matching
   * @param {HTMLElement} input - Input element
   * @param {boolean} sanitize - Whether to sanitize/normalize the text
   * @returns {string} Combined identifiers as lowercase string
   */
  getFieldIdentifiers(input, sanitize = false) {
    const identifiers = [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.getAttribute('data-field'),
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('autocomplete'),
      this.getLabelText(input)
    ].filter(Boolean).join(' ');

    return sanitize ? this.sanitizeText(identifiers) : identifiers.toLowerCase();
  },

  /**
   * Get parent element text content excluding child input elements
   * @param {HTMLElement} parent - Parent element
   * @param {HTMLElement} excludeElement - Element to exclude from text extraction
   * @returns {string} Text content from parent
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
   * Sanitize/normalize text for more flexible matching
   * Removes special characters and normalizes to lowercase
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    return text.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  },

  /**
   * Get direct attributes only (name, id, data-* attributes)
   * Used for high-certainty matching
   * @param {HTMLElement} input - Input element
   * @returns {string} Direct identifiers as lowercase string
   */
  getDirectIdentifiers(input) {
    return [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.getAttribute('data-field'),
      input.name,
      input.id
    ].filter(Boolean).join(' ').toLowerCase();
  },

  /**
   * Get autocomplete attribute value
   * @param {HTMLElement} input - Input element
   * @returns {string|null} Autocomplete value or null
   */
  getAutocomplete(input) {
    return input.getAttribute('autocomplete');
  },

  /**
   * Get placeholder text
   * @param {HTMLElement} input - Input element
   * @returns {string} Placeholder text in lowercase or empty string
   */
  getPlaceholder(input) {
    return input.placeholder?.toLowerCase() || '';
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerLabelDetector = JobTrackerLabelDetector;
}

// Register with namespace system
if (window.JobTrackerNamespace) {
  window.JobTrackerNamespace.registerModule('label-detector');
}
