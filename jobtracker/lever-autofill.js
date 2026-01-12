/**
 * JobTracker Lever Autofill
 * Handles autofill for Lever ATS job applications
 */

(function() {
  'use strict';

  if (window.__jobTrackerLeverAutofillInitialized) return;
  window.__jobTrackerLeverAutofillInitialized = true;

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;
    if (!window.location.hostname.includes('lever.co')) return;

    window.__jobTrackerAutofillHandled = true;
    await handleLeverAutofill(profile);
  });

  async function handleLeverAutofill(profile) {
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
          await new Promise(r => setTimeout(r, 30));
        }
      }

      if (filledCount > 0) {
        window.JobTrackerContent?.showNotification(`Filled ${filledCount} fields!`, 'success');
      }
    } catch (error) {
      console.error('JobTracker: Lever autofill error:', error);
    }
  }

  function matchFieldValue(input, profile) {
    const personal = profile.personal || {};
    const id = [input.name, input.id, getLabelText(input)].filter(Boolean).join(' ').toLowerCase();

    if (/name/i.test(id) && !/last|company/i.test(id)) return `${personal.firstName} ${personal.lastName}`.trim();
    if (/email/i.test(id)) return personal.email;
    if (/phone/i.test(id)) return personal.phone;
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio/i.test(id)) return personal.portfolio;
    if (/city|location/i.test(id)) return personal.address?.city;

    return null;
  }

  function getLabelText(input) {
    const container = input.closest('.application-question');
    if (container) {
      const label = container.querySelector('label, .application-label');
      if (label) return label.textContent;
    }
    return '';
  }

  function fillField(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  console.log('JobTracker: Lever autofill module loaded');
})();
