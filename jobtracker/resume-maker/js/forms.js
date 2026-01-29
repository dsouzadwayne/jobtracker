/**
 * Resume Maker - Form Handling
 * Manages all form interactions and item CRUD
 * Includes Zod-powered validation
 */

import {
  getBaseResume,
  getCurrentResume,
  updateProfile,
  addSectionItem,
  updateSectionItem,
  removeSectionItem,
  addSkill,
  removeSkill,
  setSectionTitle,
  subscribe,
  updateResumeMeta
} from './state.js';
import { escapeHtml, formatDateRange, showToast, debounce } from './utils.js';

// ==================== ZOD VALIDATION SCHEMAS ====================

// Check if Zod/JobTrackerValidation is available
const zodAvailable = typeof window.Zod !== 'undefined';
const z = zodAvailable ? window.Zod : null;

// Create validation schemas if Zod is available
let resumeSchemas = null;

if (z) {
  // Profile section schema
  const ProfileSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    headline: z.string().max(150, 'Headline is too long').optional().or(z.literal('')),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    phone: z.string().max(30, 'Phone number is too long').optional().or(z.literal('')),
    location: z.string().max(100, 'Location is too long').optional().or(z.literal('')),
    website: z.string().url('Invalid URL format').optional().or(z.literal('')),
    summary: z.string().max(2000, 'Summary is too long').optional().or(z.literal(''))
  });

  // Experience item schema
  const ExperienceSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, 'Job title is required').max(100, 'Title is too long'),
    company: z.string().min(1, 'Company is required').max(100, 'Company name is too long'),
    location: z.string().max(100, 'Location is too long').optional().or(z.literal('')),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional().or(z.literal('')),
    current: z.boolean().optional(),
    description: z.string().max(5000, 'Description is too long').optional().or(z.literal(''))
  });

  // Education item schema
  const EducationSchema = z.object({
    id: z.string().optional(),
    degree: z.string().min(1, 'Degree is required').max(150, 'Degree is too long'),
    school: z.string().min(1, 'School is required').max(150, 'School name is too long'),
    location: z.string().max(100, 'Location is too long').optional().or(z.literal('')),
    startDate: z.string().optional().or(z.literal('')),
    endDate: z.string().optional().or(z.literal('')),
    gpa: z.string().max(20, 'GPA is too long').optional().or(z.literal('')),
    description: z.string().max(2000, 'Description is too long').optional().or(z.literal(''))
  });

  // Project item schema
  const ProjectSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
    url: z.string().url('Invalid URL format').optional().or(z.literal('')),
    technologies: z.string().max(200, 'Technologies list is too long').optional().or(z.literal('')),
    startDate: z.string().optional().or(z.literal('')),
    endDate: z.string().optional().or(z.literal('')),
    description: z.string().max(3000, 'Description is too long').optional().or(z.literal(''))
  });

  // Custom/Certification item schema
  const CustomItemSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, 'Title is required').max(150, 'Title is too long'),
    issuer: z.string().max(100, 'Issuer name is too long').optional().or(z.literal('')),
    date: z.string().optional().or(z.literal('')),
    url: z.string().max(500, 'URL/ID is too long').optional().or(z.literal('')),
    description: z.string().max(1000, 'Description is too long').optional().or(z.literal(''))
  });

  // Skill schema (simple string validation)
  const SkillSchema = z.string().min(1, 'Skill cannot be empty').max(50, 'Skill name is too long');

  resumeSchemas = {
    profile: ProfileSchema,
    experience: ExperienceSchema,
    education: EducationSchema,
    projects: ProjectSchema,
    custom: CustomItemSchema,
    skill: SkillSchema
  };
}

/**
 * Validate data against a schema
 * @param {string} schemaName - Name of the schema
 * @param {any} data - Data to validate
 * @returns {{ success: boolean, data?: any, errors?: Array<{ path: string, message: string }> }}
 */
