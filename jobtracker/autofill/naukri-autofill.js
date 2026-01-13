/**
 * JobTracker Naukri Autofill
 * Handles autofill for Naukri job application forms
 * Uses shared form utilities from lib/form-utils.js
 */

(function() {
  'use strict';

  if (window.__jobTrackerNaukriAutofillInitialized) return;
  window.__jobTrackerNaukriAutofillInitialized = true;

  const NAUKRI_HOSTNAMES = ['www.naukri.com', 'naukri.com'];

  function isNaukriDomain() {
    return NAUKRI_HOSTNAMES.includes(window.location.hostname);
  }

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile || !isNaukriDomain()) return;

    window.__jobTrackerAutofillHandled = true;
    await handleNaukriAutofill(profile);
  });

  async function handleNaukriAutofill(profile) {
    try {
      const FormUtils = window.JobTrackerFormUtils;
      let filledCount = 0;

      // Find application form or use body
      const form = document.querySelector('form[class*="apply"], .apply-form, [class*="application-form"]') || document.body;
      const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), textarea, select');

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
      console.log('JobTracker: Naukri autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error', 'error');
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
    if (/e?.?mail/i.test(id) || input.type === 'email') return personal.email;
    if (/phone|mobile|tel|contact/i.test(id) || input.type === 'tel') return personal.phone;

    // Links
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio|homepage/i.test(id)) return personal.portfolio;

    // Address
    if (/city|location/i.test(id)) return personal.address?.city;
    if (/state|province|region/i.test(id)) return personal.address?.state;
    if (/country/i.test(id)) return personal.address?.country;
    if (/zip|postal|pin.?code/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id)) return personal.address?.street;

    // Work
    if (/current.?company|employer|company.?name/i.test(id)) return work.company;
    if (/current.?title|job.?title|position|designation|role/i.test(id)) return work.title;
    if (/years?.?(?:of)?.?experience|exp|total.?experience/i.test(id)) {
      return calculateExperience(profile.workHistory) || personal.yearsExperience;
    }

    // Education
    if (/school|university|college|institution/i.test(id)) return edu.school;
    if (/degree|qualification/i.test(id)) return edu.degree;
    if (/major|field.?of.?study|specialization/i.test(id)) return edu.field;

    // Compensation
    if (/current.?ctc|current.?salary|present.?salary|present.?ctc|fixed.?ctc/i.test(id)) {
      return window.JobTrackerFormat?.formatCtc(personal.currentCtc, personal.ctcCurrency) || personal.currentCtc;
    }
    if (/expected.?ctc|expected.?salary|desired.?salary|salary.?expectation/i.test(id)) {
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
    if (input.id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label.textContent;
      } catch (e) {}
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

  function calculateExperience(workHistory) {
    if (!workHistory || workHistory.length === 0) return null;
    let totalMonths = 0;
    for (const job of workHistory) {
      if (job.startDate) {
        const start = new Date(job.startDate);
        const end = job.endDate ? new Date(job.endDate) : new Date();
        totalMonths += (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      }
    }
    if (totalMonths === 0) return null;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years > 0 && months > 0) return `${years} years ${months} months`;
    if (years > 0) return `${years} years`;
    return `${months} months`;
  }

  function fallbackFill(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  console.log('JobTracker: Naukri autofill module loaded');
})();
