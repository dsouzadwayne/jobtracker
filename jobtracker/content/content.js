/**
 * JobTracker Content Script
 * Main entry point loaded on all pages
 * Handles message passing and coordinates platform-specific scripts
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerInitialized) return;
  window.__jobTrackerInitialized = true;

  // Message types
  const MessageTypes = {
    TRIGGER_AUTOFILL: 'TRIGGER_AUTOFILL',
    GET_PROFILE_FOR_FILL: 'GET_PROFILE_FOR_FILL',
    SUBMISSION_DETECTED: 'SUBMISSION_DETECTED',
    GET_SETTINGS: 'GET_SETTINGS'
  };

  // State
  let settings = null;
  let profile = null;

  // Initialize
  async function init() {
    try {
      // Load settings
      settings = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });

      // Listen for messages from background/popup
      chrome.runtime.onMessage.addListener(handleMessage);

      console.log('JobTracker: Content script initialized');
    } catch (error) {
      console.log('JobTracker: Error initializing content script:', error);
    }
  }

  // Handle messages
  function handleMessage(message, sender, sendResponse) {
    const { type, payload } = message;

    switch (type) {
      case MessageTypes.TRIGGER_AUTOFILL:
        handleAutofill();
        sendResponse({ success: true });
        break;

      default:
        // Let other scripts handle
        break;
    }

    return true;
  }

  // Handle autofill trigger
  async function handleAutofill() {
    try {
      // Get profile data and settings in parallel
      const [profileData, settingsData] = await Promise.all([
        chrome.runtime.sendMessage({ type: MessageTypes.GET_PROFILE_FOR_FILL }),
        chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS })
      ]);

      profile = profileData;
      settings = settingsData;

      if (!profile || !profile.personal?.email) {
        showNotification('Please complete your profile before using autofill', 'warning');
        return;
      }

      // Get custom rules and delay from settings
      const customRules = settings?.customFieldRules || [];
      const delay = settings?.autofill?.delay || 0;

      // Apply delay if configured (helps with dynamic forms)
      if (delay > 0) {
        showNotification(`Waiting ${delay / 1000}s before autofill...`, 'info');
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Reset handled flag
      window.__jobTrackerAutofillHandled = false;

      // Listen for platform handler completion
      const autofillCompleteHandler = () => {
        window.__jobTrackerAutofillHandled = true;
      };
      window.addEventListener('jobtracker:autofill-complete', autofillCompleteHandler, { once: true });

      // Dispatch event for platform-specific handlers to listen
      // Include both profile and customRules for advanced matching
      window.dispatchEvent(new CustomEvent('jobtracker:autofill', {
        detail: { profile, customRules }
      }));

      // If no platform handler picks it up within 500ms, use generic autofill
      setTimeout(() => {
        window.removeEventListener('jobtracker:autofill-complete', autofillCompleteHandler);
        if (!window.__jobTrackerAutofillHandled) {
          genericAutofill(profile);
        }
      }, 500);

    } catch (error) {
      console.log('JobTracker: Error during autofill:', error);
      showNotification('Error during autofill. Please try again.', 'error');
    }
  }

  // Generic autofill for any form
  function genericAutofill(profile) {
    const filledCount = fillFormFields(profile);

    if (filledCount > 0) {
      showNotification(`Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}`, 'success');
    } else {
      showNotification('No fillable fields found on this page', 'info');
    }
  }

  // Fill form fields based on profile
  function fillFormFields(profile) {
    let filledCount = 0;
    const personal = profile.personal || {};

    // Field mapping: [selector patterns, profile value, field name]
    const fieldMappings = [
      // Name fields
      { patterns: ['first_name', 'firstname', 'first-name', 'fname', 'given_name', 'givenname'], value: personal.firstName },
      { patterns: ['last_name', 'lastname', 'last-name', 'lname', 'family_name', 'familyname', 'surname'], value: personal.lastName },
      { patterns: ['full_name', 'fullname', 'full-name', 'name'], value: `${personal.firstName} ${personal.lastName}`.trim() },

      // Contact
      { patterns: ['email', 'e-mail', 'emailaddress', 'email_address'], value: personal.email, type: 'email' },
      { patterns: ['phone', 'telephone', 'mobile', 'cell', 'phonenumber', 'phone_number'], value: personal.phone, type: 'tel' },

      // Address
      { patterns: ['street', 'address', 'address1', 'street_address', 'streetaddress'], value: personal.address?.street },
      { patterns: ['city', 'town'], value: personal.address?.city },
      { patterns: ['state', 'province', 'region'], value: personal.address?.state },
      { patterns: ['zip', 'postal', 'zipcode', 'zip_code', 'postalcode', 'postal_code'], value: personal.address?.zipCode },
      { patterns: ['country', 'nation'], value: personal.address?.country },

      // Links
      { patterns: ['linkedin', 'linked_in'], value: personal.linkedIn },
      { patterns: ['github'], value: personal.github },
      { patterns: ['portfolio', 'website', 'personal_site', 'personalsite'], value: personal.portfolio || personal.website }
    ];

    // Find and fill each field
    fieldMappings.forEach(mapping => {
      if (!mapping.value) return;

      const input = findInputByPatterns(mapping.patterns, mapping.type);
      if (input && !input.value) {
        fillInput(input, mapping.value);
        filledCount++;
      }
    });

    return filledCount;
  }

  // Find input by name/id patterns
  function findInputByPatterns(patterns, inputType) {
    for (const pattern of patterns) {
      // By name attribute
      let input = document.querySelector(`input[name*="${pattern}" i]:not([type="hidden"])`);
      if (input) return input;

      // By id attribute
      input = document.querySelector(`input[id*="${pattern}" i]:not([type="hidden"])`);
      if (input) return input;

      // By placeholder
      input = document.querySelector(`input[placeholder*="${pattern}" i]:not([type="hidden"])`);
      if (input) return input;

      // By autocomplete
      if (inputType) {
        input = document.querySelector(`input[type="${inputType}"]:not([type="hidden"])`);
        if (input) return input;
      }

      // By label text
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes(pattern)) {
          const forId = label.getAttribute('for');
          if (forId) {
            input = document.getElementById(forId);
            if (input) return input;
          }
          // Check for nested input
          input = label.querySelector('input:not([type="hidden"])');
          if (input) return input;
        }
      }
    }
    return null;
  }

  // Fill input and trigger events
  function fillInput(input, value) {
    if (!input || !value) return false;

    // Set value
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, value);

    // Trigger events for React/Vue/Angular
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  // Show notification
  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('jobtracker-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'jobtracker-notification';
    notification.className = `jobtracker-notification jobtracker-notification-${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'jobtracker-notification-icon';
    iconSpan.innerHTML = getNotificationIcon(type);

    const messageSpan = document.createElement('span');
    messageSpan.className = 'jobtracker-notification-message';
    messageSpan.textContent = message;

    notification.appendChild(iconSpan);
    notification.appendChild(messageSpan);

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.classList.add('jobtracker-notification-hide');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'success': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      case 'error': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      case 'warning': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      default: return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
  }

  // Export for other scripts
  window.JobTrackerContent = {
    fillInput,
    findInputByPatterns,
    showNotification,
    getProfile: () => profile,
    getSettings: () => settings
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
