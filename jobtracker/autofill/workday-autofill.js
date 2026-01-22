/**
 * JobTracker Workday Autofill
 * Uses improved form utilities for framework compatibility
 */

(function() {
  'use strict';

  if (window.__jobTrackerWorkdayAutofillInitialized) return;
  window.__jobTrackerWorkdayAutofillInitialized = true;

  // Valid Workday hostnames
  function isWorkdayDomain() {
    const hostname = window.location.hostname;
    return hostname.endsWith('.myworkdayjobs.com') ||
           hostname.endsWith('.workday.com') ||
           hostname === 'myworkdayjobs.com' ||
           hostname === 'workday.com';
  }

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;
    if (!isWorkdayDomain()) return;

    window.__jobTrackerAutofillHandled = true;
    await handleWorkdayAutofill(profile);
  });

  async function handleWorkdayAutofill(profile) {
    try {
      const FormUtils = window.JobTrackerFormUtils;
      const personal = profile.personal || {};
      const work = profile.workHistory?.[0] || {};
      const edu = profile.education?.[0] || {};
      let filled = 0;

      const fullName = [personal.firstName, personal.middleName, personal.lastName].filter(n => n && n.trim()).join(' ');

      // Workday uses data-automation-id attributes
      const fieldMap = {
        'legalNameSection_firstName': personal.firstName,
        'legalNameSection_middleName': personal.middleName,
        'legalNameSection_lastName': personal.lastName,
        'legalNameSection_fullName': fullName,
        'name': fullName,
        'firstName': personal.firstName,
        'lastName': personal.lastName,
        'email': personal.email,
        'phone': personal.phone,
        'phone-device-type': personal.phone,
        'addressSection_city': personal.address?.city,
        'city': personal.address?.city,
        'addressSection_countryRegion': personal.address?.state,
        'state': personal.address?.state,
        'addressSection_postalCode': personal.address?.zipCode,
        'postalCode': personal.address?.zipCode,
        'addressSection_addressLine1': personal.address?.street,
        'address': personal.address?.street,
        'linkedin': personal.linkedIn,
        'linkedIn': personal.linkedIn,
        'linkedInProfile': personal.linkedIn,
        'currentCompany': work.company,
        'currentEmployer': work.company,
        'currentTitle': work.title,
        'currentPosition': work.title,
        'school': edu.school,
        'university': edu.school,
        'degree': edu.degree,
        'fieldOfStudy': edu.field,
        'currentSalary': window.JobTrackerFormat?.formatCtc(personal.currentCtc, personal.ctcCurrency) || personal.currentCtc,
        'expectedSalary': window.JobTrackerFormat?.formatCtc(personal.expectedCtc, personal.ctcCurrency) || personal.expectedCtc,
        'desiredSalary': window.JobTrackerFormat?.formatCtc(personal.expectedCtc, personal.ctcCurrency) || personal.expectedCtc,
        'noticePeriod': personal.noticePeriod
      };

      // Fill by data-automation-id
      for (const [automationId, value] of Object.entries(fieldMap)) {
        if (!value) continue;

        // Try multiple selectors for Workday's complex structure
        const selectors = [
          `[data-automation-id="${automationId}"] input:not([type="hidden"])`,
          `[data-automation-id="${automationId}"] textarea`,
          `[data-automation-id="${automationId}"] select`,
          `[data-automation-id="${automationId}"]`,
          `input[data-automation-id="${automationId}"]`,
          `textarea[data-automation-id="${automationId}"]`,
          `select[data-automation-id="${automationId}"]`
        ];

        for (const selector of selectors) {
          try {
            const input = document.querySelector(selector);
            if (input && !input.value && isInputElement(input)) {
              const success = FormUtils ? FormUtils.fillInput(input, value) : fillField(input, value);
              if (success) {
                filled++;
                await delay(50);
                break;
              }
            }
          } catch (e) {
            // Selector query may fail for certain complex selectors
            console.warn('JobTracker: Selector query failed', selector, e.message);
          }
        }
      }

      // Also try generic field matching for fields without data-automation-id
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select');
      for (const input of inputs) {
        if (input.value && input.value.trim()) continue;
        if (input.disabled || input.readOnly) continue;

        const value = matchFieldValue(input, profile);
        if (value) {
          const success = FormUtils ? FormUtils.fillInput(input, value) : fillField(input, value);
          if (success) {
            filled++;
            await delay(50);
          }
        }
      }

      if (filled > 0) {
        window.JobTrackerContent?.showNotification(`Filled ${filled} fields!`, 'success');
      } else {
        window.JobTrackerContent?.showNotification('No matching fields found', 'info');
      }
    } catch (error) {
      console.log('JobTracker: Workday autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error', 'error');
    }
  }

  function isInputElement(el) {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function matchFieldValue(input, profile) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};
    const id = getFieldIdentifiers(input);
    const fullName = [personal.firstName, personal.middleName, personal.lastName].filter(n => n && n.trim()).join(' ');

    if (/first.?name|given.?name/i.test(id)) return personal.firstName;
    if (/middle.?name/i.test(id)) return personal.middleName;
    if (/last.?name|family.?name|surname/i.test(id)) return personal.lastName;
    if (/full.?name|^name$/i.test(id) && !/last|company|first|middle/i.test(id)) return fullName;
    if (/e?.?mail/i.test(id)) return personal.email;
    if (/phone|mobile|tel/i.test(id)) return personal.phone;
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio/i.test(id)) return personal.portfolio;
    if (/city|location/i.test(id)) return personal.address?.city;
    if (/state|province|region/i.test(id)) return personal.address?.state;
    if (/country/i.test(id)) return personal.address?.country;
    if (/zip|postal/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id)) return personal.address?.street;
    if (/current.?company|employer/i.test(id)) return work.company;
    if (/current.?title|job.?title|position/i.test(id)) return work.title;
    if (/school|university|college/i.test(id)) return edu.school;
    if (/degree/i.test(id)) return edu.degree;
    if (/major|field.?of.?study/i.test(id)) return edu.field;
    if (/current.?ctc|current.?salary|present.?salary|base.?salary/i.test(id)) {
      return window.JobTrackerFormat?.formatCtc(personal.currentCtc, personal.ctcCurrency) || personal.currentCtc;
    }
    if (/expected.?ctc|expected.?salary|desired.?salary/i.test(id)) {
      return window.JobTrackerFormat?.formatCtc(personal.expectedCtc, personal.ctcCurrency) || personal.expectedCtc;
    }
    if (/notice.?period|notice/i.test(id)) return personal.noticePeriod;

    return null;
  }

  function getFieldIdentifiers(input) {
    return [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      getLabelText(input)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function getLabelText(input) {
    // Workday-specific: check for label in data-automation-id container
    const automationContainer = input.closest('[data-automation-id]');
    if (automationContainer) {
      const label = automationContainer.querySelector('label, [data-automation-id*="label"]');
      if (label && label !== input) return label.textContent;
    }

    if (input.id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label.textContent;
      } catch (e) {
        // CSS.escape may fail for certain input ids
        console.warn('JobTracker: Label query failed for input', input.id, e.message);
      }
    }

    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent;

    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent;
    }

    return '';
  }

  // Fallback fill function
  function fillField(element, value) {
    // Validate element is an HTMLElement
    if (!element || !(element instanceof HTMLElement)) {
      console.warn('JobTracker: fillField called with invalid element');
      return false;
    }
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'select') {
      const options = Array.from(element.options);
      const valueStr = String(value).toLowerCase();
      const matchedIndex = options.findIndex(opt =>
        opt.value.toLowerCase() === valueStr ||
        opt.textContent.toLowerCase().trim() === valueStr ||
        opt.value.toLowerCase().includes(valueStr) ||
        opt.textContent.toLowerCase().includes(valueStr)
      );
      if (matchedIndex !== -1) {
        element.selectedIndex = matchedIndex;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }

    const prototype = tagName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(element, value);
    else element.value = value;

    // Clear React tracker - set previous value to something different from new value
    try {
      if (element._valueTracker) {
        element._valueTracker.setValue(value ? '' : '_placeholder_');
      }
    } catch (e) {
      // React value tracker may not exist in all frameworks
      console.warn('JobTracker: Failed to clear React value tracker', e.message);
    }

    // Dispatch keyboard events
    dispatchKeyboardEvents(element, value);

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function dispatchKeyboardEvents(element, value) {
    if (!value) return;
    const lastChar = String(value).charAt(String(value).length - 1);
    const keyCode = lastChar.charCodeAt(0);
    try {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, keyCode, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, keyCode, bubbles: true }));
    } catch (e) {
      // KeyboardEvent may fail in some browser contexts
      console.warn('JobTracker: Failed to dispatch keyboard events', e.message);
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('JobTracker: Workday autofill module loaded');
})();
