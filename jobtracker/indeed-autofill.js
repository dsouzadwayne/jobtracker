/**
 * JobTracker Indeed Autofill
 * Handles autofill for Indeed job applications
 */

(function() {
  'use strict';

  if (window.__jobTrackerIndeedAutofillInitialized) return;
  window.__jobTrackerIndeedAutofillInitialized = true;

  // Indeed-specific selectors
  const SELECTORS = {
    applyModal: '.ia-BasePage, [class*="indeed-apply"]',
    formInput: 'input:not([type="hidden"]):not([type="file"])',
    formTextarea: 'textarea',
    formSelect: 'select',
    phoneInput: '[name*="phone"], [id*="phone"]',
    emailInput: '[name*="email"], [id*="email"]'
  };

  // Listen for autofill trigger
  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;

    if (!window.location.hostname.includes('indeed.com')) return;

    window.__jobTrackerAutofillHandled = true;
    await handleIndeedAutofill(profile);
  });

  async function handleIndeedAutofill(profile) {
    try {
      const personal = profile.personal || {};
      let filledCount = 0;

      // Find all inputs on the page
      const inputs = document.querySelectorAll(`${SELECTORS.formInput}, ${SELECTORS.formTextarea}, ${SELECTORS.formSelect}`);

      for (const input of inputs) {
        if (input.value && input.value.trim()) continue;
        if (!isVisible(input)) continue;

        const value = matchFieldValue(input, profile);
        if (value) {
          fillField(input, value);
          filledCount++;
          await delay(30);
        }
      }

      if (filledCount > 0) {
        showNotification(`Filled ${filledCount} fields on Indeed!`, 'success');
      } else {
        showNotification('No empty fields found to fill', 'info');
      }
    } catch (error) {
      console.error('JobTracker: Indeed autofill error:', error);
      showNotification('Error filling Indeed form', 'error');
    }
  }

  function matchFieldValue(input, profile) {
    const personal = profile.personal || {};
    const identifier = [input.name, input.id, input.placeholder, input.getAttribute('aria-label')]
      .filter(Boolean).join(' ').toLowerCase();

    // Match patterns
    if (/first.?name|given/i.test(identifier)) return personal.firstName;
    if (/last.?name|family|surname/i.test(identifier)) return personal.lastName;
    if (/^name$|full.?name/i.test(identifier)) return `${personal.firstName} ${personal.lastName}`.trim();
    if (/email/i.test(identifier) || input.type === 'email') return personal.email;
    if (/phone|mobile|cell/i.test(identifier) || input.type === 'tel') return personal.phone;
    if (/city/i.test(identifier)) return personal.address?.city;
    if (/state|province/i.test(identifier)) return personal.address?.state;
    if (/zip|postal/i.test(identifier)) return personal.address?.zipCode;
    if (/street|address/i.test(identifier)) return personal.address?.street;
    if (/linkedin/i.test(identifier)) return personal.linkedIn;
    if (/github/i.test(identifier)) return personal.github;
    if (/portfolio|website/i.test(identifier)) return personal.portfolio;

    return null;
  }

  function fillField(input, value) {
    const tagName = input.tagName.toLowerCase();

    if (tagName === 'select') {
      const options = Array.from(input.options);
      const match = options.find(opt =>
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.textContent.toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        input.value = match.value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    const setter = Object.getOwnPropertyDescriptor(
      tagName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;

    if (setter) setter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showNotification(message, type) {
    if (window.JobTrackerContent?.showNotification) {
      window.JobTrackerContent.showNotification(message, type);
    }
  }

  console.log('JobTracker: Indeed autofill module loaded');
})();
