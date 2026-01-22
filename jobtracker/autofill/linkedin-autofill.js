/**
 * JobTracker LinkedIn Autofill
 * Handles autofill for LinkedIn Easy Apply and job application forms
 * Uses shared form utilities from lib/form-utils.js
 */

(function() {
  'use strict';

  if (window.__jobTrackerLinkedInAutofillInitialized) return;
  window.__jobTrackerLinkedInAutofillInitialized = true;

  const LINKEDIN_HOSTNAMES = ['www.linkedin.com', 'linkedin.com'];

  function isLinkedInDomain() {
    return LINKEDIN_HOSTNAMES.includes(window.location.hostname);
  }

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile || !isLinkedInDomain()) return;

    window.__jobTrackerAutofillHandled = true;
    await handleLinkedInAutofill(profile);
  });

  async function handleLinkedInAutofill(profile) {
    try {
      const FormUtils = window.JobTrackerFormUtils;
      const personal = profile.personal || {};
      const work = profile.workHistory?.[0] || {};
      const edu = profile.education?.[0] || {};
      let filledCount = 0;

      // Check for Easy Apply modal first
      const easyApplyModal = document.querySelector('[data-test-modal-id="easy-apply-modal"]');
      const container = easyApplyModal || document.body;

      const inputs = container.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), textarea, select');

      for (const input of inputs) {
        if (input.value && input.value.trim()) continue;
        if (input.disabled || input.readOnly) continue;
        if (FormUtils && !FormUtils.isVisible(input)) continue;

        const value = matchFieldValue(input, profile);
        if (value) {
          const success = FormUtils ? FormUtils.fillInput(input, value) : fallbackFill(input, value);
          if (success) {
            filledCount++;
            await delay(50);
          }
        }
      }

      if (filledCount > 0) {
        window.JobTrackerContent?.showNotification(`Filled ${filledCount} fields!`, 'success');
      } else {
        window.JobTrackerContent?.showNotification('No empty fields found', 'info');
      }
    } catch (error) {
      console.log('JobTracker: LinkedIn autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error', 'error');
    }
  }

  function matchFieldValue(input, profile) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};
    const id = getFieldIdentifiers(input);
    const fullName = [personal.firstName, personal.middleName, personal.lastName].filter(n => n && n.trim()).join(' ');

    if (/first.?name|given.?name|fname/i.test(id)) return personal.firstName;
    if (/middle.?name|mname/i.test(id)) return personal.middleName;
    if (/last.?name|family.?name|surname|lname/i.test(id)) return personal.lastName;
    if (/full.?name|^name$/i.test(id) && !/last|company|first|middle/i.test(id)) return fullName;
    if (/e?.?mail/i.test(id) || input.type === 'email') return personal.email;
    if (/phone|mobile|tel|cell/i.test(id) || input.type === 'tel') return personal.phone;
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio|homepage/i.test(id)) return personal.portfolio;
    if (/twitter|^x$/i.test(id)) return personal.twitter;
    if (/city|location/i.test(id)) return personal.address?.city;
    if (/state|province|region/i.test(id)) return personal.address?.state;
    if (/country/i.test(id)) return personal.address?.country;
    if (/zip|postal/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id)) return personal.address?.street;
    if (/current.?company|employer/i.test(id)) return work.company;
    if (/current.?title|job.?title|position|role/i.test(id)) return work.title;
    if (/school|university|college/i.test(id)) return edu.school;
    if (/degree/i.test(id)) return edu.degree;
    if (/major|field.?of.?study/i.test(id)) return edu.field;
    if (/current.?ctc|current.?salary|present.?salary|base.?salary/i.test(id)) {
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
    const prev = input.previousElementSibling;
    if (prev?.tagName === 'LABEL') return prev.textContent;
    const parent = input.closest('.form-group, .field, [class*="field"]');
    if (parent) {
      const label = parent.querySelector('label, .label, [class*="label"]:not(input)');
      if (label && label !== input) return label.textContent;
    }
    return '';
  }

  // Minimal fallback if FormUtils not loaded
  function fallbackFill(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('JobTracker: LinkedIn autofill module loaded');
})();
