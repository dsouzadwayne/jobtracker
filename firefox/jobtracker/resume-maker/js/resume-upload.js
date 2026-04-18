/**
 * Resume Upload Module
 * Handles parsing uploaded resume files and populating form fields
 * Uses the shared ResumeParser library
 */

import {
  updateProfile,
  addSectionItem,
  addSkill,
  getBaseResume
} from './state.js';
import { showToast, escapeHtml, generateId } from './utils.js';
import { renderAllSections, loadProfileForm } from './forms.js';

// ==================== STATE ====================

let parsedResumeData = null;
let uploadModal = null;

// ==================== INITIALIZATION ====================

/**
 * Initialize resume upload functionality
 */
export function initResumeUpload() {
  const uploadBtn = document.getElementById('upload-resume-btn');
  const fileInput = document.getElementById('resume-file-input');
  uploadModal = document.getElementById('upload-modal');

  if (!uploadBtn || !fileInput || !uploadModal) {
    console.log('[ResumeUpload] Upload elements not found');
    return;
  }

  // Upload button triggers file input
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // File input change handler
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
    // Reset input so same file can be selected again
    fileInput.value = '';
  });

  // Modal controls
  const closeBtn = document.getElementById('close-upload-modal');
  const cancelBtn = document.getElementById('cancel-upload-btn');
  const applyBtn = document.getElementById('apply-upload-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeUploadModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeUploadModal);
  if (applyBtn) applyBtn.addEventListener('click', applyParsedResume);

  // Close on backdrop click
  uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) closeUploadModal();
  });
}

// ==================== FILE HANDLING ====================

/**
 * Handle file upload
 * @param {File} file - The uploaded file
 */
async function handleFileUpload(file) {
  // Check if ResumeParser is available
  if (typeof window.ResumeParser === 'undefined') {
    showToast('Resume parser is not available', 'error');
    return;
  }

  // Show modal with loading state
  showUploadModal();
  setLoadingState(true);

  try {
    // Parse the resume
    console.log('[ResumeUpload] Parsing file:', file.name);
    const result = await window.ResumeParser.parse(file);

    console.log('[ResumeUpload] Parse result:', result);

    // Store parsed data
    parsedResumeData = result;

    // Show preview
    setLoadingState(false);
    showPreview(result);

  } catch (error) {
    console.error('[ResumeUpload] Parse error:', error);
    setLoadingState(false);
    showError(error.message || 'Failed to parse resume');
  }
}

// ==================== MODAL MANAGEMENT ====================

/**
 * Show upload modal
 */
function showUploadModal() {
  if (uploadModal) {
    uploadModal.classList.remove('hidden');
    // Reset state
    hidePreview();
    hideError();
  }
}

/**
 * Close upload modal
 */
function closeUploadModal() {
  if (uploadModal) {
    uploadModal.classList.add('hidden');
    parsedResumeData = null;
  }
}

/**
 * Set loading state
 */
