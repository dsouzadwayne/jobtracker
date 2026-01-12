/**
 * JobTracker Generic Autofill
 * Fallback autofill for any job application site not specifically supported
 */

(function() {
  'use strict';

  if (window.__jobTrackerGenericAutofillInitialized) return;
  window.__jobTrackerGenericAutofillInitialized = true;

  // Field pattern mappings
  const FIELD_PATTERNS = {
    firstName: [/first.?name/i, /given.?name/i, /fname/i, /vorname/i],
    lastName: [/last.?name/i, /family.?name/i, /surname/i, /lname/i, /nachname/i],
    fullName: [/full.?name/i, /^name$/i, /your.?name/i, /applicant.?name/i],
    email: [/e?.?mail/i, /email.?address/i],
    phone: [/phone/i, /mobile/i, /tel/i, /cell/i, /contact.?number/i],
    street: [/street/i, /address.?line/i, /^address$/i, /address.?1/i],
    city: [/city/i, /town/i, /locality/i],
    state: [/state/i, /province/i, /region/i],
    zipCode: [/zip/i, /postal/i, /post.?code/i],
    country: [/country/i, /nation/i],
    linkedIn: [/linkedin/i, /linked.?in/i],
    github: [/github/i],
    portfolio: [/portfolio/i, /website/i, /personal.?site/i, /personal.?url/i, /^url$/i],
    currentCompany: [/current.?company/i, /current.?employer/i, /employer/i],
    currentTitle: [/current.?title/i, /job.?title/i, /current.?position/i, /position/i],
    school: [/school/i, /university/i, /college/i, /institution/i],
    degree: [/degree/i, /qualification/i],
    major: [/major/i, /field.?of.?study/i, /specialization/i]
  };

  // Listen for autofill trigger (fallback when no platform handler picks it up)
  window.addEventListener('jobtracker:autofill', async (e) => {
    // Only handle if no other handler has picked it up
    await new Promise(r => setTimeout(r, 150));
    if (window.__jobTrackerAutofillHandled) return;

    const profile = e.detail?.profile;
    if (!profile) return;

    window.__jobTrackerAutofillHandled = true;
    await handleGenericAutofill(profile);
  });

  // Also listen for direct trigger from content.js
  window.addEventListener('jobtracker:trigger-autofill', async () => {
    try {
      const profile = await chrome.runtime.sendMessage({ type: 'GET_PROFILE_FOR_FILL' });
      if (profile) {
        await handleGenericAutofill(profile);
      }
    } catch (error) {
      console.error('JobTracker: Error getting profile:', error);
    }
  });

  async function handleGenericAutofill(profile) {
    try {
      const personal = profile.personal || {};
      const work = profile.workHistory?.[0] || {};
      const edu = profile.education?.[0] || {};

      // Build value map
      const valueMap = {
        firstName: personal.firstName,
        lastName: personal.lastName,
        fullName: `${personal.firstName || ''} ${personal.lastName || ''}`.trim(),
        email: personal.email,
        phone: personal.phone,
        street: personal.address?.street,
        city: personal.address?.city,
        state: personal.address?.state,
        zipCode: personal.address?.zipCode,
        country: personal.address?.country,
        linkedIn: personal.linkedIn,
        github: personal.github,
        portfolio: personal.portfolio || personal.website,
        currentCompany: work.company,
        currentTitle: work.title,
        school: edu.school,
        degree: edu.degree,
        major: edu.field
      };

      let filledCount = 0;

      // Find all fillable inputs
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select'
      );

      for (const input of inputs) {
        // Skip if already has value
        if (input.value && input.value.trim()) continue;

        // Skip if not visible
        if (!isVisible(input)) continue;

        // Get identifiers
        const identifiers = getFieldIdentifiers(input);

        // Find matching field
        const fieldType = matchFieldType(identifiers);
        if (!fieldType) continue;

        // Get value
        const value = valueMap[fieldType];
        if (!value) continue;

        // Fill the field
        if (fillField(input, value)) {
          filledCount++;
          await delay(30);
        }
      }

      // Show notification
      if (filledCount > 0) {
        showNotification(`Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}!`, 'success');
      } else {
        showNotification('No empty fields found to fill', 'info');
      }

      return filledCount;
    } catch (error) {
      console.error('JobTracker: Generic autofill error:', error);
      showNotification('Error during autofill', 'error');
      return 0;
    }
  }

  // Get field identifiers for matching
  function getFieldIdentifiers(input) {
    return [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('data-field'),
      input.getAttribute('autocomplete'),
      getLabelText(input)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  // Get label text for input
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

    // Check parent container for label-like element
    const parent = input.closest('.form-group, .field, .input-group, [class*="field"]');
    if (parent) {
      const label = parent.querySelector('label, .label, [class*="label"]');
      if (label) return label.textContent;
    }

    return '';
  }

  // Match identifiers to field type
  function matchFieldType(identifiers) {
    for (const [fieldType, patterns] of Object.entries(FIELD_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(identifiers))) {
        return fieldType;
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

    // Use native setter for React/Vue/Angular compatibility
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
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

    // For React 16+
    const tracker = input._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }

    return true;
  }

  // Fill select dropdown
  function fillSelect(select, value) {
    const valueStr = String(value).toLowerCase();
    const options = Array.from(select.options);

    // Try exact match first
    let match = options.find(opt =>
      opt.value.toLowerCase() === valueStr ||
      opt.textContent.toLowerCase().trim() === valueStr
    );

    // Try partial match
    if (!match) {
      match = options.find(opt =>
        opt.value.toLowerCase().includes(valueStr) ||
        opt.textContent.toLowerCase().includes(valueStr) ||
        valueStr.includes(opt.value.toLowerCase()) ||
        valueStr.includes(opt.textContent.toLowerCase().trim())
      );
    }

    if (match) {
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  // Check if element is visible
  function isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Delay helper
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Show notification
  function showNotification(message, type) {
    if (window.JobTrackerContent?.showNotification) {
      window.JobTrackerContent.showNotification(message, type);
    } else {
      console.log(`JobTracker [${type}]: ${message}`);
    }
  }

  console.log('JobTracker: Generic autofill module loaded');
})();
