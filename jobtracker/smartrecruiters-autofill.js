/**
 * JobTracker SmartRecruiters Autofill
 */

(function() {
  'use strict';

  if (window.__jobTrackerSmartrecruitersAutofillInitialized) return;
  window.__jobTrackerSmartrecruitersAutofillInitialized = true;

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;
    if (!window.location.hostname.includes('smartrecruiters.com')) return;

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
      else if (/linkedin/i.test(id)) value = personal.linkedIn;

      if (value) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    });

    if (filled > 0) window.JobTrackerContent?.showNotification(`Filled ${filled} fields!`, 'success');
  });

  console.log('JobTracker: SmartRecruiters autofill module loaded');
})();
