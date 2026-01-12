/**
 * JobTracker Lever Autofill
 * Handles autofill for Lever ATS job applications
 */

(function() {
  'use strict';

  if (window.__jobTrackerLeverAutofillInitialized) return;
  window.__jobTrackerLeverAutofillInitialized = true;

  window.addEventListener('jobtracker:autofill', async (e) => {
    console.log('JobTracker: Lever autofill event received on', window.location.hostname);
    const profile = e.detail?.profile;
    if (!profile) {
      console.log('JobTracker: No profile in event');
      return;
    }
    if (!window.location.hostname.includes('lever.co') && !window.location.hostname.includes('lever.com')) {
      console.log('JobTracker: Hostname mismatch, skipping');
      return;
    }

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
      } else {
        console.log('JobTracker: No fields matched. Inputs found:', inputs.length);
        window.JobTrackerContent?.showNotification('No matching fields found', 'info');
      }
    } catch (error) {
      console.error('JobTracker: Lever autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error - check console', 'error');
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
    // Strategy 1: Lever-specific container (.application-question)
    const leverContainer = input.closest('.application-question');
    if (leverContainer) {
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
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent;
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

  function fillField(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  console.log('JobTracker: Lever autofill module loaded');
})();