export function validateFormData(schemaName, data) {
  if (!zodAvailable || !resumeSchemas || !resumeSchemas[schemaName]) {
    // No validation available, return success
    console.log('[Forms] Validation skipped - Zod not available');
    return { success: true, data };
  }

  const schema = resumeSchemas[schemaName];
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message
  }));

  return { success: false, errors };
}

/**
 * Show validation errors in form
 * @param {HTMLFormElement} form - Form element
 * @param {Array<{ path: string, message: string }>} errors - Validation errors
 */
function showValidationErrors(form, errors) {
  // Clear previous errors
  form.querySelectorAll('.form-error').forEach(el => el.remove());
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  // Show new errors
  errors.forEach(error => {
    const fieldName = error.path || 'general';
    const input = form.querySelector(`[name="${fieldName}"]`);

    if (input) {
      input.classList.add('input-error');

      const errorEl = document.createElement('span');
      errorEl.className = 'form-error';
      errorEl.textContent = error.message;
      input.parentNode.appendChild(errorEl);
    } else {
      // Show general error via toast
      showToast(error.message, 'error');
    }
  });
}

/**
 * Clear validation errors from form
 */
function clearValidationErrors(form) {
  form.querySelectorAll('.form-error').forEach(el => el.remove());
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

/**
 * Check if validation is available
 */
export function isValidationAvailable() {
  return zodAvailable && resumeSchemas !== null;
}

// Current edit context
let editContext = {
  section: null,
  itemId: null,
  isNew: true
};

// Submission lock to prevent double-submission
let isSubmitting = false;

// Form field definitions for each section
const SECTION_FIELDS = {
  experience: [
    { name: 'title', label: 'Job Title', type: 'text', required: true, placeholder: 'Software Engineer' },
    { name: 'company', label: 'Company', type: 'text', required: true, placeholder: 'Acme Corp' },
    { name: 'location', label: 'Location', type: 'text', placeholder: 'San Francisco, CA' },
    { name: 'startDate', label: 'Start Date', type: 'month', required: true },
    { name: 'endDate', label: 'End Date', type: 'month', placeholder: 'Leave empty if current' },
    { name: 'current', label: 'I currently work here', type: 'checkbox' },
    { name: 'description', label: 'Description', type: 'textarea', rows: 6, placeholder: 'Describe your responsibilities and achievements...\n• Led team of 5 engineers\n• Improved system performance by 40%' }
  ],
  education: [
    { name: 'degree', label: 'Degree', type: 'text', required: true, placeholder: 'Bachelor of Science in Computer Science' },
    { name: 'school', label: 'School', type: 'text', required: true, placeholder: 'University of California' },
    { name: 'location', label: 'Location', type: 'text', placeholder: 'Berkeley, CA' },
    { name: 'startDate', label: 'Start Date', type: 'month' },
    { name: 'endDate', label: 'End Date', type: 'month' },
    { name: 'gpa', label: 'GPA (optional)', type: 'text', placeholder: '3.8/4.0' },
    { name: 'description', label: 'Additional Info', type: 'textarea', rows: 3, placeholder: 'Relevant coursework, honors, activities...' }
  ],
  projects: [
    { name: 'name', label: 'Project Name', type: 'text', required: true, placeholder: 'E-commerce Platform' },
    { name: 'url', label: 'Project URL', type: 'url', placeholder: 'https://github.com/user/project' },
    { name: 'technologies', label: 'Technologies', type: 'text', placeholder: 'React, Node.js, PostgreSQL' },
    { name: 'startDate', label: 'Start Date', type: 'month' },
    { name: 'endDate', label: 'End Date', type: 'month' },
    { name: 'description', label: 'Description', type: 'textarea', rows: 4, placeholder: 'Describe the project, your role, and key achievements...' }
  ],
  custom: [
    { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'AWS Solutions Architect' },
    { name: 'issuer', label: 'Issuer / Organization', type: 'text', placeholder: 'Amazon Web Services' },
    { name: 'date', label: 'Date', type: 'month' },
    { name: 'url', label: 'URL / Credential ID', type: 'text', placeholder: 'Credential URL or ID' },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'Additional details...' }
  ]
};

