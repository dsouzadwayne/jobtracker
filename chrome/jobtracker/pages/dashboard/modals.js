/**
 * Dashboard Modals Module
 * Application modal handling (add/edit applications)
 */

import {
  elements, MessageTypes,
  isFormDirty, setFormDirty, isSubmitting, setSubmitting
} from './state.js';
import {
  escapeHtml, formatDateInput, detectPlatform, validateFormData, showNotification,
  formatDateRelative
} from './utils.js';

// Resume linking state
let currentResumeData = {
  type: null,
  id: null,
  name: null
};

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
    document.getElementById('app-last-contacted').value = formatDateInput(app.lastContacted);
    document.getElementById('app-rejection-reason').value = app.rejectionReason || '';
    document.getElementById('app-company-notes').value = app.companyNotes || '';
    // Show rejection reason field if status is rejected
    toggleRejectionReasonField(app.status === 'rejected');
    // Resume linking - load from new structured format or legacy field
    if (app.resume && app.resume.type) {
      setResumeLink(app.resume.type, app.resume.id, app.resume.name);
    } else {
      clearResumeLink();
    }
  } else {
    document.getElementById('app-id').value = '';
    document.getElementById('app-date').value = new Date().toISOString().split('T')[0];
    // CRM Enhancement: Clear tags and deadline
    document.getElementById('app-tags').value = '';
    document.getElementById('app-deadline').value = '';
    // CRM Enhancement Phase 1: Clear new fields
    document.getElementById('app-priority').value = 'medium';
    document.getElementById('app-referred-by').value = '';
    document.getElementById('app-last-contacted').value = '';
    document.getElementById('app-rejection-reason').value = '';
    document.getElementById('app-company-notes').value = '';
    toggleRejectionReasonField(false);
    // Clear resume link
    clearResumeLink();
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
    lastContacted: lastContactedValue ? new Date(lastContactedValue).toISOString() : null,
    rejectionReason: status === 'rejected' ? (document.getElementById('app-rejection-reason')?.value || null) : null,
    companyNotes: document.getElementById('app-company-notes')?.value.trim() || '',
    // Resume linking - structured format
    resume: currentResumeData.type ? {
      type: currentResumeData.type,
      id: currentResumeData.id,
      name: currentResumeData.name
    } : null
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

// ==================== RESUME LINKING FUNCTIONS ====================

/**
 * Set the resume link in the form
 */
export function setResumeLink(type, id, name) {
  currentResumeData = { type, id, name };

  // Update hidden inputs
  document.getElementById('app-resume-type').value = type || '';
  document.getElementById('app-resume-id').value = id || '';
  document.getElementById('app-resume-name').value = name || '';

  // Update display
  const resumeCurrent = document.getElementById('resume-current');
  const clearBtn = document.getElementById('clear-resume-btn');

  if (type && id && name) {
    const typeLabel = type === 'generated' ? 'Generated' : 'Uploaded';
    resumeCurrent.innerHTML = `
      <div class="resume-linked">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span class="resume-linked-name">${escapeHtml(name)}</span>
        <span class="resume-linked-type">${typeLabel}</span>
      </div>
    `;
    clearBtn?.classList.remove('hidden');
  } else {
    resumeCurrent.innerHTML = '<span class="resume-none">No resume linked</span>';
    clearBtn?.classList.add('hidden');
  }

  setFormDirty(true);
}

/**
 * Clear the resume link
 */
export function clearResumeLink() {
  currentResumeData = { type: null, id: null, name: null };

  // Clear hidden inputs
  document.getElementById('app-resume-type').value = '';
  document.getElementById('app-resume-id').value = '';
  document.getElementById('app-resume-name').value = '';

  // Update display
  const resumeCurrent = document.getElementById('resume-current');
  const clearBtn = document.getElementById('clear-resume-btn');

  resumeCurrent.innerHTML = '<span class="resume-none">No resume linked</span>';
  clearBtn?.classList.add('hidden');
}

/**
 * Open the resume selection modal
 */
export async function openResumeSelectModal() {
  const modal = elements.resumeSelectModal;
  if (!modal) return;

  modal.classList.remove('hidden');

  // Load resumes
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageTypes.GET_ALL_RESUMES_FOR_LINKING
    });

    renderResumeList('generated', response.generated || []);
    renderResumeList('uploaded', response.uploaded || []);
  } catch (error) {
    console.error('Failed to load resumes:', error);
    showNotification('Failed to load resumes', 'error');
  }
}

