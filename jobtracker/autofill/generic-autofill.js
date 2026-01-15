/**
 * JobTracker Generic Autofill
 * Fallback autofill for any job application site not specifically supported
 * Uses multi-stage field matching with certainty scoring
 */

(function() {
  'use strict';

  if (window.__jobTrackerGenericAutofillInitialized) return;
  window.__jobTrackerGenericAutofillInitialized = true;

  // Listen for autofill trigger (fallback when no platform handler picks it up)
  window.addEventListener('jobtracker:autofill', async (e) => {
    // Only handle if no other handler has picked it up
    await new Promise(r => setTimeout(r, 150));
    if (window.__jobTrackerAutofillHandled) return;

    const profile = e.detail?.profile;
    const customRules = e.detail?.customRules || [];
    if (!profile) return;

    window.__jobTrackerAutofillHandled = true;
    await handleGenericAutofill(profile, customRules);
  });

  // Also listen for direct trigger from content.js
  window.addEventListener('jobtracker:trigger-autofill', async () => {
    try {
      const profile = await chrome.runtime.sendMessage({ type: 'GET_PROFILE_FOR_FILL' });
      if (profile) {
        await handleGenericAutofill(profile);
      }
    } catch (error) {
      console.log('JobTracker: Error getting profile:', error);
    }
  });

  async function handleGenericAutofill(profile, customRules = []) {
    try {
      // Try to use the advanced field matcher if available
      if (window.JobTrackerFieldMatcher && window.JobTrackerFormUtils) {
        return await handleAdvancedAutofill(profile, customRules);
      }

      // Fallback to basic autofill
      return await handleBasicAutofill(profile);
    } catch (error) {
      console.log('JobTracker: Generic autofill error:', error);
      showNotification('Error during autofill', 'error');
      return 0;
    }
  }

  /**
   * Advanced autofill using field matcher with certainty scoring
   */
  async function handleAdvancedAutofill(profile, customRules = []) {
    const FormUtils = window.JobTrackerFormUtils;
    const FieldMatcher = window.JobTrackerFieldMatcher;

    // Find the job application form
    const form = FormUtils.findJobApplicationForm();

    // Get all fillable inputs
    const inputs = FormUtils.getFillableInputs(form);

    // Match fields using certainty scoring
    const matches = [];
    const coverLetterMatches = [];
    const processedFields = new Set();

    for (const input of inputs) {
      // Skip if already filled
      if (input.value && input.value.trim()) continue;

      // Skip if not visible
      if (!FormUtils.isVisible(input)) continue;

      // Skip if already processed
      if (processedFields.has(input)) continue;

      // Pass customRules to field matcher for user-defined patterns
      const match = FieldMatcher.matchField(input, profile, customRules);
      if (match && match.value) {
        // Check if this is a cover letter field that requires selection
        const fieldConfig = FieldMatcher.patterns[match.fieldType];
        if (fieldConfig?.requiresSelection && profile.coverLetters?.length > 0) {
          coverLetterMatches.push({
            input,
            ...match
          });
        } else {
          matches.push({
            input,
            ...match
          });
        }
        processedFields.add(input);
      }
    }

    // Sort by certainty (highest first)
    matches.sort((a, b) => b.certainty - a.certainty);

    // Fill regular fields with delay between each
    const filledCount = await FormUtils.fillFieldsWithDelay(matches, 50);

    // Handle cover letter fields - show picker for user selection
    for (const clMatch of coverLetterMatches) {
      await handleCoverLetterField(clMatch.input, profile);
    }

    // Show notification
    if (filledCount > 0) {
      showNotification(`Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}!`, 'success');
    } else {
      showNotification('No empty fields found to fill', 'info');
    }

    return filledCount;
  }

  /**
   * Basic autofill fallback (original logic)
   */
  async function handleBasicAutofill(profile) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};

    // Build value map with expanded fields
    const fullName = [personal.firstName, personal.middleName, personal.lastName]
      .filter(name => name && name.trim())
      .join(' ');

    const prevWork = profile.workHistory?.[1] || {};

    const valueMap = {
      firstName: personal.firstName,
      middleName: personal.middleName,
      lastName: personal.lastName,
      fullName: fullName,
      email: personal.email,
      phone: personal.phone,
      street: personal.address?.street,
      addressLine2: personal.address?.addressLine2,
      city: personal.address?.city,
      state: personal.address?.state,
      zipCode: personal.address?.zipCode,
      country: personal.address?.country,
      linkedIn: personal.linkedIn,
      github: personal.github,
      portfolio: personal.portfolio || personal.website,
      twitter: personal.twitter,
      // Current work experience
      currentCompany: work.company,
      currentTitle: work.title,
      workLocation: work.location,
      workStartDate: work.startDate,
      workEndDate: work.current ? '' : work.endDate,
      workDescription: work.description,
      // Previous work experience
      previousCompany: prevWork.company,
      previousTitle: prevWork.title,
      yearsExperience: personal.yearsExperience,
      school: edu.school,
      degree: edu.degree,
      major: edu.field,
      graduationYear: edu.graduationYear,
      gpa: edu.gpa,
      currentCtc: formatCtc(personal.currentCtc, personal.ctcCurrency),
      expectedCtc: formatCtc(personal.expectedCtc, personal.ctcCurrency),
      noticePeriod: personal.noticePeriod,
      dateOfBirth: personal.dateOfBirth,
      gender: personal.gender,
      nationality: personal.nationality,
      authorizedToWork: personal.authorizedToWork,
      requireSponsorship: personal.requireSponsorship
    };

    let filledCount = 0;

    // Find all fillable inputs
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea, select'
    );

    for (const input of inputs) {
      // Skip if already has value
      if (input.value && input.value.trim()) continue;

      // Skip if not visible
      if (!isVisible(input)) continue;

      // Skip if disabled or readonly
      if (input.disabled || input.readOnly) continue;

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
  }

  /**
   * Handle cover letter field with user selection
   */
  async function handleCoverLetterField(input, profile) {
    const coverLetters = profile.coverLetters || [];

    if (coverLetters.length === 0) return;

    // If there's only one cover letter, fill it directly
    if (coverLetters.length === 1) {
      fillCoverLetterField(input, coverLetters[0].content);
      return;
    }

    // Show picker for multiple cover letters
    return new Promise((resolve) => {
      if (window.JobTrackerCoverLetterPicker) {
        window.JobTrackerCoverLetterPicker.show(coverLetters, input)
          .then((selectedContent) => {
            if (selectedContent) {
              fillCoverLetterField(input, selectedContent);
            }
            resolve();
          });
      } else {
        // Fallback: dispatch event for picker
        const event = new CustomEvent('jobtracker:show-cover-letter-picker', {
          detail: {
            coverLetters,
            targetInput: input,
            callback: (selectedContent) => {
              if (selectedContent) {
                fillCoverLetterField(input, selectedContent);
              }
              resolve();
            }
          }
        });
        window.dispatchEvent(event);

        // Timeout fallback - if no picker responds, use default
        setTimeout(() => {
          if (!input.value || !input.value.trim()) {
            const defaultCL = coverLetters.find(cl => cl.isDefault) || coverLetters[0];
            if (defaultCL) {
              fillCoverLetterField(input, defaultCL.content);
            }
          }
          resolve();
        }, 10000);
      }
    });
  }

  /**
   * Fill cover letter field with content
   */
  function fillCoverLetterField(input, content) {
    if (!input || !content) return;

    const FormUtils = window.JobTrackerFormUtils;

    if (FormUtils) {
      FormUtils.fillInput(input, content);
    } else {
      // Fallback filling
      fillField(input, content);
    }
  }

  // Format CTC with currency
  function formatCtc(amount, currency) {
    if (!amount) return '';
    if (window.JobTrackerFormat?.formatCtc) {
      return window.JobTrackerFormat.formatCtc(amount, currency);
    }
    return amount;
  }

  // Field patterns for basic matching
  const FIELD_PATTERNS = {
    firstName: [/first.?name/i, /given.?name/i, /fname/i, /vorname/i, /prenom/i],
    middleName: [/middle.?name/i, /mname/i, /middle.?initial/i],
    lastName: [/last.?name/i, /family.?name/i, /surname/i, /lname/i, /nachname/i],
    fullName: [/full.?name/i, /^name$/i, /your.?name/i, /applicant.?name/i, /legal.?name/i],
    email: [/e?.?mail/i, /email.?address/i, /correo/i],
    phone: [/phone/i, /mobile/i, /tel/i, /cell/i, /contact.?number/i, /telefon/i],
    street: [/street/i, /address.?line/i, /^address$/i, /address.?1/i],
    addressLine2: [/address.?2/i, /address.?line.?2/i, /apt/i, /suite/i, /unit/i],
    city: [/city/i, /town/i, /locality/i, /stadt/i, /ville/i],
    state: [/state/i, /province/i, /region/i, /bundesland/i],
    zipCode: [/zip/i, /postal/i, /post.?code/i, /pin.?code/i, /plz/i],
    country: [/country/i, /nation/i, /land/i, /pais/i],
    linkedIn: [/linkedin/i, /linked.?in/i],
    github: [/github/i],
    portfolio: [/portfolio/i, /website/i, /personal.?site/i, /personal.?url/i, /^url$/i, /homepage/i],
    twitter: [/twitter/i, /^x$/i],
    currentCompany: [/current.?company/i, /current.?employer/i, /employer/i, /company.?name/i],
    currentTitle: [/current.?title/i, /job.?title/i, /current.?position/i, /position/i, /role/i],
    workLocation: [/work.?location/i, /job.?location/i, /employer.?location/i, /company.?location/i],
    workStartDate: [/start.?date/i, /date.?started/i, /joined.?date/i, /employment.?start/i],
    workEndDate: [/end.?date/i, /date.?ended/i, /left.?date/i, /employment.?end/i],
    workDescription: [/job.?description/i, /responsibilities/i, /duties/i, /role.?description/i],
    previousCompany: [/previous.?company/i, /previous.?employer/i, /past.?employer/i, /former.?company/i],
    previousTitle: [/previous.?title/i, /previous.?position/i, /past.?position/i, /former.?title/i],
    yearsExperience: [/years?.?(?:of)?.?experience/i, /experience.?years/i, /total.?experience/i],
    school: [/school/i, /university/i, /college/i, /institution/i],
    degree: [/degree/i, /qualification/i, /diploma/i],
    major: [/major/i, /field.?of.?study/i, /specialization/i, /course/i],
    graduationYear: [/graduation.?year/i, /grad.?year/i, /year.?graduated/i],
    gpa: [/gpa/i, /grade.?point/i, /cgpa/i],
    currentCtc: [/current.?ctc/i, /current.?salary/i, /present.?salary/i, /current.?compensation/i, /current.?package/i, /ctc.?\(?fixed\)?/i, /fixed.?ctc/i, /base.?salary/i],
    expectedCtc: [/expected.?ctc/i, /expected.?salary/i, /desired.?salary/i, /expected.?compensation/i, /expected.?package/i, /salary.?expectation/i, /target.?salary/i],
    noticePeriod: [/notice.?period/i, /notice/i, /availability/i, /joining.?time/i],
    dateOfBirth: [/date.?of.?birth/i, /dob/i, /birth.?date/i, /birthday/i],
    gender: [/gender/i, /sex/i],
    nationality: [/nationality/i, /citizenship/i],
    authorizedToWork: [/authorized.?to.?work/i, /work.?authorization/i, /right.?to.?work/i],
    requireSponsorship: [/sponsor/i, /visa.?sponsor/i, /require.?sponsor/i]
  };

  // Get field identifiers for matching
  function getFieldIdentifiers(input) {
    return [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.getAttribute('data-field'),
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('autocomplete'),
      getLabelText(input)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  // Get label text for input
  function getLabelText(input) {
    // Check for label with for attribute
    if (input.id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label.textContent;
      } catch (e) {}
    }

    // Check parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent;

    // Check aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent;
    }

    // Check preceding label
    const prev = input.previousElementSibling;
    if (prev?.tagName === 'LABEL') return prev.textContent;

    // Check parent container for label-like element
    const containers = [
      input.closest('.form-group'),
      input.closest('.field'),
      input.closest('.input-group'),
      input.closest('[class*="field"]'),
      input.closest('.application-question'),
      input.closest('[data-automation-id]')
    ].filter(Boolean);

    for (const container of containers) {
      const label = container.querySelector('label, .label, [class*="label"]:not(input)');
      if (label && label !== input) return label.textContent;
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

  // Fill a field with value (framework-aware)
  function fillField(input, value) {
    if (!input || !value) return false;

    const tagName = input.tagName.toLowerCase();

    if (tagName === 'select') {
      return fillSelect(input, value);
    }

    // Use native setter for React/Vue/Angular compatibility
    const prototype = tagName === 'textarea'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor?.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    // Clear React's internal value tracker
    try {
      const tracker = input._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }
    } catch (e) {}

    // Trigger keyboard events (for Angular/Vue)
    dispatchKeyboardEvents(input, value);

    // Trigger standard events
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

    return true;
  }

  // Dispatch keyboard events for Angular/Vue
  function dispatchKeyboardEvents(element, value) {
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
    } catch (e) {}
  }

  // Fill select dropdown using selectedIndex
  function fillSelect(select, value) {
    const valueStr = String(value).toLowerCase().trim();
    const options = Array.from(select.options);
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

    // Strategy 3: Partial match
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
      select.value = options[matchedIndex].value;

      // Trigger events
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));
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

  console.log('JobTracker: Generic autofill module loaded (with advanced matching)');
})();