/**
 * Initialize forms
 */
export function initForms() {
  // Resume details form (name & subtitle)
  initResumeDetailsForm();

  // Profile form auto-save
  initProfileForm();

  // Accordion toggles
  initAccordions();

  // Add item buttons
  initAddItemButtons();

  // Skills input
  initSkillsInput();

  // Custom section title
  initCustomSectionTitle();

  // Item modal
  initItemModal();

  // Subscribe to state changes with debounce to avoid excessive re-renders during auto-save
  const debouncedUpdateCounts = debounce(updateAllCounts, 100);
  subscribe('baseResume', debouncedUpdateCounts);
}

/**
 * Initialize resume details form (name & custom subtitle)
 */
function initResumeDetailsForm() {
  const form = document.getElementById('resume-details-form');
  if (!form) return;

  const nameInput = document.getElementById('resume-details-name');
  const subtitleInput = document.getElementById('resume-details-subtitle');

  // Create debounced handlers
  const debouncedNameUpdate = debounce((value) => {
    updateResumeMeta('name', value);
  }, 300);

  const debouncedSubtitleUpdate = debounce((value) => {
    updateResumeMeta('customSubtitle', value);
  }, 300);

  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      debouncedNameUpdate(e.target.value);
    });
  }

  if (subtitleInput) {
    subtitleInput.addEventListener('input', (e) => {
      debouncedSubtitleUpdate(e.target.value);
    });
  }
}

/**
 * Load resume details into form
 * @param {Object} resume - The resume object with name and customSubtitle
 */
export function loadResumeDetailsForm(resume) {
  const nameInput = document.getElementById('resume-details-name');
  const subtitleInput = document.getElementById('resume-details-subtitle');

  // Clear fields first
  if (nameInput) nameInput.value = '';
  if (subtitleInput) subtitleInput.value = '';

  if (!resume) return;

  // Populate with resume data
  if (nameInput && resume.name) {
    nameInput.value = resume.name;
  }
  if (subtitleInput && resume.customSubtitle) {
    subtitleInput.value = resume.customSubtitle;
  }
}

/**
 * Initialize profile form with auto-save (Bug #21 - debounced input)
 */
function initProfileForm() {
  const form = document.getElementById('profile-form');
  if (!form) return;

  // Create debounced update function to reduce save frequency (Bug #21)
  // Each field gets its own debounced handler to prevent cross-field delays
  const createDebouncedHandler = (fieldName) => {
    return debounce((value) => {
      updateProfile(fieldName, value);
    }, 300); // 300ms debounce per field
  };

  // Add input listeners for auto-save with debounce
  form.querySelectorAll('input, textarea').forEach(input => {
    const debouncedUpdate = createDebouncedHandler(input.name);

    input.addEventListener('input', (e) => {
      debouncedUpdate(e.target.value);
    });
  });
}

/**
 * Load profile data into form
 * CRITICAL: Clears ALL fields first to prevent data from previous resume persisting
 */
export function loadProfileForm(profile) {
  const fields = ['name', 'headline', 'email', 'phone', 'location', 'website', 'summary'];

  // CRITICAL: Clear ALL fields first to prevent stale data
  fields.forEach(field => {
    const input = document.getElementById(`profile-${field}`);
    if (input) {
      input.value = '';  // Clear first
    }
  });

  // Then populate with new data
  if (!profile) return;

  fields.forEach(field => {
    const input = document.getElementById(`profile-${field}`);
    if (input && profile[field]) {
      input.value = profile[field];
    }
  });
}

