/**
 * JobTracker Lever Autofill
 * Handles autofill for Lever ATS job applications
 * Uses improved form utilities for framework compatibility
 */

(function() {
  'use strict';

  if (window.__jobTrackerLeverAutofillInitialized) return;
  window.__jobTrackerLeverAutofillInitialized = true;

  // Valid Lever hostnames (jobs.lever.co subdomains)
  function isLeverDomain() {
    const hostname = window.location.hostname;
    return hostname === 'jobs.lever.co' || hostname.endsWith('.lever.co');
  }

  window.addEventListener('jobtracker:autofill', async (e) => {
    console.log('JobTracker: Lever autofill event received on', window.location.hostname);
    const profile = e.detail?.profile;
    if (!profile) {
      console.log('JobTracker: No profile in event');
      return;
    }
    if (!isLeverDomain()) {
      console.log('JobTracker: Hostname mismatch, skipping');
      return;
    }

    window.__jobTrackerAutofillHandled = true;
    await handleLeverAutofill(profile);
  });

  async function handleLeverAutofill(profile) {
    try {
      const FormUtils = window.JobTrackerFormUtils;
      const personal = profile.personal || {};
      let filledCount = 0;

      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select');

      for (const input of inputs) {
        if (input.value && input.value.trim()) continue;
        if (input.disabled || input.readOnly) continue;

        const value = matchFieldValue(input, profile);
        if (value) {
          // Use shared form utilities if available
          const success = FormUtils ? FormUtils.fillInput(input, value) : fillField(input, value);
          if (success) {
            filledCount++;
            await new Promise(r => setTimeout(r, 50));
          }
        }
      }

      if (filledCount > 0) {
        window.JobTrackerContent?.showNotification(`Filled ${filledCount} fields!`, 'success');
      } else {
        console.log('JobTracker: No fields matched. Inputs found:', inputs.length);
        window.JobTrackerContent?.showNotification('No matching fields found', 'info');
      }
    } catch (error) {
      console.log('JobTracker: Lever autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error - check console', 'error');
    }
  }

  function matchFieldValue(input, profile) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};
    const id = getFieldIdentifiers(input);
    const fullName = [personal.firstName, personal.middleName, personal.lastName].filter(n => n && n.trim()).join(' ');

    // Personal info
    if (/first.?name|given.?name|fname/i.test(id)) return personal.firstName;
    if (/middle.?name|mname/i.test(id)) return personal.middleName;
    if (/last.?name|family.?name|surname|lname/i.test(id)) return personal.lastName;
    if (/full.?name|^name$/i.test(id) && !/last|company|first|middle/i.test(id)) return fullName;
    if (/e?.?mail/i.test(id)) return personal.email;
    if (/phone|mobile|tel/i.test(id)) return personal.phone;

    // Links
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio|homepage/i.test(id)) return personal.portfolio;
    if (/twitter|^x$/i.test(id)) return personal.twitter;

    // Address
    if (/city|location/i.test(id)) return personal.address?.city;
    if (/state|province|region/i.test(id)) return personal.address?.state;
    if (/country/i.test(id)) return personal.address?.country;
    if (/zip|postal/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id)) return personal.address?.street;

    // Work
    if (/current.?company|employer|company.?name/i.test(id)) return work.company;
    if (/current.?title|job.?title|position|role/i.test(id)) return work.title;
    if (/years?.?(?:of)?.?experience/i.test(id)) return personal.yearsExperience;

    // Education
    if (/school|university|college|institution/i.test(id)) return edu.school;
    if (/degree|qualification/i.test(id)) return edu.degree;
    if (/major|field.?of.?study/i.test(id)) return edu.field;

    // Compensation
    if (/current.?ctc|current.?salary|present.?salary|ctc.?\(fixed\)|base.?salary/i.test(id)) {
      return window.JobTrackerFormat?.formatCtc(personal.currentCtc, personal.ctcCurrency) || personal.currentCtc;
    }
    if (/expected.?ctc|expected.?salary|desired.?salary|salary.?expectation/i.test(id)) {
      return window.JobTrackerFormat?.formatCtc(personal.expectedCtc, personal.ctcCurrency) || personal.expectedCtc;
    }
    if (/notice.?period|notice|availability/i.test(id)) return personal.noticePeriod;

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
    // Strategy 1: Lever-specific container (.application-question)
    const leverContainer = input.closest('.application-question');
    if (leverContainer) {
      const textDiv = leverContainer.querySelector('.application-label .text');
      if (textDiv) return textDiv.textContent;
      const label = leverContainer.querySelector('label, .application-label');
      if (label) return label.textContent;
    }

    // Strategy 2: aria-label attribute
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Strategy 3: placeholder attribute
    const placeholder = input.getAttribute('placeholder');
    if (placeholder) return placeholder;

    // Strategy 4: Associated label via for/id
    if (input.id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label.textContent;
      } catch (e) {}
    }

    // Strategy 5: Parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent;

    // Strategy 6: aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent;
    }

    // Strategy 7: Look in parent/ancestor for label-like elements
    let parent = input.parentElement;
    for (let i = 0; i < 4 && parent; i++) {
      const label = parent.querySelector('label, [class*="label"], [class*="Label"]');
      if (label && label !== input && !label.contains(input)) {
        return label.textContent;
      }
      parent = parent.parentElement;
    }

    // Strategy 8: Previous sibling text
    const prevSibling = input.previousElementSibling;
    if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.tagName === 'SPAN' || prevSibling.tagName === 'DIV')) {
      return prevSibling.textContent;
    }

    return '';
  }

  // Fallback fill function when FormUtils not available
  function fillField(element, value) {
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
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }

    // Clear React tracker
    try {
      if (element._valueTracker) element._valueTracker.setValue('');
    } catch (e) {}

    // Dispatch keyboard events
    dispatchKeyboardEvents(element, value);

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function dispatchKeyboardEvents(element, value) {
    if (!value) return;
    const lastChar = value.charAt(value.length - 1);
    const keyCode = lastChar.charCodeAt(0);
    try {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, keyCode, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, keyCode, bubbles: true }));
    } catch (e) {}
  }

  console.log('JobTracker: Lever autofill module loaded');
})();
