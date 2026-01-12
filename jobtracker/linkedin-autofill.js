/**
 * JobTracker LinkedIn Autofill
 * Handles autofill for LinkedIn Easy Apply and job application forms
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerLinkedInAutofillInitialized) return;
  window.__jobTrackerLinkedInAutofillInitialized = true;

  // LinkedIn-specific selectors
  const SELECTORS = {
    easyApplyModal: '[data-test-modal-id="easy-apply-modal"]',
    easyApplyForm: '.jobs-easy-apply-form-section__grouping',
    formInput: '.artdeco-text-input--input',
    formSelect: '.fb-dash-form-element__select',
    formTextarea: '.artdeco-text-input--container textarea',
    phoneInput: '[name="phoneNumber"]',
    emailInput: '[name="email"]',
    cityInput: '[name="city"]',
    submitButton: '[aria-label="Submit application"]',
    nextButton: '[aria-label="Continue to next step"]',
    reviewButton: '[aria-label="Review your application"]'
  };

  // Field mappings for LinkedIn
  const FIELD_MAPPINGS = {
    'firstName': ['first', 'given'],
    'lastName': ['last', 'family', 'surname'],
    'email': ['email'],
    'phone': ['phone', 'mobile', 'cell'],
    'city': ['city', 'location'],
    'linkedIn': ['linkedin'],
    'website': ['website', 'portfolio', 'url']
  };

  // Listen for autofill trigger
  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;

    // Check if we're on LinkedIn
    if (!window.location.hostname.includes('linkedin.com')) return;

    // Mark as handled
    window.__jobTrackerAutofillHandled = true;

    await handleLinkedInAutofill(profile);
  });

  // Handle LinkedIn autofill
  async function handleLinkedInAutofill(profile) {
    try {
      // Check for Easy Apply modal
      const easyApplyModal = document.querySelector(SELECTORS.easyApplyModal);

      if (easyApplyModal) {
        await fillEasyApplyForm(easyApplyModal, profile);
      } else {
        // Regular job page - fill any visible forms
        await fillRegularForm(profile);
      }

      showNotification('LinkedIn form filled!', 'success');
    } catch (error) {
      console.error('JobTracker: LinkedIn autofill error:', error);
      showNotification('Error filling LinkedIn form', 'error');
    }
  }

  // Fill Easy Apply form
  async function fillEasyApplyForm(modal, profile) {
    const personal = profile.personal || {};
    let filledCount = 0;

    // Get all input fields in the modal
    const inputs = modal.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select');

    for (const input of inputs) {
      if (input.value && input.value.trim()) continue; // Skip if already filled

      const fieldName = getFieldName(input);
      const value = getValueForField(fieldName, profile);

      if (value) {
        fillField(input, value);
        filledCount++;
        await delay(50); // Small delay between fills
      }
    }

    // Handle phone number separately (LinkedIn has special phone input)
    const phoneInput = modal.querySelector('[name*="phone"], [id*="phone"]');
    if (phoneInput && !phoneInput.value && personal.phone) {
      fillField(phoneInput, personal.phone);
      filledCount++;
    }

    return filledCount;
  }

  // Fill regular form on job page
  async function fillRegularForm(profile) {
    const form = document.querySelector('form') || document.body;
    let filledCount = 0;

    const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), textarea, select');

    for (const input of inputs) {
      if (input.value && input.value.trim()) continue;
      if (!isVisible(input)) continue;

      const fieldName = getFieldName(input);
      const value = getValueForField(fieldName, profile);

      if (value) {
        fillField(input, value);
        filledCount++;
        await delay(50);
      }
    }

    return filledCount;
  }

  // Get field name from input attributes
  function getFieldName(input) {
    const attrs = [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      getLabelText(input)
    ].filter(Boolean).join(' ').toLowerCase();

    for (const [field, patterns] of Object.entries(FIELD_MAPPINGS)) {
      if (patterns.some(p => attrs.includes(p))) {
        return field;
      }
    }

    return attrs;
  }

  // Get label text
  function getLabelText(input) {
    // Check for label with for attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent;
    }

    // Check parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent;

    // Check preceding label
    const prev = input.previousElementSibling;
    if (prev?.tagName === 'LABEL') return prev.textContent;

    return '';
  }

  // Get value for field from profile
  function getValueForField(fieldName, profile) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};

    const mapping = {
      'firstName': personal.firstName,
      'lastName': personal.lastName,
      'email': personal.email,
      'phone': personal.phone,
      'city': personal.address?.city,
      'linkedIn': personal.linkedIn,
      'github': personal.github,
      'website': personal.portfolio || personal.website,
      'portfolio': personal.portfolio,
      'currentCompany': work.company,
      'currentTitle': work.title,
      'school': edu.school,
      'degree': edu.degree
    };

    // Check exact match
    for (const [key, value] of Object.entries(mapping)) {
      if (fieldName.includes(key.toLowerCase()) && value) {
        return value;
      }
    }

    return null;
  }

  // Fill a field with value
  function fillField(input, value) {
    if (!input || !value) return false;

    const tagName = input.tagName.toLowerCase();

    if (tagName === 'select') {
      return fillSelect(input, value);
    }

    // Use native setter for React compatibility
    const descriptor = Object.getOwnPropertyDescriptor(
      tagName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    );

    if (descriptor?.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    // Trigger events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  // Fill select dropdown
  function fillSelect(select, value) {
    const valueStr = String(value).toLowerCase();
    const options = Array.from(select.options);

    const match = options.find(opt =>
      opt.value.toLowerCase() === valueStr ||
      opt.textContent.toLowerCase().includes(valueStr)
    );

    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  // Check if element is visible
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  // Delay helper
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Show notification using content.js notification system
  function showNotification(message, type) {
    if (window.JobTrackerContent?.showNotification) {
      window.JobTrackerContent.showNotification(message, type);
    }
  }

  console.log('JobTracker: LinkedIn autofill module loaded');
})();
