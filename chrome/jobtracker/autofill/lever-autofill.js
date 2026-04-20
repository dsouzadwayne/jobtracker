/**
 * JobTracker Lever Autofill
 * Handles autofill for Lever ATS job applications
 * Uses improved form utilities for framework compatibility
 */

(function() {
  'use strict';

  if (window.__jobTrackerLeverAutofillInitialized) return;
  window.__jobTrackerLeverAutofillInitialized = true;

  // Valid Lever hostnames (jobs.lever.co subdomains)
  function isLeverDomain() {
    const hostname = window.location.hostname;
    return hostname === 'jobs.lever.co' || hostname.endsWith('.lever.co');
  }

  window.addEventListener('jobtracker:autofill', async () => {
    if (!isLeverDomain()) return;
    const profile = await chrome.runtime.sendMessage({ type: 'GET_PROFILE_FOR_FILL' });
    if (!profile) return;

    window.__jobTrackerAutofillHandled = true;
    await handleLeverAutofill(profile);
  });

  async function handleLeverAutofill(profile) {
    try {
      const FormUtils = window.JobTrackerFormUtils;
      const personal = profile.personal || {};
      const work = profile.workHistory?.[0] || {};
      const edu = profile.education?.[0] || {};
      const customQA = profile.customQA || [];
      let filledCount = 0;

      const fullName = [personal.firstName, personal.middleName, personal.lastName]
        .filter(n => n && n.trim()).join(' ');

      // Compose a full location string from address components
      const locationStr = [personal.address?.city, personal.address?.state, personal.address?.country]
        .filter(Boolean).join(', ');

      // Phase 1: Direct mapping by Lever's known field name attributes
      const leverFieldMap = [
        { name: 'name', value: fullName },
        { name: 'email', value: personal.email },
        { name: 'phone', value: personal.phone },
        { name: 'org', value: work.company },
        { name: 'location-input', value: locationStr },
        { name: 'urls[LinkedIn]', value: personal.linkedIn },
        { name: 'urls[GitHub]', value: personal.github },
        { name: 'urls[Portfolio]', value: personal.portfolio || personal.website },
        { name: 'urls[Other]', value: personal.twitter },
      ];

      const handledInputs = new Set();

      for (const mapping of leverFieldMap) {
        if (!mapping.value) continue;
        const input = document.querySelector(
          `input[name="${mapping.name}"], textarea[name="${mapping.name}"], select[name="${mapping.name}"]`
        );
        if (!input) continue;
        if (input.value && input.value.trim()) continue;
        if (input.disabled || input.readOnly) continue;

        const success = FormUtils ? FormUtils.fillInput(input, mapping.value) : fillField(input, mapping.value);
        if (success) {
          filledCount++;
          handledInputs.add(input);
          await new Promise(r => setTimeout(r, 50));
        }
      }

      console.log('JobTracker: Phase 1 (direct map) filled', filledCount, 'fields');

      // Phase 2: Custom Q&A matching against question labels
      if (customQA.length > 0) {
        const questionContainers = document.querySelectorAll('.application-question.custom-question');
        for (const container of questionContainers) {
          const labelEl = container.querySelector('.application-label .text') ||
                          container.querySelector('label, .application-label');
          if (!labelEl) continue;
          const questionText = labelEl.textContent.trim().toLowerCase();

          const input = container.querySelector('input:not([type="hidden"]):not([type="file"]), textarea, select');
          if (!input || handledInputs.has(input)) continue;
          if (input.value && input.value.trim()) continue;
          if (input.disabled || input.readOnly) continue;

          // Match against saved custom Q&A pairs
          const match = customQA.find(qa => {
            const q = (qa.question || '').toLowerCase();
            return q && (questionText.includes(q) || q.includes(questionText));
          });

          if (match && match.answer) {
            const success = FormUtils ? FormUtils.fillInput(input, match.answer) : fillField(input, match.answer);
            if (success) {
              filledCount++;
              handledInputs.add(input);
              await new Promise(r => setTimeout(r, 50));
            }
          }
        }
      }

      // Phase 3: Regex fallback for remaining inputs (custom fields, cover letters)
      const allInputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="file"]), textarea, select'
      );
      const coverLetterFields = [];

      for (const input of allInputs) {
        if (handledInputs.has(input)) continue;
        if (input.value && input.value.trim()) continue;
        if (input.disabled || input.readOnly) continue;

        const id = getFieldIdentifiers(input);

        // Detect cover letter fields
        if (/cover.?letter/i.test(id) && input.tagName.toLowerCase() === 'textarea') {
          coverLetterFields.push(input);
          continue;
        }

        const value = matchFieldValue(input, profile);
        if (value) {
          const success = FormUtils ? FormUtils.fillInput(input, value) : fillField(input, value);
          if (success) {
            filledCount++;
            handledInputs.add(input);
            await new Promise(r => setTimeout(r, 50));
          }
        }
      }

      // Phase 4: Handle cover letter fields
      for (const clField of coverLetterFields) {
        const filled = await handleCoverLetterField(clField, profile);
        if (filled) filledCount++;
      }

      console.log('JobTracker: Total filled', filledCount, 'fields');

      if (filledCount > 0) {
        window.JobTrackerContent?.showNotification(`Filled ${filledCount} fields!`, 'success');
      } else {
        console.log('JobTracker: No fields matched.');
        window.JobTrackerContent?.showNotification('No matching fields found', 'info');
      }
    } catch (error) {
      console.log('JobTracker: Lever autofill error:', error);
      window.JobTrackerContent?.showNotification('Autofill error - check console', 'error');
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
    if (/e?.?mail/i.test(id)) return personal.email;
    if (/phone|mobile|tel/i.test(id)) return personal.phone;

    // Links
    if (/linkedin/i.test(id)) return personal.linkedIn;
    if (/github/i.test(id)) return personal.github;
    if (/website|portfolio|homepage/i.test(id)) return personal.portfolio;
    if (/twitter|^x$/i.test(id)) return personal.twitter;

    // Address
    if (/city|location/i.test(id)) return personal.address?.city;
    if (/state|province|region/i.test(id)) return personal.address?.state;
    if (/country/i.test(id)) return personal.address?.country;
    if (/zip|postal/i.test(id)) return personal.address?.zipCode;
    if (/street|address/i.test(id)) return personal.address?.street;

    // Work
    if (/current.?company|employer|company.?name/i.test(id)) return work.company;
    if (/current.?title|job.?title|position|role/i.test(id)) return work.title;
    if (/years?.?(?:of)?.?experience/i.test(id)) return personal.yearsExperience;

    // Education
    if (/school|university|college|institution/i.test(id)) return edu.school;
    if (/degree|qualification/i.test(id)) return edu.degree;
    if (/major|field.?of.?study/i.test(id)) return edu.field;

    // Compensation
    if (/current.?ctc|current.?salary|present.?salary|ctc.?\(fixed\)|base.?salary/i.test(id)) {
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
    // Strategy 1: Lever-specific container (.application-question)
    const leverContainer = input.closest('.application-question');
    if (leverContainer) {
      const textDiv = leverContainer.querySelector('.application-label .text');
      if (textDiv) return textDiv.textContent;
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
      try {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) return label.textContent;
      } catch (e) {
        // CSS.escape may fail for certain input ids
        console.log('JobTracker: Label query failed for input', input.id, e.message);
      }
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

  // Fallback fill function when FormUtils not available
  function fillField(element, value) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'select') {
      const options = Array.from(element.options);
      const valueStr = String(value).toLowerCase();
      const matchedIndex = options.findIndex(opt =>
        opt.value.toLowerCase() === valueStr ||
        opt.textContent.toLowerCase().trim() === valueStr ||
        opt.value.toLowerCase().includes(valueStr) ||
        opt.textContent.toLowerCase().includes(valueStr)
      );
      if (matchedIndex !== -1) {
        element.selectedIndex = matchedIndex;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }

    const prototype = tagName === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }

    // Clear React tracker - set previous value to something different from new value
    try {
      if (element._valueTracker) {
        element._valueTracker.setValue(value ? '' : '_placeholder_');
      }
    } catch (e) {
      // React value tracker may not exist in all frameworks
      console.log('JobTracker: Failed to clear React value tracker', e.message);
    }

    // Dispatch keyboard events
    dispatchKeyboardEvents(element, value);

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function dispatchKeyboardEvents(element, value) {
    if (!value) return;
    const lastChar = value.charAt(value.length - 1);
    const keyCode = lastChar.charCodeAt(0);
    try {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, keyCode, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, keyCode, bubbles: true }));
    } catch (e) {
      // KeyboardEvent may fail in some browser contexts
      console.log('JobTracker: Failed to dispatch keyboard events', e.message);
    }
  }

  /**
   * Handle cover letter field with user selection
   */
  async function handleCoverLetterField(input, profile) {
    const coverLetters = profile.coverLetters || [];
    if (coverLetters.length === 0) return false;

    // If there's only one cover letter, fill it directly
    if (coverLetters.length === 1) {
      return fillCoverLetterField(input, coverLetters[0].content);
    }

    // Show picker for multiple cover letters
    return new Promise((resolve) => {
      if (window.JobTrackerCoverLetterPicker) {
        window.JobTrackerCoverLetterPicker.show(coverLetters, input)
          .then((selectedContent) => {
            if (selectedContent) {
              resolve(fillCoverLetterField(input, selectedContent));
            } else {
              resolve(false);
            }
          });
      } else {
        const event = new CustomEvent('jobtracker:show-cover-letter-picker', {
          detail: {
            coverLetters,
            targetInput: input,
            callback: (selectedContent) => {
              if (selectedContent) {
                resolve(fillCoverLetterField(input, selectedContent));
              } else {
                resolve(false);
              }
            }
          }
        });
        window.dispatchEvent(event);

        // Timeout fallback - use default if no picker responds
        setTimeout(() => {
          if (!input.value || !input.value.trim()) {
            const defaultCL = coverLetters.find(cl => cl.isDefault) || coverLetters[0];
            if (defaultCL) {
              resolve(fillCoverLetterField(input, defaultCL.content));
              return;
            }
          }
          resolve(false);
        }, 10000);
      }
    });
  }

  /**
   * Fill cover letter field with content
   */
  function fillCoverLetterField(input, content) {
    if (!input || !content) return false;

    const FormUtils = window.JobTrackerFormUtils;
    if (FormUtils) {
      return FormUtils.fillInput(input, content);
    } else {
      return fillField(input, content);
    }
  }

  console.log('JobTracker: Lever autofill module loaded');
})();