/**
 * Initialize accordion functionality
 */
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const isActive = header.classList.contains('active');

      // Toggle this accordion
      header.classList.toggle('active');
      const content = header.nextElementSibling;
      content.classList.toggle('open');
    });
  });
}

/**
 * Initialize add item buttons
 */
function initAddItemButtons() {
  document.querySelectorAll('.add-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      openItemModal(section, null);
    });
  });
}

/**
 * Initialize skills input
 */
function initSkillsInput() {
  const input = document.getElementById('skill-input');
  const addBtn = document.getElementById('add-skill-btn');

  if (!input || !addBtn) return;

  const handleAddSkill = () => {
    const skill = input.value.trim();
    if (skill) {
      // Validate skill
      const validation = validateFormData('skill', skill);
      if (!validation.success) {
        showToast(validation.errors[0]?.message || 'Invalid skill', 'error');
        return;
      }

      addSkill(validation.data);
      input.value = '';
      renderSkills();
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  });

  addBtn.addEventListener('click', handleAddSkill);
}

/**
 * Initialize custom section title input
 */
function initCustomSectionTitle() {
  const input = document.getElementById('custom-title');
  if (!input) return;

  input.addEventListener('input', (e) => {
    setSectionTitle('custom', e.target.value);
  });
}

/**
 * Initialize item modal
 */
function initItemModal() {
  const modal = document.getElementById('item-modal');
  const form = document.getElementById('item-form');
  const closeBtn = document.getElementById('close-item-modal');
  const cancelBtn = document.getElementById('cancel-item-btn');

  if (!modal || !form) return;

  // Close modal handlers
  [closeBtn, cancelBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => closeItemModal());
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeItemModal();
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveItem();
  });
}

/**
 * Open item modal for add/edit
 */
