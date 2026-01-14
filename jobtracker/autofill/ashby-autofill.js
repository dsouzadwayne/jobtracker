/**
 * JobTracker Ashby Autofill
 * Handles autofill for Ashby ATS job applications (jobs.ashbyhq.com)
 * Supports text inputs, textareas, radio buttons, yes/no buttons, and select fields
 */

(function() {
  'use strict';

  if (window.__jobTrackerAshbyAutofillInitialized) return;
  window.__jobTrackerAshbyAutofillInitialized = true;

  // Check if we're on an Ashby domain
  function isAshbyDomain() {
    const hostname = window.location.hostname;
    return hostname.includes('ashbyhq.com') || hostname.includes('ashbyprd.com');
  }

  window.addEventListener('jobtracker:autofill', async (e) => {
    console.log('JobTracker: Ashby autofill event received on', window.location.hostname);
    const profile = e.detail?.profile;
    if (!profile) {
      console.log('JobTracker: No profile in event');
      return;
    }
    if (!isAshbyDomain()) {
      console.log('JobTracker: Hostname mismatch, skipping');
      return;
    }

    window.__jobTrackerAutofillHandled = true;
    await handleAshbyAutofill(profile);
  });

  async function handleAshbyAutofill(profile) {
    try {
      const personal = profile.personal || {};
      const work = profile.workHistory?.[0] || {};
      const edu = profile.education?.[0] || {};
      let filledCount = 0;

      // Build full name
      const fullName = [personal.firstName, personal.middleName, personal.lastName]
        .filter(n => n && n.trim())
        .join(' ');

      // Fill text inputs and textareas
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), textarea'
      );

      for (const input of inputs) {
        // Skip if already filled
        if (input.value && input.value.trim()) continue;
        // Skip if disabled or readonly
        if (input.disabled || input.readOnly) continue;
        // Skip if not visible
        if (!isVisible(input)) continue;

        const value = matchFieldValue(input, profile, fullName);
        if (value) {
          if (fillInput(input, value)) {
            filledCount++;
            await delay(50);
          }
        }
      }

      // Fill select dropdowns
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        if (select.value) continue;
        if (select.disabled) continue;

        const value = matchFieldValue(select, profile, fullName);
        if (value) {
          if (fillSelect(select, value)) {
            filledCount++;
            await delay(50);
          }
        }
      }

      // Fill radio button groups
      const radioFieldsets = document.querySelectorAll('fieldset[class*="container"]');
      for (const fieldset of radioFieldsets) {
        const filled = await fillRadioGroup(fieldset, profile, fullName);
        if (filled) {
          filledCount++;
          await delay(50);
        }
      }

      // Fill Yes/No button groups
      const yesNoGroups = document.querySelectorAll('[class*="yesno"]');
      for (const group of yesNoGroups) {
        const filled = await fillYesNoGroup(group, profile);
        if (filled) {
          filledCount++;
          await delay(50);
        }
      }

      // Show notification
      if (filledCount > 0) {
        showNotification(`Filled ${filledCount} field${filledCount !== 1 ? 's' : ''}!`, 'success');
      } else {
        console.log('JobTracker: No fields matched on Ashby form');
        showNotification('No matching fields found', 'info');
      }

      return filledCount;
    } catch (error) {
      console.log('JobTracker: Ashby autofill error:', error);
      showNotification('Autofill error - check console', 'error');
      return 0;
    }
  }

  function matchFieldValue(input, profile, fullName) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};
    const id = getFieldIdentifiers(input);

    // Name fields
    if (/first.?name|given.?name|fname/i.test(id)) return personal.firstName;
    if (/middle.?name|mname/i.test(id)) return personal.middleName;
    if (/last.?name|family.?name|surname|lname/i.test(id)) return personal.lastName;
    if ((/full.?name|^name$/i.test(id) || /legal.?name/i.test(id)) && !/last|company|first|middle/i.test(id)) {
      return fullName;
    }

    // Contact
    if (/e?.?mail/i.test(id) && !/password/i.test(id)) return personal.email;
    if (/phone|mobile|tel|cell|contact.?number/i.test(id) && !/what.?s?.?app/i.test(id)) {
      return personal.phone;
    }
    if (/what.?s?.?app/i.test(id)) return personal.whatsapp || personal.phone;

    // Address
    if (/city|locality/i.test(id) && !/postal/i.test(id)) return personal.address?.city;
    if (/state|province|region/i.test(id)) return personal.address?.state;
    if (/country|nation/i.test(id)) return personal.address?.country;
    if (/zip|postal/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id) && !/email/i.test(id)) {
      // For full address fields, combine address parts
      const addr = personal.address;
      if (addr) {
        const parts = [addr.street, addr.addressLine2, addr.city, addr.state, addr.zipCode, addr.country];
        return parts.filter(Boolean).join(', ');
      }
    }

    // Links
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio|homepage|personal.?url/i.test(id)) return personal.portfolio || personal.website;
    if (/twitter|^x$/i.test(id)) return personal.twitter;

    // Work
    if (/current.?company|employer|company.?name/i.test(id)) return work.company;
    if (/current.?title|job.?title|position|role/i.test(id) && !/attracted/i.test(id)) return work.title;
    if (/years?.?(?:of)?.?experience/i.test(id)) return personal.yearsExperience;

    // Education
    if (/school|university|college|institution/i.test(id)) return edu.school;
    if (/degree|qualification/i.test(id)) return edu.degree;
    if (/major|field.?of.?study|specialization/i.test(id)) return edu.field;
    if (/graduation.?year|grad.?year/i.test(id)) return edu.graduationYear;
    if (/gpa|grade.?point|cgpa/i.test(id)) return edu.gpa;

    // Compensation
    if (/current.?(?:ctc|salary|compensation|package)|present.?salary|base.?salary/i.test(id)) {
      return formatNumber(personal.currentCtc);
    }
    if (/expected.?(?:ctc|salary|compensation|package)|desired.?salary|salary.?expectation/i.test(id)) {
      return formatNumber(personal.expectedCtc);
    }

    // Demographics
    if (/date.?of.?birth|dob|birth.?date/i.test(id)) return personal.dateOfBirth;
    if (/gender|sex/i.test(id)) return personal.gender;
    if (/nationality|citizenship/i.test(id)) return personal.nationality;

    return null;
  }

  function getFieldIdentifiers(input) {
    const identifiers = [
      input.getAttribute('data-automation-id'),
      input.getAttribute('data-testid'),
      input.getAttribute('data-field'),
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute('aria-label'),
      input.getAttribute('autocomplete'),
      getLabelText(input)
    ];

    return identifiers.filter(Boolean).join(' ').toLowerCase();
  }

  function getLabelText(input) {
    // Strategy 1: Ashby-specific - look for label in field entry container
    const fieldEntry = input.closest('[class*="fieldEntry"], [class*="FieldEntry"]');
    if (fieldEntry) {
      const label = fieldEntry.querySelector('[class*="label"], [class*="Label"], [class*="heading"]');
      if (label && label !== input) return label.textContent;
    }

    // Strategy 2: aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Strategy 3: placeholder
    const placeholder = input.placeholder;
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

    // Strategy 7: Look in ancestors for label-like elements
    let parent = input.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const label = parent.querySelector('label, [class*="label"]:not(input), [class*="heading"]:not(input)');
      if (label && label !== input && !label.contains(input)) {
        return label.textContent;
      }
      parent = parent.parentElement;
    }

    // Strategy 8: Previous sibling
    const prevSibling = input.previousElementSibling;
    if (prevSibling && ['LABEL', 'SPAN', 'DIV'].includes(prevSibling.tagName)) {
      return prevSibling.textContent;
    }

    return '';
  }

  function fillInput(input, value) {
    if (!input || !value) return false;

    const tagName = input.tagName.toLowerCase();
    const prototype = tagName === 'textarea'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    // Set value using native setter (React compatibility)
    if (descriptor?.set) {
      descriptor.set.call(input, String(value));
    } else {
      input.value = String(value);
    }

    // Clear React's internal value tracker
    try {
      const tracker = input._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }
    } catch (e) {}

    // Dispatch events for framework compatibility
    dispatchInputEvents(input, value);

    return true;
  }

  function dispatchInputEvents(element, value) {
    // Focus first
    element.focus();

    // Dispatch keyboard events (helps with some frameworks)
    if (value) {
      const lastChar = String(value).charAt(String(value).length - 1);
      const keyCode = lastChar.charCodeAt(0);

      try {
        element.dispatchEvent(new KeyboardEvent('keydown', {
          key: lastChar,
          keyCode,
          bubbles: true,
          cancelable: true
        }));
        element.dispatchEvent(new KeyboardEvent('keypress', {
          key: lastChar,
          keyCode,
          bubbles: true,
          cancelable: true
        }));
        element.dispatchEvent(new KeyboardEvent('keyup', {
          key: lastChar,
          keyCode,
          bubbles: true,
          cancelable: true
        }));
      } catch (e) {}
    }

    // Standard events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  }

  function fillSelect(select, value) {
    const valueStr = String(value).toLowerCase().trim();
    const options = Array.from(select.options);
    let matchedIndex = -1;

    // Exact value match
    matchedIndex = options.findIndex(opt =>
      opt.value.toLowerCase() === valueStr
    );

    // Exact text match
    if (matchedIndex === -1) {
      matchedIndex = options.findIndex(opt =>
        opt.textContent.toLowerCase().trim() === valueStr
      );
    }

    // Partial match
    if (matchedIndex === -1) {
      matchedIndex = options.findIndex(opt =>
        opt.value.toLowerCase().includes(valueStr) ||
        opt.textContent.toLowerCase().includes(valueStr) ||
        valueStr.includes(opt.value.toLowerCase()) ||
        valueStr.includes(opt.textContent.toLowerCase().trim())
      );
    }

    if (matchedIndex !== -1) {
      select.selectedIndex = matchedIndex;
      select.value = options[matchedIndex].value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    return false;
  }

  async function fillRadioGroup(fieldset, profile, fullName) {
    const personal = profile.personal || {};
    const labelEl = fieldset.querySelector('[class*="label"], [class*="heading"], legend');
    if (!labelEl) return false;

    const labelText = labelEl.textContent.toLowerCase();

    // Check if any radio is already selected
    const radios = fieldset.querySelectorAll('input[type="radio"]');
    const hasSelection = Array.from(radios).some(r => r.checked);
    if (hasSelection) return false;

    let targetValue = null;

    // Notice period
    if (/notice.?period|availability/i.test(labelText)) {
      const noticePeriod = personal.noticePeriod?.toLowerCase() || '';
      if (noticePeriod.includes('immediate') || noticePeriod === '0') {
        targetValue = 'immediately';
      } else if (noticePeriod.includes('2 week') || noticePeriod.includes('14') || noticePeriod.includes('15')) {
        targetValue = '2 weeks';
      } else if (noticePeriod.includes('30') || noticePeriod.includes('1 month') || noticePeriod.includes('one month')) {
        targetValue = '30 days';
      } else if (noticePeriod.includes('60') || noticePeriod.includes('2 month')) {
        targetValue = '60 days';
      } else if (noticePeriod.includes('90') || noticePeriod.includes('3 month')) {
        targetValue = '90 days';
      }
    }

    // Notice buyout
    if (/notice.?period.?(?:eligible|eligable|bought|buy)/i.test(labelText)) {
      targetValue = personal.noticeBuyout ? 'yes' : 'no';
    }

    // Find and click matching option
    if (targetValue) {
      const options = fieldset.querySelectorAll('[class*="option"]');
      for (const option of options) {
        const optionText = option.textContent.toLowerCase();
        if (optionText.includes(targetValue)) {
          // Click the label to trigger the radio
          const label = option.querySelector('label') || option;
          label.click();
          await delay(30);
          return true;
        }
      }
    }

    return false;
  }

  async function fillYesNoGroup(group, profile) {
    const personal = profile.personal || {};

    // Find the question label
    const fieldEntry = group.closest('[class*="fieldEntry"]');
    if (!fieldEntry) return false;

    const labelEl = fieldEntry.querySelector('[class*="label"], [class*="heading"]');
    if (!labelEl) return false;

    const labelText = labelEl.textContent.toLowerCase();

    // Check if already answered
    const buttons = group.querySelectorAll('button');
    const hasSelection = Array.from(buttons).some(b =>
      b.classList.contains('selected') || b.getAttribute('aria-pressed') === 'true'
    );
    if (hasSelection) return false;

    let answer = null;

    // Work authorization
    if (/authorized.?to.?work|legally.?authorized|right.?to.?work|work.?authorization/i.test(labelText)) {
      answer = personal.authorizedToWork;
    }

    // Visa sponsorship
    if (/sponsor|visa.?sponsor|require.?sponsor/i.test(labelText)) {
      answer = personal.requireSponsorship;
    }

    // Commute/location
    if (/commut|onsite|on.?site|office|relocat/i.test(labelText)) {
      answer = personal.canCommute ?? personal.willingToRelocate;
    }

    if (answer !== null && answer !== undefined) {
      const yesButton = Array.from(buttons).find(b => b.textContent.trim().toLowerCase() === 'yes');
      const noButton = Array.from(buttons).find(b => b.textContent.trim().toLowerCase() === 'no');

      const buttonToClick = answer ? yesButton : noButton;
      if (buttonToClick) {
        buttonToClick.click();
        await delay(30);
        return true;
      }
    }

    return false;
  }

  function formatNumber(value) {
    if (!value) return null;
    // If it's already a number, return as string
    if (typeof value === 'number') return String(value);
    // Remove currency symbols and formatting, keep just the number
    const numStr = String(value).replace(/[^0-9.]/g, '');
    return numStr || null;
  }

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showNotification(message, type) {
    if (window.JobTrackerContent?.showNotification) {
      window.JobTrackerContent.showNotification(message, type);
    } else {
      console.log(`JobTracker [${type}]: ${message}`);
    }
  }

  console.log('JobTracker: Ashby autofill module loaded');
})();
