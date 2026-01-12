/**
 * JobTracker Workday Autofill
 */

(function() {
  'use strict';

  if (window.__jobTrackerWorkdayAutofillInitialized) return;
  window.__jobTrackerWorkdayAutofillInitialized = true;

  window.addEventListener('jobtracker:autofill', async (e) => {
    const profile = e.detail?.profile;
    if (!profile) return;
    if (!/(workday|myworkdayjobs)\.com/i.test(window.location.hostname)) return;

    window.__jobTrackerAutofillHandled = true;
    const personal = profile.personal || {};
    let filled = 0;

    // Workday uses data-automation-id attributes
    const fieldMap = {
      'legalNameSection_firstName': personal.firstName,
      'legalNameSection_lastName': personal.lastName,
      'email': personal.email,
      'phone-device-type': personal.phone,
      'addressSection_city': personal.address?.city,
      'addressSection_countryRegion': personal.address?.state,
      'addressSection_postalCode': personal.address?.zipCode
    };

    for (const [automationId, value] of Object.entries(fieldMap)) {
      if (!value) continue;
      const input = document.querySelector(`[data-automation-id="${automationId}"] input, [data-automation-id="${automationId}"]`);
      if (input && !input.value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      }
    }

    if (filled > 0) window.JobTrackerContent?.showNotification(`Filled ${filled} fields!`, 'success');
  });

  console.log('JobTracker: Workday autofill module loaded');
})();