export function openItemModal(section, itemId = null) {
  const modal = document.getElementById('item-modal');
  const title = document.getElementById('item-modal-title');
  const fieldsContainer = document.getElementById('item-form-fields');

  if (!modal || !fieldsContainer) return;

  // Set edit context
  editContext = {
    section,
    itemId,
    isNew: !itemId
  };

  // Get existing item data if editing
  let existingData = {};
  if (itemId) {
    const baseResume = getBaseResume();
    const item = baseResume?.[section]?.items?.find(i => i.id === itemId);
    if (item) {
      existingData = { ...item };
    }
  }

  // Update modal title
  const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
  title.textContent = itemId ? `Edit ${sectionName}` : `Add ${sectionName}`;

  // Generate form fields
  const fields = SECTION_FIELDS[section] || [];
  fieldsContainer.innerHTML = fields.map(field => generateFieldHtml(field, existingData[field.name])).join('');

  // Handle "current" checkbox for experience
  if (section === 'experience') {
    const currentCheckbox = fieldsContainer.querySelector('[name="current"]');
    const endDateInput = fieldsContainer.querySelector('[name="endDate"]');

    if (currentCheckbox && endDateInput) {
      currentCheckbox.addEventListener('change', (e) => {
        endDateInput.disabled = e.target.checked;
        if (e.target.checked) {
          endDateInput.value = '';
        }
      });

      // Set initial state
      if (existingData.current) {
        currentCheckbox.checked = true;
        endDateInput.disabled = true;
      }
    }
  }

  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Close item modal
 */
function closeItemModal() {
  const modal = document.getElementById('item-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  editContext = { section: null, itemId: null, isNew: true };
}

/**
 * Normalize a date value to yyyy-MM format for month inputs
 * Handles various formats: "2022", "2022-01", "January 2022", etc.
 */
function normalizeMonthValue(value) {
  if (!value) return '';

  const strValue = String(value).trim();

  // Already in yyyy-MM format
  if (/^\d{4}-\d{2}$/.test(strValue)) {
    return strValue;
  }

  // Year only (e.g., "2022") - default to January
  if (/^\d{4}$/.test(strValue)) {
    return `${strValue}-01`;
  }

  // Try to parse other formats
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Return empty if we can't parse it
  return '';
}

/**
 * Generate HTML for a form field
 */
function generateFieldHtml(field, value = '') {
  const id = `item-${field.name}`;
  const required = field.required ? 'required' : '';
  const escapedValue = escapeHtml(value || '');

  let inputHtml;

  switch (field.type) {
    case 'textarea':
      inputHtml = `<textarea id="${id}" name="${field.name}" rows="${field.rows || 4}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>${escapedValue}</textarea>`;
      break;

    case 'checkbox':
      inputHtml = `
        <label class="checkbox-label">
          <input type="checkbox" id="${id}" name="${field.name}" ${value ? 'checked' : ''}>
          <span>${escapeHtml(field.label)}</span>
        </label>
      `;
      return `<div class="form-group form-group-checkbox">${inputHtml}</div>`;

    case 'month':
      // Normalize month value to yyyy-MM format
      const monthValue = escapeHtml(normalizeMonthValue(value));
      inputHtml = `<input type="month" id="${id}" name="${field.name}" value="${monthValue}" ${required}>`;
      break;

    default:
      inputHtml = `<input type="${field.type}" id="${id}" name="${field.name}" value="${escapedValue}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>`;
  }

  return `
    <div class="form-group">
      <label for="${id}">${escapeHtml(field.label)}</label>
      ${inputHtml}
    </div>
  `;
}

/**
 * Save item from modal form
 */
function saveItem() {
  // Prevent double-submission
  if (isSubmitting) return;

  const form = document.getElementById('item-form');
  if (!form) return;

  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData) {
    data[key] = value;
  }

  // Handle checkbox (FormData doesn't include unchecked checkboxes)
  const currentCheckbox = form.querySelector('[name="current"]');
  if (currentCheckbox) {
    data.current = currentCheckbox.checked;
  }

  // Validate data before saving
  const validation = validateFormData(editContext.section, data);
  if (!validation.success) {
    showValidationErrors(form, validation.errors);
    return;
  }

  // Clear any previous errors
  clearValidationErrors(form);

  // Set submission lock
  isSubmitting = true;

  try {
    // Add or update item
    if (editContext.isNew) {
      addSectionItem(editContext.section, validation.data);
    } else {
      updateSectionItem(editContext.section, editContext.itemId, validation.data);
    }

    // Render section and close modal
    renderSection(editContext.section);
    closeItemModal();
  } finally {
    // Release submission lock
    isSubmitting = false;
  }
}

// Track which section lists have been initialized with event delegation
const initializedSectionLists = new Set();

/**
 * Set up event delegation for a section list (called once per section)
 */
function initSectionListDelegation(section) {
  const list = document.getElementById(`${section}-list`);
  if (!list || initializedSectionLists.has(section)) return;

  initializedSectionLists.add(section);

  // Use event delegation - single listener handles all clicks
  list.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-item-btn');
    const deleteBtn = e.target.closest('.delete-item-btn');

    if (editBtn) {
      e.stopPropagation();
      openItemModal(section, editBtn.dataset.id);
    } else if (deleteBtn) {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this item?')) {
        removeSectionItem(section, deleteBtn.dataset.id);
        renderSection(section);
      }
    }
  });
}

/**
 * Render a section's items
 */
export function renderSection(section) {
  const list = document.getElementById(`${section}-list`);
  if (!list) return;

  // Initialize event delegation once for this section
  initSectionListDelegation(section);

  const resume = getCurrentResume();
  const items = resume?.[section]?.items || [];

  if (items.length === 0) {
    list.innerHTML = '<p class="text-muted text-sm">No items added yet.</p>';
    updateItemCount(section, 0);
    return;
  }

  list.innerHTML = items.map(item => renderItemCard(section, item)).join('');

  updateItemCount(section, items.length);
}

/**
 * Render a single item card
 */