/**
 * Close the resume selection modal
 */
export function closeResumeSelectModal() {
  const modal = elements.resumeSelectModal;
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Render a list of resumes in the selection modal
 */
function renderResumeList(type, resumes) {
  const listEl = type === 'generated'
    ? document.getElementById('generated-resumes-list')
    : document.getElementById('uploaded-resumes-list');
  const emptyEl = type === 'generated'
    ? document.getElementById('generated-resumes-empty')
    : document.getElementById('uploaded-resumes-empty');

  if (!listEl || !emptyEl) return;

  if (!resumes || resumes.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  listEl.innerHTML = resumes.map(resume => {
    const name = resume.name || 'Untitled Resume';
    const subtitle = type === 'generated'
      ? (resume.subtitle || 'No job description')
      : formatFileSize(resume.size);
    const dateStr = formatDateRelative(resume.createdAt || resume.uploadedAt);

    return `
      <div class="resume-list-item" data-type="${type}" data-id="${escapeHtml(resume.id)}" data-name="${escapeHtml(name)}">
        <div class="resume-list-item-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="resume-list-item-info">
          <div class="resume-list-item-name">${escapeHtml(name)}</div>
          <div class="resume-list-item-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <div class="resume-list-item-meta">${dateStr}</div>
      </div>
    `;
  }).join('');

  // Add click handlers
  listEl.querySelectorAll('.resume-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const resumeType = item.dataset.type;
      const resumeId = item.dataset.id;
      const resumeName = item.dataset.name;
      handleResumeSelection(resumeType, resumeId, resumeName);
    });
  });
}

/**
 * Handle resume selection from modal
 */
function handleResumeSelection(type, id, name) {
  setResumeLink(type, id, name);
  closeResumeSelectModal();
}

/**
 * Handle resume file upload
 */
export async function handleResumeUpload(file) {
  if (!file) return;

  // Validate file type
  if (file.type !== 'application/pdf') {
    showNotification('Please select a PDF file', 'error');
    return;
  }

  // Validate file is not empty
  if (file.size === 0) {
    showNotification('File cannot be empty', 'error');
    return;
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    showNotification('File size must be less than 10MB', 'error');
    return;
  }

  try {
    // Read file as base64 string for message passing
    // ArrayBuffer cannot be serialized through Chrome extension messaging
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Result is "data:application/pdf;base64,<BASE64_DATA>"
        const dataUrl = reader.result;
        const parts = dataUrl.split(',');
        if (parts.length < 2 || !parts[1]) {
          reject(new Error('Invalid file format'));
          return;
        }
        const base64 = parts[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const response = await chrome.runtime.sendMessage({
      type: MessageTypes.UPLOAD_RESUME,
      payload: {
        name: file.name,
        type: file.type,
        data: base64Data,  // Now a string that serializes correctly
        size: file.size
      }
    });

    if (response.success) {
      setResumeLink('uploaded', response.resume.id, response.resume.name);
      showNotification('Resume uploaded and linked', 'success');
    } else {
      throw new Error(response.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Resume upload failed:', error);
    showNotification('Failed to upload resume', 'error');
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Setup resume selector event listeners
 */
export function setupResumeSelectListeners() {
  // Select resume button
  elements.selectResumeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openResumeSelectModal();
  });

  // Upload resume button
  elements.uploadResumeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    elements.resumeFileUpload?.click();
  });

  // File input change
  elements.resumeFileUpload?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleResumeUpload(file);
      e.target.value = ''; // Reset input
    }
  });

  // Clear resume button
  elements.clearResumeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    clearResumeLink();
    setFormDirty(true);
  });

  // Close modal button
  elements.closeResumeSelectModal?.addEventListener('click', closeResumeSelectModal);

  // Close on backdrop click
  elements.resumeSelectModal?.addEventListener('click', (e) => {
    if (e.target === elements.resumeSelectModal) {
      closeResumeSelectModal();
    }
  });

  // Tab switching
  const tabs = document.querySelectorAll('.resume-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.resumeTab;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show corresponding panel
      document.querySelectorAll('.resume-tab-panel').forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('active');
      });

      const panel = document.getElementById(`resume-tab-${tabName}`);
      if (panel) {
        panel.classList.remove('hidden');
        panel.classList.add('active');
      }
    });
  });
}
