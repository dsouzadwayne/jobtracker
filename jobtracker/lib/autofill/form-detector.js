/**
 * JobTracker Form Detector
 * Form detection utilities for finding job application forms
 */

const JobTrackerFormDetector = {
  /**
   * Get dependencies
   */
  _getDomUtils() {
    return window.JobTrackerDomUtils;
  },

  /**
   * Find form containing job application fields
   * Searches for forms with job-related attributes or fields
   * @returns {HTMLElement} Form element, container, or document.body as fallback
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
   * Uses attribute analysis and field content scoring
   * @param {HTMLFormElement} form - Form to check
   * @returns {boolean} Whether form appears to be a job application
   */
  isJobApplicationForm(form) {
    const formText = [
      form.id,
      form.className,
      form.getAttribute('name'),
      form.getAttribute('action'),
      form.getAttribute('data-automation-id')
    ].join(' ').toLowerCase();

    // Check form attributes for job-related keywords
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

    // Check for file upload (likely resume upload)
    if (form.querySelector('input[type="file"]')) {
      score += 2;
    }

    return score >= 2;
  },

  /**
   * Get all fillable inputs from a container
   * Excludes hidden, submit, button, and file inputs
   * @param {HTMLElement} container - Container element to search
   * @returns {HTMLElement[]} Array of fillable input elements
   */
  getFillableInputs(container) {
    const domUtils = this._getDomUtils();
    const inputs = new Set();
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), select, textarea';

    // First, check for inputs with data-automation-id (modern frameworks)
    container.querySelectorAll('[data-automation-id], [data-testid], [name]').forEach(el => {
      if (el.matches(selector) && !domUtils.isDisabledOrReadonly(el)) {
        inputs.add(el);
      }
    });

    // Then add remaining inputs
    container.querySelectorAll(selector).forEach(el => {
      if (!domUtils.isDisabledOrReadonly(el)) {
        inputs.add(el);
      }
    });

    return Array.from(inputs);
  },

  /**
   * Get all visible, fillable inputs from a container
   * @param {HTMLElement} container - Container element
   * @returns {HTMLElement[]} Array of visible, fillable inputs
   */
  getVisibleFillableInputs(container) {
    const domUtils = this._getDomUtils();
    return this.getFillableInputs(container).filter(input => domUtils.isVisible(input));
  },

  /**
   * Find empty inputs that need filling
   * @param {HTMLElement} container - Container to search
   * @returns {HTMLElement[]} Array of empty inputs
   */
  getEmptyInputs(container) {
    return this.getVisibleFillableInputs(container).filter(input => {
      if (input.type === 'checkbox' || input.type === 'radio') {
        return !input.checked;
      }
      return !input.value || !input.value.trim();
    });
  },

  /**
   * Count fillable fields in a container
   * @param {HTMLElement} container - Container to search
   * @returns {Object} Counts object { total, empty, filled }
   */
  countFields(container) {
    const all = this.getVisibleFillableInputs(container);
    let empty = 0;
    let filled = 0;

    for (const input of all) {
      if (input.type === 'checkbox' || input.type === 'radio') {
        if (input.checked) filled++;
        else empty++;
      } else if (input.value && input.value.trim()) {
        filled++;
      } else {
        empty++;
      }
    }

    return { total: all.length, empty, filled };
  },

  /**
   * Find form by common platform patterns
   * @param {string} platform - Platform identifier (e.g., 'workday', 'lever')
   * @returns {HTMLElement|null} Form element or null
   */
  findPlatformForm(platform) {
    const platformSelectors = {
      workday: '[data-automation-id="jobApplicationContainer"], [data-automation-id="mainContent"]',
      lever: '.application-form, .postings-form',
      greenhouse: '#application_form, .application-form',
      linkedin: '.jobs-easy-apply-content, .jobs-apply-form',
      indeed: '.ia-Apply, .icl-Apply',
      glassdoor: '.applyModal, .apply-modal',
      icims: '.iCIMS_MainWrapper',
      smartrecruiters: '.application-container',
      ashby: '[data-testid="application-form"]'
    };

    const selector = platformSelectors[platform.toLowerCase()];
    if (selector) {
      return document.querySelector(selector);
    }

    return null;
  },

  /**
   * Detect which job platform the current page is on
   * @returns {string|null} Platform name or null
   */
  detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();

    const platforms = {
      'myworkdayjobs.com': 'workday',
      'workday.com': 'workday',
      'lever.co': 'lever',
      'greenhouse.io': 'greenhouse',
      'linkedin.com': 'linkedin',
      'indeed.com': 'indeed',
      'glassdoor.com': 'glassdoor',
      'icims.com': 'icims',
      'smartrecruiters.com': 'smartrecruiters',
      'ashbyhq.com': 'ashby'
    };

    for (const [domain, platform] of Object.entries(platforms)) {
      if (hostname.includes(domain)) {
        return platform;
      }
    }

    return null;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerFormDetector = JobTrackerFormDetector;
}