function renderItemCard(section, item) {
  let title = '';
  let subtitle = '';
  let date = '';
  let description = item.description || '';

  switch (section) {
    case 'experience':
      title = item.title || 'Untitled Position';
      subtitle = item.company || '';
      date = formatDateRange(item.startDate, item.current ? 'Present' : item.endDate);
      break;

    case 'education':
      title = item.degree || 'Untitled Degree';
      subtitle = item.school || '';
      date = formatDateRange(item.startDate, item.endDate);
      break;

    case 'projects':
      title = item.name || 'Untitled Project';
      subtitle = item.technologies || '';
      date = formatDateRange(item.startDate, item.endDate);
      break;

    case 'custom':
      title = item.title || 'Untitled';
      subtitle = item.issuer || '';
      date = item.date ? formatDateRange(item.date, null) : '';
      break;
  }

  return `
    <div class="item-card" data-id="${escapeHtml(item.id)}">
      <div class="item-drag-handle" title="Drag to reorder">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="16" y2="6"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
          <line x1="8" y1="18" x2="16" y2="18"></line>
        </svg>
      </div>
      <div class="item-content">
        <div class="item-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="item-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        ${date ? `<div class="item-date">${escapeHtml(date)}</div>` : ''}
        ${description ? `<div class="item-description">${escapeHtml(description).substring(0, 150)}${description.length > 150 ? '...' : ''}</div>` : ''}
      </div>
      <div class="item-actions">
        <button type="button" class="icon-btn edit-item-btn" data-id="${escapeHtml(item.id)}" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button type="button" class="icon-btn delete-item-btn delete-btn" data-id="${escapeHtml(item.id)}" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// Track if skills list has been initialized with event delegation
let skillsListInitialized = false;

/**
 * Set up event delegation for skills list (called once)
 */
function initSkillsListDelegation() {
  const container = document.getElementById('skills-list');
  if (!container || skillsListInitialized) return;

  skillsListInitialized = true;

  // Use event delegation - single listener handles all remove button clicks
  container.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-skill');
    if (removeBtn) {
      e.stopPropagation();
      removeSkill(removeBtn.dataset.skill);
      renderSkills();
    }
  });
}

/**
 * Render skills section
 */
export function renderSkills() {
  const container = document.getElementById('skills-list');
  if (!container) return;

  // Initialize event delegation once
  initSkillsListDelegation();

  const resume = getCurrentResume();
  const skills = resume?.skills?.items || [];

  if (skills.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">No skills added yet.</p>';
    updateItemCount('skills', 0);
    return;
  }

  container.innerHTML = skills.map(skill => `
    <span class="skill-tag">
      ${escapeHtml(skill)}
      <button type="button" class="remove-skill" data-skill="${escapeHtml(skill)}" title="Remove skill">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </span>
  `).join('');

  updateItemCount('skills', skills.length);
}

/**
 * Update item count badge
 */
function updateItemCount(section, count) {
  const badge = document.getElementById(`${section}-count`);
  if (badge) {
    badge.textContent = count;
  }
}

/**
 * Update all section counts
 */
function updateAllCounts() {
  const resume = getCurrentResume();
  if (!resume) return;

  ['experience', 'education', 'projects', 'custom'].forEach(section => {
    const count = resume[section]?.items?.length || 0;
    updateItemCount(section, count);
  });

  updateItemCount('skills', resume.skills?.items?.length || 0);
}

/**
 * Load custom section title
 */
export function loadCustomSectionTitle() {
  const baseResume = getBaseResume();
  const input = document.getElementById('custom-title');

  if (input && baseResume?.custom?.title) {
    input.value = baseResume.custom.title;
  }
}

/**
 * Render all sections
 */
export function renderAllSections() {
  ['experience', 'education', 'projects', 'custom'].forEach(renderSection);
  renderSkills();
  loadCustomSectionTitle();
}
