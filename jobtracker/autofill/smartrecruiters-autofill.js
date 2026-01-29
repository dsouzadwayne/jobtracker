/**
 * JobTracker SmartRecruiters Autofill
 * Uses Smart Field Matcher for intelligent field detection
 * Handles SmartRecruiters' custom web components (spl-input, spl-textarea, etc.)
 */

(function() {
  'use strict';

  if (window.__jobTrackerSmartrecruitersAutofillInitialized) return;
  window.__jobTrackerSmartrecruitersAutofillInitialized = true;

  function isSmartRecruitersDomain() {
    const hostname = window.location.hostname;
    return hostname === 'smartrecruiters.com' || hostname.endsWith('.smartrecruiters.com');
  }

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile || !isSmartRecruitersDomain()) return;

    window.__jobTrackerAutofillHandled = true;
    await handleSmartRecruitersAutofill(profile);
  });

  /**
   * Country code mapping for stripping from phone numbers
   */
  const COUNTRY_CODES = {
    'IN': '+91', 'US': '+1', 'GB': '+44', 'UK': '+44', 'CA': '+1',
    'AU': '+61', 'DE': '+49', 'FR': '+33', 'IT': '+39', 'ES': '+34',
    'NL': '+31', 'BE': '+32', 'CH': '+41', 'AT': '+43', 'SE': '+46',
    'NO': '+47', 'DK': '+45', 'FI': '+358', 'IE': '+353', 'PT': '+351',
    'PL': '+48', 'CZ': '+420', 'HU': '+36', 'RO': '+40', 'BG': '+359',
    'GR': '+30', 'TR': '+90', 'RU': '+7', 'UA': '+380', 'IL': '+972',
    'AE': '+971', 'SA': '+966', 'EG': '+20', 'ZA': '+27', 'NG': '+234',
    'KE': '+254', 'JP': '+81', 'CN': '+86', 'KR': '+82', 'SG': '+65',
    'MY': '+60', 'TH': '+66', 'ID': '+62', 'PH': '+63', 'VN': '+84',
    'NZ': '+64', 'BR': '+55', 'MX': '+52', 'AR': '+54', 'CL': '+56',
    'CO': '+57', 'PE': '+51', 'PK': '+92', 'BD': '+880', 'LK': '+94'
  };

  /**
   * Strip country code from phone number
   */
  function stripCountryCode(phoneNumber, countryCode) {
    if (!phoneNumber) return '';

    let phone = phoneNumber.trim();

    // If we know the country, strip that specific code
    if (countryCode && COUNTRY_CODES[countryCode]) {
      const code = COUNTRY_CODES[countryCode];
      if (phone.startsWith(code)) {
        phone = phone.substring(code.length).trim();
      } else if (phone.startsWith('00' + code.substring(1))) {
        phone = phone.substring(code.length + 1).trim();
      }
    }

    // Generic strip: remove leading + and up to 3 digits
    phone = phone.replace(/^\+\d{1,3}[\s-]?/, '');
    phone = phone.replace(/^00\d{1,3}[\s-]?/, '');

    // Remove leading zero if number is too long
    if (phone.startsWith('0') && phone.length > 10) {
      phone = phone.substring(1);
    }

    // Clean up spaces/dashes
    phone = phone.replace(/[\s-]/g, '');

    return phone;
  }

  /**
   * Fill a custom spl-input or spl-textarea component
   */
  function fillSplInput(component, value) {
    if (!value) return false;

    try {
      // Method 1: Set value attribute
      component.setAttribute('value', value);

      // Method 2: Shadow DOM
      const shadowRoot = component.shadowRoot;
      if (shadowRoot) {
        const input = shadowRoot.querySelector('input, textarea');
        if (input) {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }
      }

      // Method 3: Custom event
      component.dispatchEvent(new CustomEvent('input', {
        bubbles: true,
        composed: true,
        detail: { value }
      }));

      // Method 4: Value property
      if ('value' in component) {
        component.value = value;
      }

      return true;
    } catch (e) {
      console.log('JobTracker: Failed to fill spl component', e);
      return false;
    }
  }

  /**
   * Fill a phone field component
   */
  function fillPhoneField(component, value) {
    if (!value) return false;

    try {
      // Get current country from component
      let currentCountry = null;
      try {
        const currentValue = JSON.parse(component.getAttribute('value') || '{}');
        currentCountry = currentValue.country;
        console.log('JobTracker: Phone field country:', currentCountry);
      } catch (e) {}

      // Strip country code
      const localNumber = stripCountryCode(value, currentCountry);
      console.log('JobTracker: Phone:', value, '->', localNumber);

      let filled = false;

      // Method 1: Try shadow DOM
      const shadowRoot = component.shadowRoot;
      if (shadowRoot) {
        // Try multiple input selectors
        const selectors = [
          'input[type="tel"]',
          'input.phone-input',
          'input[inputmode="tel"]',
          'input:not([type="hidden"])'
        ];

        for (const selector of selectors) {
          const input = shadowRoot.querySelector(selector);
          if (input && !input.value) {
            input.focus();
            input.value = localNumber;
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            console.log('JobTracker: Filled phone via shadow DOM selector:', selector);
            filled = true;
            break;
          }
        }
      }

      // Method 2: Try to find input inside the component (non-shadow)
      if (!filled) {
        const input = component.querySelector('input[type="tel"], input:not([type="hidden"])');
        if (input) {
          input.focus();
          input.value = localNumber;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('JobTracker: Filled phone via direct querySelector');
          filled = true;
        }
      }

      // Method 3: Set value attribute with proper structure
      if (!filled) {
        const newValue = JSON.stringify({
          country: currentCountry || 'IN',
          phoneNumber: localNumber
        });
        component.setAttribute('value', newValue);

        // Also dispatch a custom event that Angular might listen to
        component.dispatchEvent(new CustomEvent('valueChange', {
          bubbles: true,
          composed: true,
          detail: { country: currentCountry || 'IN', phoneNumber: localNumber }
        }));

        console.log('JobTracker: Set phone via attribute');
        filled = true;
      }

      // Method 4: Try typing simulation
      if (!filled && shadowRoot) {
        const input = shadowRoot.querySelector('input');
        if (input) {
          input.focus();
          // Simulate typing each character
          for (const char of localNumber) {
            input.value += char;
            input.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              composed: true,
              data: char,
              inputType: 'insertText'
            }));
          }
          console.log('JobTracker: Filled phone via character simulation');
          filled = true;
        }
      }

      return filled;
    } catch (e) {
      console.log('JobTracker: Failed to fill phone field', e);
      return false;
    }
  }

  /**
   * Fill an autocomplete field (like city/location)
   * Note: These fields need user to select from dropdown, so we just type to trigger suggestions
   */
  function fillAutocomplete(component, value) {
    if (!value) return false;

    try {
      const shadowRoot = component.shadowRoot;
      if (shadowRoot) {
        const input = shadowRoot.querySelector('input');
        if (input) {
          // Focus the input first
          input.focus();

          // Clear any existing value
          input.value = '';

          // Type the value character by character to trigger autocomplete
          // This simulates user typing and triggers the location search
          input.value = value;

          // Dispatch events to trigger autocomplete dropdown
          input.dispatchEvent(new Event('focus', { bubbles: true, composed: true }));
          input.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            composed: true,
            data: value,
            inputType: 'insertText'
          }));

          // Show notification that user needs to select
          console.log('JobTracker: Typed city value, user should select from dropdown');
          return true;
        }
      }

      return false;
    } catch (e) {
      console.log('JobTracker: Failed to fill autocomplete', e);
      return false;
    }
  }

  /**
   * Check if component has a value
   */
  function hasValue(component) {
    const tagName = component.tagName.toLowerCase();

    // Phone field special handling
    if (tagName === 'spl-phone-field') {
      try {
        const attrValue = component.getAttribute('value');
        if (attrValue) {
          const parsed = JSON.parse(attrValue);
          if (parsed.phoneNumber && parsed.phoneNumber.trim()) return true;
        }
      } catch (e) {}
    }

    // Regular attribute check
    const attrValue = component.getAttribute('value');
    if (attrValue && attrValue.trim() && attrValue !== '{}' && !attrValue.startsWith('{')) {
      return true;
    }

    // Shadow DOM check
    const shadowRoot = component.shadowRoot;
    if (shadowRoot) {
      const input = shadowRoot.querySelector('input:not([type="hidden"]), textarea');
      if (input && input.value && input.value.trim()) return true;
    }

    // Value property check
    if (component.value && typeof component.value === 'string' && component.value.trim()) {
      return true;
    }

    return false;
  }

  /**
   * Main autofill handler using Smart Field Matcher
   */
  async function handleSmartRecruitersAutofill(profile) {
    try {
      let filledCount = 0;
      let autocompleteTyped = false;
      const SmartMatcher = window.JobTrackerSmartFieldMatcher;

      // Collect all fillable components
      const splInputs = document.querySelectorAll('spl-input, spl-textarea');
      const phoneFields = document.querySelectorAll('spl-phone-field');
      const autocompletes = document.querySelectorAll('spl-autocomplete');

      console.log('JobTracker: Found', splInputs.length, 'inputs,', phoneFields.length, 'phones,', autocompletes.length, 'autocompletes');

      // Use Smart Field Matcher if available
      if (SmartMatcher) {
        console.log('JobTracker: Using Smart Field Matcher');

        // Match spl-input and spl-textarea fields
        const matches = SmartMatcher.matchFieldsToProfile(Array.from(splInputs), profile, 25);
        console.log('JobTracker: Smart matches found:', matches.length);

        for (const match of matches) {
          if (hasValue(match.field)) {
            console.log('JobTracker: Skipping filled:', match.fieldType);
            continue;
          }

          console.log(`JobTracker: Filling ${match.fieldType} (${match.confidence}% confidence)`);
          if (fillSplInput(match.field, match.value)) {
            filledCount++;
            await delay(100);
          }
        }
      } else {
        // Fallback to legacy matching
        console.log('JobTracker: Using legacy field matching');
        filledCount = await legacyFill(splInputs, profile);
      }

      // Handle phone fields
      for (const component of phoneFields) {
        if (hasValue(component)) continue;

        const phone = profile.personal?.phone;
        if (phone) {
          console.log('JobTracker: Filling phone field');
          if (fillPhoneField(component, phone)) {
            filledCount++;
            await delay(100);
          }
        }
      }

      // Handle autocomplete fields (city/location)
      // Note: These require user selection from dropdown - we just type to trigger search
      for (const component of autocompletes) {
        if (hasValue(component)) continue;

        // Try to identify what type of autocomplete this is
        const cityValue = profile.personal?.address?.city;
        const label = (component.getAttribute('label') || '').toLowerCase();

        if (cityValue && (label.includes('city') || label.includes('location'))) {
          console.log(`JobTracker: Typing city "${cityValue}" - please select from dropdown`);
          if (fillAutocomplete(component, cityValue)) {
            autocompleteTyped = true;
            await delay(300);
          }
        }
      }

      // Report results
      if (filledCount > 0 || autocompleteTyped) {
        let message = `Filled ${filledCount} fields!`;
        if (autocompleteTyped) {
          message += ' Please select city from dropdown.';
        }
        window.JobTrackerContent?.showNotification(message, 'success');
      } else {
        window.JobTrackerContent?.showNotification('No empty fields to fill', 'info');
      }
    } catch (error) {
      console.error('JobTracker: SmartRecruiters autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error', 'error');
    }
  }

  /**
   * Legacy field matching (fallback)
   */
  async function legacyFill(components, profile) {
    let filledCount = 0;
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};

    for (const component of components) {
      if (hasValue(component)) continue;

      const fieldId = [
        component.getAttribute('id'),
        component.getAttribute('formcontrolname'),
        component.getAttribute('name'),
        component.getAttribute('label'),
        component.getAttribute('data-test'),
        component.closest('[data-test]')?.getAttribute('data-test'),
        component.closest('[formcontrolname]')?.getAttribute('formcontrolname')
      ].filter(Boolean).join(' ').toLowerCase();

      let value = null;

      // Match patterns
      if (/first[-_]?name/i.test(fieldId) && !/middle/i.test(fieldId)) value = personal.firstName;
      else if (/last[-_]?name/i.test(fieldId)) value = personal.lastName;
      else if (/e?mail/i.test(fieldId)) value = personal.email;
      else if (/linkedin/i.test(fieldId)) value = personal.linkedIn;
      else if (/github/i.test(fieldId)) value = personal.github;
      else if (/twitter/i.test(fieldId)) value = personal.twitter;
      else if (/facebook/i.test(fieldId)) value = personal.facebook;
      else if (/website|portfolio/i.test(fieldId)) value = personal.portfolio;
      else if (/city|location/i.test(fieldId)) value = personal.address?.city;
      else if (/company|employer/i.test(fieldId)) value = work.company;
      else if (/title|position|role/i.test(fieldId)) value = work.title;
      else if (/school|university/i.test(fieldId)) value = edu.school;
      else if (/degree/i.test(fieldId)) value = edu.degree;

      if (value) {
        if (fillSplInput(component, value)) {
          filledCount++;
          await delay(100);
        }
      }
    }

    return filledCount;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('JobTracker: SmartRecruiters autofill module loaded');
})();
