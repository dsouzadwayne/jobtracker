/**
 * Dashboard Modals Module
 * Application modal handling (add/edit applications)
 */

import {
  elements, MessageTypes,
  isFormDirty, setFormDirty, isSubmitting, setSubmitting
} from './state.js';
import {
  escapeHtml, formatDateInput, detectPlatform, validateFormData, showNotification
} from './utils.js';

// Store previously focused element for focus restoration
let previouslyFocusedElement = null;
let focusTrapHandler = null;

// References to external functions (set during initialization)
let loadApplicationsCallback = null;
let loadTagsCallback = null;
let updateStatsCallback = null;

// Toggle rejection reason field visibility
function toggleRejectionReasonField(show) {
  const rejectionGroup = document.getElementById('rejection-reason-group');
  if (rejectionGroup) {
    rejectionGroup.classList.toggle('hidden', !show);
  }
}

export function setModalCallbacks(callbacks) {
  loadApplicationsCallback = callbacks.loadApplications;
  loadTagsCallback = callbacks.loadTags;
  updateStatsCallback = callbacks.updateStats;
}

// Focus trap function for modals
function trapFocus(modal) {
  const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    '[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])'
  ].join(', ');

  const focusableElements = modal.querySelectorAll(focusableSelectors);

  // Filter to only visible elements
  const focusableArray = Array.from(focusableElements).filter(el => {
    // Check if element is visible
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    // Check if element or parent has display: none or visibility: hidden
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // Check if element is in a hidden parent
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  });

  if (focusableArray.length === 0) return;

  const firstFocusable = focusableArray[0];
  const lastFocusable = focusableArray[focusableArray.length - 1];

  // Remove old handler if exists
  if (focusTrapHandler) {
    modal.removeEventListener('keydown', focusTrapHandler);
  }

  focusTrapHandler = (e) => {
    if (e.key !== 'Tab') return;

    // Re-calculate focusable elements in case of dynamic changes
    const currentFocusable = Array.from(modal.querySelectorAll(focusableSelectors)).filter(el => {
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (currentFocusable.length === 0) return;

    const first = currentFocusable[0];
    const last = currentFocusable[currentFocusable.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  modal.addEventListener('keydown', focusTrapHandler);
}

// Show form error message
export function showFormError(message) {
  let errorEl = document.getElementById('form-error-message');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'form-error-message';
    errorEl.className = 'form-error-message';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    const formActions = document.querySelector('.form-actions');
    if (formActions) {
      formActions.parentNode.insertBefore(errorEl, formActions);
    }
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

// Hide form error message
export function hideFormError() {
  const errorEl = document.getElementById('form-error-message');
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
}

// Set form submitting state (loading indicator)
function setSubmitState(submitting) {
  setSubmitting(submitting);
  const submitBtn = elements.appForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = submitting;
    submitBtn.innerHTML = submitting
      ? '<span class="spinner"></span> Saving...'
      : 'Save';
  }
}

// Open modal
export function openModal(app = null) {
  // Store the currently focused element for restoration
  previouslyFocusedElement = document.activeElement;

  // Reset form state
  setFormDirty(false);
  hideFormError();

  elements.modalTitle.textContent = app ? 'Edit Application' : 'Add Application';
  elements.appForm.reset();
  elements.deleteBtn.classList.toggle('hidden', !app);

  if (app) {
    document.getElementById('app-id').value = app.id;
    document.getElementById('app-company').value = app.company || '';
    document.getElementById('app-position').value = app.position || '';
    document.getElementById('app-url').value = app.jobUrl || '';
    document.getElementById('app-status').value = app.status || 'applied';
    document.getElementById('app-date').value = formatDateInput(app.dateApplied);
    document.getElementById('app-location').value = app.location || '';
    document.getElementById('app-salary').value = app.salary || '';
    document.getElementById('app-type').value = app.jobType || '';
    document.getElementById('app-remote').value = app.remote || '';
    document.getElementById('app-description').value = app.jobDescription || '';
    document.getElementById('app-notes').value = app.notes || '';
    // CRM Enhancement: Tags and Deadline
    document.getElementById('app-tags').value = (app.tags || []).join(', ');
    document.getElementById('app-deadline').value = formatDateInput(app.deadline);
    // CRM Enhancement Phase 1: New fields
    document.getElementById('app-priority').value = app.priority || 'medium';
    document.getElementById('app-referred-by').value = app.referredBy || '';
    document.getElementById('app-resume-version').value = app.resumeVersion || '';
    document.getElementById('app-last-contacted').value = formatDateInput(app.lastContacted);
    document.getElementById('app-rejection-reason').value = app.rejectionReason || '';
    document.getElementById('app-company-notes').value = app.companyNotes || '';
    // Show rejection reason field if status is rejected
    toggleRejectionReasonField(app.status === 'rejected');
  } else {
    document.getElementById('app-id').value = '';
    document.getElementById('app-date').value = new Date().toISOString().split('T')[0];
    // CRM Enhancement: Clear tags and deadline
    document.getElementById('app-tags').value = '';
    document.getElementById('app-deadline').value = '';
    // CRM Enhancement Phase 1: Clear new fields
    document.getElementById('app-priority').value = 'medium';
    document.getElementById('app-referred-by').value = '';
    document.getElementById('app-resume-version').value = '';
    document.getElementById('app-last-contacted').value = '';
    document.getElementById('app-rejection-reason').value = '';
    document.getElementById('app-company-notes').value = '';
    toggleRejectionReasonField(false);
  }

  elements.modal.classList.remove('hidden');

  // Set up focus trap and focus first input
  trapFocus(elements.modal);
  document.getElementById('app-company').focus();
}

// Close modal with confirmation if form is dirty
export function closeModalWithConfirm() {
  if (isFormDirty() && !isSubmitting()) {
    if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
  }
  closeModal();
}

// Close modal (force close without confirmation)
export function closeModal() {
  elements.modal.classList.add('hidden');
  setFormDirty(false);
  hideFormError();

  // Remove focus trap handler
  if (focusTrapHandler) {
    elements.modal.removeEventListener('keydown', focusTrapHandler);
    focusTrapHandler = null;
  }

  // Restore focus to previously focused element
  if (previouslyFocusedElement && previouslyFocusedElement.focus) {
    previouslyFocusedElement.focus();
    previouslyFocusedElement = null;
  }
}

// Handle form submit
export async function handleSubmit(e) {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting()) return;

  hideFormError();

  const id = document.getElementById('app-id').value;
  // CRM Enhancement: Parse tags from comma-separated input
  const tagsInput = document.getElementById('app-tags')?.value || '';
  const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

  const status = document.getElementById('app-status').value;
  const lastContactedValue = document.getElementById('app-last-contacted')?.value;

  const appData = {
    company: document.getElementById('app-company').value.trim(),
    position: document.getElementById('app-position').value.trim(),
    jobUrl: document.getElementById('app-url').value.trim(),
    status: status,
    dateApplied: document.getElementById('app-date').value
      ? new Date(document.getElementById('app-date').value).toISOString()
      : new Date().toISOString(),
    location: document.getElementById('app-location').value.trim(),
    salary: document.getElementById('app-salary').value.trim(),
    jobType: document.getElementById('app-type').value,
    remote: document.getElementById('app-remote').value,
    jobDescription: document.getElementById('app-description').value.trim(),
    notes: document.getElementById('app-notes').value.trim(),
    platform: detectPlatform(document.getElementById('app-url').value),
    // CRM Enhancement: Tags and Deadline
    tags: tags,
    deadline: document.getElementById('app-deadline')?.value || null,
    deadlineAlert: true,
    // CRM Enhancement Phase 1: New fields
    priority: document.getElementById('app-priority')?.value || 'medium',
    referredBy: document.getElementById('app-referred-by')?.value.trim() || '',
    resumeVersion: document.getElementById('app-resume-version')?.value.trim() || '',
    lastContacted: lastContactedValue ? new Date(lastContactedValue).toISOString() : null,
    rejectionReason: status === 'rejected' ? (document.getElementById('app-rejection-reason')?.value || null) : null,
    companyNotes: document.getElementById('app-company-notes')?.value.trim() || ''
  };

  // Validate form data
  const validationErrors = validateFormData(appData);
  if (validationErrors.length > 0) {
    showFormError(validationErrors.join('. '));
    return;
  }

  // Set loading state
  setSubmitState(true);

  try {
    if (id) {
      await chrome.runtime.sendMessage({
        type: MessageTypes.UPDATE_APPLICATION,
        payload: { id, ...appData }
      });
    } else {
      await chrome.runtime.sendMessage({
        type: MessageTypes.ADD_APPLICATION,
        payload: appData
      });
    }

    setFormDirty(false);
    closeModal();
    await loadApplicationsCallback?.();
    await loadTagsCallback?.(); // CRM Enhancement: Reload tags
    await updateStatsCallback?.();
  } catch (error) {
    console.log('Error saving application:', error);
    // Keep modal open and show specific error
    showFormError('Failed to save application. Please check your connection and try again.');
  } finally {
    setSubmitState(false);
  }
}

// Handle delete from modal
export async function handleDelete(deleteApplicationCallback) {
  const id = document.getElementById('app-id').value;
  if (!id) return;
  await deleteApplicationCallback(id);
  closeModal();
}

// Setup modal event listeners
export function setupModalListeners(deleteApplicationCallback) {
  elements.closeModal?.addEventListener('click', () => closeModalWithConfirm());
  elements.cancelBtn?.addEventListener('click', () => closeModalWithConfirm());
  elements.deleteBtn?.addEventListener('click', () => handleDelete(deleteApplicationCallback));
  elements.appForm?.addEventListener('submit', handleSubmit);
  elements.modal?.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModalWithConfirm();
  });

  // Track form changes for dirty state
  elements.appForm?.addEventListener('input', () => {
    setFormDirty(true);
  });

  // CRM Enhancement Phase 1: Show/hide rejection reason based on status
  const statusSelect = document.getElementById('app-status');
  statusSelect?.addEventListener('change', (e) => {
    toggleRejectionReasonField(e.target.value === 'rejected');
  });

  // AI tag suggestions - trigger when job description changes
  const descriptionField = document.getElementById('app-description');
  const tagsField = document.getElementById('app-tags');

  if (descriptionField && tagsField) {
    let suggestionTimeout = null;

    descriptionField.addEventListener('input', () => {
      // Debounce the suggestion request
      clearTimeout(suggestionTimeout);
      suggestionTimeout = setTimeout(async () => {
        const text = descriptionField.value;
        if (text.length < 100) return; // Need enough text to analyze

        // Get or create suggestion container
        let suggestionsContainer = document.getElementById('ai-tag-suggestions');
        if (!suggestionsContainer) {
          suggestionsContainer = document.createElement('div');
          suggestionsContainer.id = 'ai-tag-suggestions';
          suggestionsContainer.className = 'suggested-tags-container';
          // Insert after tags field
          tagsField.parentNode.insertBefore(suggestionsContainer, tagsField.nextSibling);
        }

        // Use global function if available
        if (typeof window.renderTagSuggestions === 'function') {
          await window.renderTagSuggestions(suggestionsContainer, text, (tag) => {
            // Add tag to existing tags
            const currentTags = tagsField.value.trim();
            if (currentTags) {
              tagsField.value = `${currentTags}, ${tag}`;
            } else {
              tagsField.value = tag;
            }
            setFormDirty(true);
          });
        }
      }, 1000); // Wait 1 second after typing stops
    });
  }
}
