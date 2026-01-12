/**
 * JobTracker iCIMS Autofill
 */

(function() {
  'use strict';

  if (window.__jobTrackerIcimsAutofillInitialized) return;
  window.__jobTrackerIcimsAutofillInitialized = true;

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;
    if (!window.location.hostname.includes('icims.com')) return;

    window.__jobTrackerAutofillHandled = true;
    const personal = profile.personal || {};
    let filled = 0;

    document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea').forEach(input => {
      if (input.value) return;
      const id = [input.name, input.id, input.placeholder].join(' ').toLowerCase();

      let value = null;
      if (/first/i.test(id)) value = personal.firstName;
      else if (/last/i.test(id)) value = personal.lastName;
      else if (/email/i.test(id)) value = personal.email;
      else if (/phone/i.test(id)) value = personal.phone;
      else if (/city/i.test(id)) value = personal.address?.city;
      else if (/state/i.test(id)) value = personal.address?.state;
      else if (/zip/i.test(id)) value = personal.address?.zipCode;

      if (value) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    if (filled > 0) window.JobTrackerContent?.showNotification(`Filled ${filled} fields!`, 'success');
  });

  console.log('JobTracker: iCIMS autofill module loaded');
})();
