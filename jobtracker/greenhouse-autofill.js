/**
 * JobTracker Greenhouse Autofill
 * Handles autofill for Greenhouse ATS job applications
 */

(function() {
  'use strict';

  if (window.__jobTrackerGreenhouseAutofillInitialized) return;
  window.__jobTrackerGreenhouseAutofillInitialized = true;

  // Listen for autofill trigger
  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;

    if (!window.location.hostname.includes('greenhouse.io')) return;

    window.__jobTrackerAutofillHandled = true;
    await handleGreenhouseAutofill(profile);
  });

  async function handleGreenhouseAutofill(profile) {
    try {
      const personal = profile.personal || {};
      let filledCount = 0;

      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select');

      for (const input of inputs) {
        if (input.value && input.value.trim()) continue;

        const value = matchFieldValue(input, profile);
        if (value) {
          fillField(input, value);
          filledCount++;
          await delay(30);
        }
      }

      if (filledCount > 0) {
        showNotification(`Filled ${filledCount} fields!`, 'success');
      }
    } catch (error) {
      console.error('JobTracker: Greenhouse autofill error:', error);
    }
  }

  function matchFieldValue(input, profile) {
    const personal = profile.personal || {};
    const work = profile.workHistory?.[0] || {};
    const edu = profile.education?.[0] || {};

    const id = [input.name, input.id, input.getAttribute('autocomplete'), getLabelText(input)]
      .filter(Boolean).join(' ').toLowerCase();

    if (/first.?name/i.test(id)) return personal.firstName;
    if (/last.?name/i.test(id)) return personal.lastName;
    if (/email/i.test(id)) return personal.email;
    if (/phone/i.test(id)) return personal.phone;
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio/i.test(id)) return personal.portfolio;
    if (/city/i.test(id)) return personal.address?.city;
    if (/state/i.test(id)) return personal.address?.state;
    if (/zip|postal/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id)) return personal.address?.street;
    if (/current.?company|employer/i.test(id)) return work.company;
    if (/current.?title|job.?title/i.test(id)) return work.title;
    if (/school|university/i.test(id)) return edu.school;
    if (/degree/i.test(id)) return edu.degree;

    return null;
  }

  function getLabelText(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent;
    }
    const parent = input.closest('.field, .form-group');
    if (parent) {
      const label = parent.querySelector('label, .label');
      if (label) return label.textContent;
    }
    return '';
  }

  function fillField(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;

    if (setter) setter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showNotification(message, type) {
    if (window.JobTrackerContent?.showNotification) {
      window.JobTrackerContent.showNotification(message, type);
    }
  }

  console.log('JobTracker: Greenhouse autofill module loaded');
})();
