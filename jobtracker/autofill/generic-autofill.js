/**
 * JobTracker Generic Autofill
 * Fallback autofill for any job application site not specifically supported
 * Uses the modular autofill system with multi-stage field matching
 */

(function() {
  'use strict';

  if (window.__jobTrackerGenericAutofillInitialized) return;
  window.__jobTrackerGenericAutofillInitialized = true;

  // Listen for autofill trigger (fallback when no platform handler picks it up)
  window.addEventListener('jobtracker:autofill', async (e) => {
    // Only handle if no other handler has picked it up
    await new Promise(r => setTimeout(r, 150));
    if (window.__jobTrackerAutofillHandled) return;

    const profile = e.detail?.profile;
    const customRules = e.detail?.customRules || [];
    if (!profile) return;

    window.__jobTrackerAutofillHandled = true;
    await handleGenericAutofill(profile, customRules);
  });

  // Also listen for direct trigger from content.js
  window.addEventListener('jobtracker:trigger-autofill', async () => {
    try {
      const profile = await chrome.runtime.sendMessage({ type: 'GET_PROFILE_FOR_FILL' });
      if (profile) {
        await handleGenericAutofill(profile);
      }
    } catch (error) {
      console.log('JobTracker: Error getting profile:', error);
    }
  });

  /**
   * Main autofill handler using modular system
   */
  async function handleGenericAutofill(profile, customRules = []) {
    try {
      // Use the modular autofill system
      const Autofill = window.JobTrackerAutofill;
      const FormUtils = window.JobTrackerFormUtils;
      const FieldMatcher = window.JobTrackerFieldMatcher;

      if (!Autofill || !FormUtils || !FieldMatcher) {
        console.log('JobTracker: Autofill modules not loaded');
        showNotification('Autofill modules not loaded', 'error');
        return 0;
      }

      // Find the job application form
      const FormDetector = Autofill.FormDetector;
      if (!FormDetector?.findJobApplicationForm) {
        console.log('JobTracker: FormDetector not available');
        showNotification('Autofill system not ready', 'error');
        return 0;
      }
      const form = FormDetector.findJobApplicationForm();

      // Get all fillable inputs
      const inputs = FormDetector.getFillableInputs(form);

      // Match fields using certainty scoring
      const matches = [];
      const coverLetterMatches = [];
      const termsMatches = [];
      const processedFields = new Set();
      const filledValues = {};  // Track for confirm field detection

      for (const input of inputs) {
        // Skip if already filled
        if (input.value && input.value.trim()) continue;

        // Skip if not visible
        if (!Autofill.DomUtils.isVisible(input)) continue;

        // Skip if already processed
        if (processedFields.has(input)) continue;

        // Check for terms/agreement checkboxes first
        if (input.type === 'checkbox' && Autofill.MatchingStrategies?.matchByTermsCheckbox) {
          const termsMatch = Autofill.MatchingStrategies.matchByTermsCheckbox(input);
          if (termsMatch) {
            termsMatches.push({ input, ...termsMatch });
            processedFields.add(input);
            continue;
          }
        }

        // Try standard matching
        let match = FieldMatcher.matchField(input, profile, customRules);

        // If no match, try confirmation field detection
        if (!match && Object.keys(filledValues).length > 0 && Autofill.MatchingStrategies?.matchByConfirmField) {
          match = Autofill.MatchingStrategies.matchByConfirmField(input, filledValues);
        }

        if (match && match.value) {
          // Check if this is a cover letter field that requires selection
          const fieldConfig = Autofill.FieldPatterns?.FIELD_PATTERNS?.[match.fieldType];
          if (fieldConfig?.requiresSelection && profile.coverLetters?.length > 0) {
            coverLetterMatches.push({ input, ...match });
          } else {
            matches.push({ input, ...match });
            // Track value for potential confirmation fields
            filledValues[match.fieldType] = match.value;
          }
          processedFields.add(input);
        }
      }

      // Sort by certainty (highest first)
      matches.sort((a, b) => b.certainty - a.certainty);

      // Fill regular fields with delay between each
      const InputFillers = Autofill.InputFillers;
      const filledCount = await InputFillers.fillFieldsWithDelay(matches, 50);

      // Auto-check terms checkboxes
      let termsChecked = 0;
      for (const termsMatch of termsMatches) {
        if (InputFillers.fillTermsCheckbox(termsMatch.input)) {
          termsChecked++;
        }
      }

      // Handle cover letter fields - show picker for user selection
      for (const clMatch of coverLetterMatches) {
        await handleCoverLetterField(clMatch.input, profile);
      }

      // Show notification
      const totalFilled = filledCount + termsChecked;
      if (totalFilled > 0) {
        showNotification(`Filled ${totalFilled} field${totalFilled !== 1 ? 's' : ''}!`, 'success');
      } else {
        showNotification('No empty fields found to fill', 'info');
      }

      return totalFilled;
    } catch (error) {
      console.log('JobTracker: Generic autofill error:', error);
      showNotification('Error during autofill', 'error');
      return 0;
    }
  }

  /**
   * Handle cover letter field with user selection
   */
  async function handleCoverLetterField(input, profile) {
    const coverLetters = profile.coverLetters || [];

    if (coverLetters.length === 0) return;

    // If there's only one cover letter, fill it directly
    if (coverLetters.length === 1) {
      fillCoverLetterField(input, coverLetters[0].content);
      return;
    }

    // Show picker for multiple cover letters
    return new Promise((resolve) => {
      if (window.JobTrackerCoverLetterPicker) {
        window.JobTrackerCoverLetterPicker.show(coverLetters, input)
          .then((selectedContent) => {
            if (selectedContent) {
              fillCoverLetterField(input, selectedContent);
            }
            resolve();
          });
      } else {
        // Fallback: dispatch event for picker
        const event = new CustomEvent('jobtracker:show-cover-letter-picker', {
          detail: {
            coverLetters,
            targetInput: input,
            callback: (selectedContent) => {
              if (selectedContent) {
                fillCoverLetterField(input, selectedContent);
              }
              resolve();
            }
          }
        });
        window.dispatchEvent(event);

        // Timeout fallback - if no picker responds, use default
        setTimeout(() => {
          if (!input.value || !input.value.trim()) {
            const defaultCL = coverLetters.find(cl => cl.isDefault) || coverLetters[0];
            if (defaultCL) {
              fillCoverLetterField(input, defaultCL.content);
            }
          }
          resolve();
        }, 10000);
      }
    });
  }

  /**
   * Fill cover letter field with content
   */
  function fillCoverLetterField(input, content) {
    if (!input || !content) return;

    const FormUtils = window.JobTrackerFormUtils;
    if (FormUtils) {
      FormUtils.fillInput(input, content);
    }
  }

  /**
   * Show notification to user
   */
  function showNotification(message, type) {
    if (window.JobTrackerContent?.showNotification) {
      window.JobTrackerContent.showNotification(message, type);
    } else {
      console.log(`JobTracker [${type}]: ${message}`);
    }
  }

  console.log('JobTracker: Generic autofill module loaded (using modular architecture)');
})();