function setLoadingState(loading) {
  const loadingEl = document.querySelector('#upload-status .upload-loading');
  const applyBtn = document.getElementById('apply-upload-btn');

  if (loadingEl) {
    loadingEl.classList.toggle('hidden', !loading);
  }
  if (applyBtn) {
    applyBtn.classList.toggle('hidden', loading);
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.querySelector('#upload-status .upload-error');
  const errorMsg = errorEl?.querySelector('.error-message');

  if (errorEl && errorMsg) {
    errorMsg.textContent = message;
    errorEl.classList.remove('hidden');
  }
  hidePreview();
}

/**
 * Hide error message
 */
function hideError() {
  const errorEl = document.querySelector('#upload-status .upload-error');
  if (errorEl) {
    errorEl.classList.add('hidden');
  }
}

/**
 * Show preview
 */
function showPreview(data) {
  const previewEl = document.getElementById('upload-preview');
  const applyBtn = document.getElementById('apply-upload-btn');

  if (!previewEl) return;

  previewEl.classList.remove('hidden');
  if (applyBtn) applyBtn.classList.remove('hidden');

  // Populate preview sections
  renderProfilePreview(data);
  renderExperiencePreview(data);
  renderEducationPreview(data);
  renderSkillsPreview(data);
}

/**
 * Hide preview
 */
function hidePreview() {
  const previewEl = document.getElementById('upload-preview');
  const applyBtn = document.getElementById('apply-upload-btn');

  if (previewEl) previewEl.classList.add('hidden');
  if (applyBtn) applyBtn.classList.add('hidden');
}

// ==================== PREVIEW RENDERING ====================

/**
 * Render profile preview
 */
function renderProfilePreview(data) {
  const container = document.getElementById('preview-profile');
  if (!container) return;

  // Safely extract personal data with full null checks
  if (!data) {
    container.innerHTML = '<p class="text-muted text-sm">No data available</p>';
    return;
  }

  const personal = data.normalized?.personal || data.extracted?.personal || {};

  const items = [];
  if (personal.firstName || personal.lastName) {
    items.push(`<strong>Name:</strong> ${escapeHtml(formatName(personal))}`);
  }
  if (personal.email) {
    items.push(`<strong>Email:</strong> ${escapeHtml(personal.email)}`);
  }
  if (personal.phone) {
    items.push(`<strong>Phone:</strong> ${escapeHtml(personal.phone)}`);
  }
  if (personal.location) {
    items.push(`<strong>Location:</strong> ${escapeHtml(personal.location)}`);
  }
  if (personal.linkedIn) {
    items.push(`<strong>LinkedIn:</strong> ${escapeHtml(personal.linkedIn)}`);
  }

  container.innerHTML = items.length > 0
    ? items.map(item => `<div class="preview-item">${item}</div>`).join('')
    : '<p class="text-muted text-sm">No profile information extracted</p>';
}

/**
 * Render experience preview
 */
function renderExperiencePreview(data) {
  const container = document.getElementById('preview-experience');
  if (!container) return;

  if (!data) {
    container.innerHTML = '<p class="text-muted text-sm">No data available</p>';
    return;
  }

  const workHistory = data.normalized?.workHistory || data.extracted?.workHistory || [];

  if (workHistory.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">No work experience extracted</p>';
    return;
  }

  container.innerHTML = workHistory.map(exp => `
    <div class="preview-item">
      <strong>${escapeHtml(exp.title || 'Untitled')}</strong>
      ${exp.company ? ` at ${escapeHtml(exp.company)}` : ''}
      ${exp.startDate ? `<span class="text-muted"> (${escapeHtml(exp.startDate)}${exp.endDate ? ` - ${escapeHtml(exp.endDate)}` : exp.current ? ' - Present' : ''})</span>` : ''}
    </div>
  `).join('');
}

/**
 * Render education preview
 */
function renderEducationPreview(data) {
  const container = document.getElementById('preview-education');
  if (!container) return;

  if (!data) {
    container.innerHTML = '<p class="text-muted text-sm">No data available</p>';
    return;
  }

  const education = data.normalized?.education || data.extracted?.education || [];

  if (education.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">No education extracted</p>';
    return;
  }

  container.innerHTML = education.map(edu => `
    <div class="preview-item">
      <strong>${escapeHtml(edu.degree || 'Untitled')}</strong>
      ${edu.school ? ` - ${escapeHtml(edu.school)}` : ''}
      ${edu.endDate ? `<span class="text-muted"> (${escapeHtml(edu.endDate)})</span>` : ''}
    </div>
  `).join('');
}

/**
 * Render skills preview
 */
function renderSkillsPreview(data) {
  const container = document.getElementById('preview-skills');
  if (!container) return;

  if (!data) {
    container.innerHTML = '<p class="text-muted text-sm">No data available</p>';
    return;
  }

  const skills = data.normalized?.skills || data.extracted?.skills || {};
  const allSkills = [
    ...(skills.languages || []),
    ...(skills.frameworks || []),
    ...(skills.tools || []),
    ...(skills.soft || [])
  ];

  if (allSkills.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">No skills extracted</p>';
    return;
  }

  container.innerHTML = `
    <div class="skill-tags-preview">
      ${allSkills.slice(0, 20).map(skill => `<span class="skill-tag-small">${escapeHtml(skill)}</span>`).join('')}
      ${allSkills.length > 20 ? `<span class="text-muted">+${allSkills.length - 20} more</span>` : ''}
    </div>
  `;
}

// ==================== APPLY PARSED DATA ====================

/**
 * Apply parsed resume data to form
 */
function applyParsedResume() {
  if (!parsedResumeData) {
    showToast('No parsed data available', 'error');
    return;
  }

  const importProfile = document.getElementById('import-profile')?.checked ?? true;
  const importExperience = document.getElementById('import-experience')?.checked ?? true;
  const importEducation = document.getElementById('import-education')?.checked ?? true;
  const importSkills = document.getElementById('import-skills')?.checked ?? true;

  let itemsImported = 0;

  // Apply profile data
  if (importProfile) {
    const personal = parsedResumeData.normalized?.personal || parsedResumeData.extracted?.personal || {};
    if (personal.firstName || personal.lastName) {
      updateProfile('name', formatName(personal));
      itemsImported++;
    }
    if (personal.email) {
      updateProfile('email', personal.email);
      itemsImported++;
    }
    if (personal.phone) {
      updateProfile('phone', personal.phone);
      itemsImported++;
    }
    if (personal.location) {
      updateProfile('location', personal.location);
      itemsImported++;
    }
    if (personal.linkedIn) {
      updateProfile('website', personal.linkedIn);
      itemsImported++;
    }

    // Reload profile form to show updated data
    loadProfileForm(getBaseResume()?.profile);
  }

  // Apply experience data
  if (importExperience) {
    const workHistory = parsedResumeData.normalized?.workHistory || parsedResumeData.extracted?.workHistory || [];
    workHistory.forEach(exp => {
      addSectionItem('experience', {
        id: generateId('exp-'),
        title: exp.title || '',
        company: exp.company || '',
        location: exp.location || '',
        startDate: formatDateForInput(exp.startDate),
        endDate: formatDateForInput(exp.endDate),
        current: exp.current || false,
        description: exp.description || ''
      });
      itemsImported++;
    });
  }

  // Apply education data
  if (importEducation) {
    const education = parsedResumeData.normalized?.education || parsedResumeData.extracted?.education || [];
    education.forEach(edu => {
      addSectionItem('education', {
        id: generateId('edu-'),
        degree: edu.degree || '',
        school: edu.school || '',
        location: edu.location || '',
        startDate: formatDateForInput(edu.startDate),
        endDate: formatDateForInput(edu.endDate),
        gpa: edu.gpa || '',
        description: edu.description || edu.honors || ''
      });
      itemsImported++;
    });
  }

  // Apply skills data
  if (importSkills) {
    const skills = parsedResumeData.normalized?.skills || parsedResumeData.extracted?.skills || {};
    const allSkills = [
      ...(skills.languages || []),
      ...(skills.frameworks || []),
      ...(skills.tools || []),
      ...(skills.soft || [])
    ];

    // Get existing skills to avoid duplicates
    const existingSkills = new Set((getBaseResume()?.skills?.items || []).map(s => s.toLowerCase()));

    allSkills.forEach(skill => {
      if (!existingSkills.has(skill.toLowerCase())) {
        addSkill(skill);
        existingSkills.add(skill.toLowerCase());
        itemsImported++;
      }
    });
  }

  // Re-render all sections
  renderAllSections();

  // Close modal and show success
  closeUploadModal();
  showToast(`Imported ${itemsImported} items from resume`, 'success');
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format name from personal data
 */
function formatName(personal) {
  const parts = [personal.firstName, personal.middleName, personal.lastName].filter(Boolean);
  return parts.join(' ');
}

/**
 * Format date string for month input (YYYY-MM format)
 */
function formatDateForInput(dateStr) {
  if (!dateStr) return '';

  // Already in YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse various date formats
  try {
    // Handle "Month Year" format (e.g., "January 2023")
    const monthYearMatch = dateStr.match(/(\w+)\s+(\d{4})/);
    if (monthYearMatch) {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = monthNames.indexOf(monthYearMatch[1].toLowerCase());
      if (monthIndex !== -1) {
        return `${monthYearMatch[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
      }
    }

    // Handle "MM/YYYY" or "MM-YYYY" format
    const mmYYYYMatch = dateStr.match(/(\d{1,2})[\/\-](\d{4})/);
    if (mmYYYYMatch) {
      return `${mmYYYYMatch[2]}-${mmYYYYMatch[1].padStart(2, '0')}`;
    }

    // Handle full date format (try to parse)
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  } catch (error) {
    console.warn('[ResumeUpload] Date parse error:', dateStr, error.message);
  }

  return '';
}

/**
 * Validate date range (start date should be before or equal to end date)
 * @param {string} startDate - Start date in YYYY-MM format
 * @param {string} endDate - End date in YYYY-MM format
 * @returns {boolean} True if valid, false if start is after end
 */
export function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return true; // No validation needed if either is empty

  // Parse YYYY-MM format
  const startMatch = startDate.match(/^(\d{4})-(\d{2})$/);
  const endMatch = endDate.match(/^(\d{4})-(\d{2})$/);

  if (!startMatch || !endMatch) return true; // Can't validate non-standard formats

  const startYear = parseInt(startMatch[1], 10);
  const startMonth = parseInt(startMatch[2], 10);
  const endYear = parseInt(endMatch[1], 10);
  const endMonth = parseInt(endMatch[2], 10);

  // Start should be before or equal to end
  if (startYear > endYear) return false;
  if (startYear === endYear && startMonth > endMonth) return false;

  return true;
}

/**
 * Check if ResumeParser is available
 */
export function isResumeParserAvailable() {
  return typeof window.ResumeParser !== 'undefined';
}

/**
 * Get supported file types string
 */
export function getSupportedFileTypes() {
  if (typeof window.ResumeParser !== 'undefined') {
    return window.ResumeParser.getSupportedExtensions();
  }
  return '.pdf,.docx,.txt';
}
