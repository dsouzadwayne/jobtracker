/**
 * Resume Maker - Resume List Management
 * Handles the "My Resumes" tab with generated resumes
 *
 * Bug fixes implemented:
 * - #6: Sync state with DB after operations
 * - #7: Add save status indicators for operations
 * - #17: Use consistent UUID generation
 * - #23: Add proper error handling for export
 */

import {
  getAllGeneratedResumes,
  deleteGeneratedResume,
  saveGeneratedResume,
  JobTrackerDB
} from './db.js';
import {
  resumeStore,
  setGeneratedResumes,
  getGeneratedResumes,
  removeGeneratedResume,
  addGeneratedResume,
  setCurrentResume,
  setCurrentTab,
  subscribe,
  getBaseResume,
  startEditingGeneratedResume,
  getCurrentResume,
  isLoading
} from './store.js';
import { escapeHtml, formatRelativeTime, showToast, truncate } from './utils.js';
import { exportToPdf } from './pdfme-export.js';
import { loadProfileForm, renderAllSections, loadResumeDetailsForm } from './forms.js';

// Store resume usage counts (how many applications use each resume)
let resumeUsageCounts = {};

// Store uploaded resumes
let uploadedResumes = [];

/**
 * Initialize resume list
 */
export function initResumeList() {
  // Subscribe to generatedResumes changes in the store
  subscribe(
    state => state.generatedResumes,
    (resumes) => renderResumeList(resumes, uploadedResumes)
  );

  // New resume button
  const newBtn = document.getElementById('new-resume-btn');
  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      try {
        const baseResume = getBaseResume();
        if (!baseResume) {
          showToast('Please set up your base resume first', 'warning');
          return;
        }

        // Create new resume with blank name and cleared headline
        const newResume = {
          id: JobTrackerDB.generateId(),
          name: '',  // Leave blank for user to fill
          customSubtitle: '',  // Optional custom subtitle
          baseResume: {
            ...baseResume,
            profile: {
              ...baseResume.profile,
              headline: ''  // Clear headline for new resume
            }
          },
          jobDescription: null,
          tailoring: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          exported: false
        };

        await saveGeneratedResume(newResume);
        addGeneratedResume(newResume);

        // Start editing the new resume (fixes stale data persisting issue)
        const success = startEditingGeneratedResume(newResume.id);
        if (!success) {
          showToast('Resume created but failed to open', 'warning');
          return;
        }

        // Wait for loading to complete before updating forms
        // This prevents race conditions between form listeners and state updates
        if (resumeStore) {
          const unsubscribe = resumeStore.subscribe((state) => {
            if (!state.isLoading) {
              unsubscribe();

              // Now safe to update forms - state is stable
              const currentResume = getCurrentResume();
              if (currentResume) {
                loadProfileForm(currentResume.profile);
                renderAllSections();
              }
              // Load resume details form with the new resume data
              loadResumeDetailsForm(newResume);

              setCurrentTab('editor');
              document.querySelector('[data-tab="editor"]')?.click();
              showToast('New resume created', 'success');
            }
          });
        } else {
          // Fallback if store not available
          const currentResume = getCurrentResume();
          if (currentResume) {
            loadProfileForm(currentResume.profile);
            renderAllSections();
          }
          // Load resume details form with the new resume data
          loadResumeDetailsForm(newResume);
          setCurrentTab('editor');
          document.querySelector('[data-tab="editor"]')?.click();
          showToast('New resume created', 'success');
        }
      } catch (error) {
        console.error('Failed to create resume:', error);
        showToast('Failed to create resume', 'error');
      }
    });
  }

  // Search input
  const searchInput = document.getElementById('resume-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderResumeList(getGeneratedResumes(), uploadedResumes, e.target.value);
    });
  }

  // Go to Tailor tab button (in empty state)
  const goTailorBtn = document.getElementById('go-tailor-btn');
  if (goTailorBtn) {
    goTailorBtn.addEventListener('click', () => {
      setCurrentTab('editor');
      document.querySelector('[data-tab="editor"]')?.click();
      // Open the JD modal after switching tabs
      setTimeout(() => {
        document.getElementById('create-from-jd-btn')?.click();
      }, 100);
    });
  }
}

/**
 * Load resumes from database
 */
export async function loadResumes() {
  try {
    const resumes = await getAllGeneratedResumes();
    setGeneratedResumes(resumes);

    // Load uploaded resumes
    try {
      const uploaded = await chrome.runtime.sendMessage({
        type: 'GET_UPLOADED_RESUMES'
      });
      if (Array.isArray(uploaded)) {
        uploadedResumes = uploaded;
      }
    } catch (uploadedError) {
      console.warn('Failed to load uploaded resumes:', uploadedError);
      uploadedResumes = [];
    }

    // Load usage counts for displaying badges
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RESUME_USAGE_COUNTS'
      });
      if (response && response.generated) {
        resumeUsageCounts = response.generated;
      }
    } catch (usageError) {
      // Non-critical: continue without usage counts
      console.warn('Failed to load resume usage counts:', usageError);
    }

    // Trigger render with both resume types
    renderResumeList(resumes, uploadedResumes);
  } catch (error) {
    console.error('Failed to load resumes:', error);
    showToast('Failed to load resumes', 'error');
  }
}

/**
 * Render the resume list
 */
export function renderResumeList(resumes = [], uploaded = [], searchQuery = '') {
  const list = document.getElementById('resume-list');
  const emptyState = document.getElementById('resumes-empty');

  if (!list) return;

  // Get resumes if not provided
  let filteredGenerated = resumes || getGeneratedResumes();
  let filteredUploaded = uploaded || uploadedResumes;

  // Filter resumes by search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredGenerated = filteredGenerated.filter(resume => {
      const name = (resume.name || '').toLowerCase();
      const title = (resume.jobDescription?.title || '').toLowerCase();
      const company = (resume.jobDescription?.company || '').toLowerCase();

      return name.includes(query) || title.includes(query) || company.includes(query);
    });

    filteredUploaded = filteredUploaded.filter(resume => {
      const name = (resume.name || '').toLowerCase();
      return name.includes(query);
    });
  }

  const totalCount = filteredGenerated.length + filteredUploaded.length;

  // Show/hide empty state
  if (totalCount === 0) {
    list.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  // Render resume cards - generated first, then uploaded
  const generatedHtml = filteredGenerated.map(resume => renderResumeCard(resume)).join('');
  const uploadedHtml = filteredUploaded.map(resume => renderUploadedResumeCard(resume)).join('');

  list.innerHTML = generatedHtml + uploadedHtml;

  // Add event listeners for generated resume cards
  list.querySelectorAll('.resume-card[data-type="generated"]').forEach(card => {
    const id = card.dataset.id;

    // Edit button
    card.querySelector('.edit-resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      editResume(id);
    });

    // Export button
    card.querySelector('.export-resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportResume(id);
    });

    // Delete button
    card.querySelector('.delete-resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteResume(id);
    });

    // Duplicate button
    card.querySelector('.duplicate-resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateResume(id);
    });

    // Card click to edit
    card.addEventListener('click', () => {
      editResume(id);
    });
  });

  // Add event listeners for uploaded resume cards
  list.querySelectorAll('.resume-card[data-type="uploaded"]').forEach(card => {
    const id = card.dataset.id;

    // View button
    card.querySelector('.view-resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      viewUploadedResume(id);
    });

    // Delete button
    card.querySelector('.delete-resume-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteUploadedResume(id);
    });

    // Card click to view
    card.addEventListener('click', () => {
      viewUploadedResume(id);
    });
  });
}

/**
 * Render a single generated resume card
 */
function renderResumeCard(resume) {
  const name = resume.name || 'Untitled Resume';
  // Use custom subtitle if set, otherwise fall back to job description
  const subtitle = resume.customSubtitle ||
    (resume.jobDescription?.title
      ? `${resume.jobDescription.title}${resume.jobDescription.company ? ` at ${resume.jobDescription.company}` : ''}`
      : 'No job title');
  const createdAt = formatRelativeTime(resume.createdAt);
  const matchCount = resume.tailoring?.matchingSkills?.length || 0;
  const matchingSkills = resume.tailoring?.matchingSkills?.slice(0, 4) || [];
  const usageCount = resumeUsageCounts[resume.id] || 0;

  return `
    <div class="resume-card" data-id="${escapeHtml(resume.id)}" data-type="generated">
      ${usageCount > 0 ? `
        <div class="resume-usage-badge" title="Used in ${usageCount} application${usageCount !== 1 ? 's' : ''}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          ${usageCount}
        </div>
      ` : ''}
      <div class="resume-card-header">
        <div class="resume-card-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="resume-card-info">
          <div class="resume-card-title">${escapeHtml(name)}</div>
          <div class="resume-card-subtitle">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <div class="resume-card-meta">
        <span title="Created ${escapeHtml(createdAt)}">${escapeHtml(createdAt)}</span>
        ${matchCount > 0 ? `<span>${matchCount} skill${matchCount !== 1 ? 's' : ''} matched</span>` : ''}
      </div>
      ${matchingSkills.length > 0 ? `
        <div class="resume-card-skills">
          ${matchingSkills.map(skill => `<span class="skill-tag matched">${escapeHtml(truncate(skill, 15))}</span>`).join('')}
          ${matchCount > 4 ? `<span class="skill-tag">+${matchCount - 4}</span>` : ''}
        </div>
      ` : ''}
      <div class="resume-card-actions">
        <button class="btn btn-secondary edit-resume-btn" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        </button>
        <button class="btn btn-primary export-resume-btn" title="Export PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          PDF
        </button>
        <button class="btn btn-secondary icon-btn duplicate-resume-btn" title="Duplicate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="btn btn-secondary icon-btn delete-resume-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
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
 * Render an uploaded resume card
 */
function renderUploadedResumeCard(resume) {
  const name = resume.name || 'Uploaded Resume';
  const fileSize = formatFileSize(resume.size);
  const uploadedAt = formatRelativeTime(new Date(resume.uploadedAt).getTime());

  return `
    <div class="resume-card resume-card-uploaded" data-id="${escapeHtml(resume.id)}" data-type="uploaded">
      <div class="resume-type-badge">Uploaded</div>
      <div class="resume-card-header">
        <div class="resume-card-icon resume-card-icon-pdf">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M9 15v-2h2a1 1 0 0 1 0 2H9z"></path>
            <path d="M9 15v2"></path>
          </svg>
        </div>
        <div class="resume-card-info">
          <div class="resume-card-title">${escapeHtml(name)}</div>
          <div class="resume-card-subtitle">${escapeHtml(fileSize)}</div>
        </div>
      </div>
      <div class="resume-card-meta">
        <span title="Uploaded ${escapeHtml(uploadedAt)}">Uploaded ${escapeHtml(uploadedAt)}</span>
      </div>
      <div class="resume-card-actions">
        <button class="btn btn-primary view-resume-btn" title="View PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          View PDF
        </button>
        <button class="btn btn-secondary icon-btn delete-resume-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Edit a resume
 * Uses atomic state update via Zustand store
 */
function editResume(id) {
  const resumes = getGeneratedResumes();
  const resume = resumes.find(r => r.id === id);

  if (!resume) {
    showToast('Resume not found', 'error');
    return;
  }

  // Use store's atomic state update
  const success = startEditingGeneratedResume(id);
  if (!success) {
    showToast('Failed to load resume', 'error');
    return;
  }

  // Wait for loading to complete before updating forms
  // This prevents race conditions between form listeners and state updates
  if (resumeStore) {
    const unsubscribe = resumeStore.subscribe((state) => {
      if (!state.isLoading) {
        unsubscribe();

        // Now safe to update forms - state is stable
        const currentResume = getCurrentResume();
        if (currentResume) {
          loadProfileForm(currentResume.profile);
          renderAllSections();
        }
        // Load resume details form with the resume metadata
        loadResumeDetailsForm(resume);

        setCurrentTab('editor');
        document.querySelector('[data-tab="editor"]')?.click();
        showToast('Resume loaded for editing', 'info');
      }
    });
  } else {
    // Fallback if store not available
    const currentResume = getCurrentResume();
    if (currentResume) {
      loadProfileForm(currentResume.profile);
      renderAllSections();
    }
    // Load resume details form with the resume metadata
    loadResumeDetailsForm(resume);
    setCurrentTab('editor');
    document.querySelector('[data-tab="editor"]')?.click();
    showToast('Resume loaded for editing', 'info');
  }
}

/**
 * Wait for the preview to render with proper completion detection
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<void>}
 */
function waitForPreviewRender(timeout = 2000) {
  return new Promise((resolve) => {
    const preview = document.getElementById('resume-preview');
    if (!preview) {
      resolve();
      return;
    }

    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        resolve();
      }
    };

    // Use MutationObserver to detect when preview content changes
    const observer = new MutationObserver(() => {
      // Give a small buffer for any final rendering
      requestAnimationFrame(() => {
        requestAnimationFrame(done);
      });
    });

    observer.observe(preview, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Fallback timeout to prevent infinite waiting
    setTimeout(done, timeout);

    // If content is already present, resolve after next paint
    if (preview.innerHTML.trim()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(done);
      });
    }
  });
}

/**
 * Export a resume to PDF (Bug #7, #23 - proper error handling and feedback)
 */
async function exportResume(id) {
  const resumes = getGeneratedResumes();
  const resume = resumes.find(r => r.id === id);

  if (!resume) {
    showToast('Resume not found', 'error');
    return;
  }

  try {
    // Set as current resume temporarily for export
    setCurrentResume(resume.baseResume);

    // Wait for preview to render properly
    await waitForPreviewRender();

    // Export
    await exportToPdf();

    // Mark as exported and save to DB
    resume.exported = true;
    resume.exportedAt = Date.now();

    try {
      await saveGeneratedResume(resume);
      // Update state to reflect the change (Bug #6)
      const updatedResumes = getGeneratedResumes().map(r =>
        r.id === id ? resume : r
      );
      setGeneratedResumes(updatedResumes);
      showToast('Resume exported successfully', 'success');
    } catch (saveError) {
      console.warn('Failed to save exported flag:', saveError);
      // PDF was exported, just flag save failed - non-critical
      showToast('Resume exported (flag save failed)', 'warning');
    }
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Failed to export resume', 'error');
  }
}

/**
 * Delete a resume
 */
async function deleteResume(id) {
  if (!confirm('Are you sure you want to delete this resume?')) {
    return;
  }

  try {
    await deleteGeneratedResume(id);
    removeGeneratedResume(id);
    showToast('Resume deleted', 'success');
  } catch (error) {
    console.error('Failed to delete resume:', error);
    showToast('Failed to delete resume', 'error');
  }
}

/**
 * Duplicate a resume (Bug #6, #17 - proper sync and UUID)
 */
async function duplicateResume(id) {
  const resumes = getGeneratedResumes();
  const resume = resumes.find(r => r.id === id);

  if (!resume) {
    showToast('Resume not found', 'error');
    return;
  }

  try {
    // Create a copy with new UUID (Bug #17 - use proper UUID generation)
    const copy = {
      ...resume,
      id: JobTrackerDB.generateId(),
      name: `${resume.name || 'Untitled'} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      exported: false
    };

    await saveGeneratedResume(copy);

    // Update state directly instead of full reload (Bug #6)
    addGeneratedResume(copy);

    showToast('Resume duplicated', 'success');
  } catch (error) {
    console.error('Failed to duplicate resume:', error);
    showToast('Failed to duplicate resume', 'error');
  }
}

/**
 * View an uploaded resume (opens PDF in new tab)
 */
async function viewUploadedResume(id) {
  try {
    const resume = await chrome.runtime.sendMessage({
      type: 'GET_UPLOADED_RESUME',
      payload: { id }
    });

    if (resume && resume.data) {
      // Convert base64 string back to blob
      const byteCharacters = atob(resume.data);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: resume.type || 'application/pdf' });

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up the object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      showToast('Could not load resume. It may have been deleted.', 'error');
    }
  } catch (error) {
    console.error('Failed to view resume:', error);
    showToast('Failed to open resume', 'error');
  }
}

/**
 * Delete an uploaded resume
 */
async function deleteUploadedResume(id) {
  if (!confirm('Are you sure you want to delete this uploaded resume?')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DELETE_UPLOADED_RESUME',
      payload: { id }
    });

    if (response && response.success) {
      // Update local state
      uploadedResumes = uploadedResumes.filter(r => r.id !== id);
      // Re-render the list
      renderResumeList(getGeneratedResumes(), uploadedResumes);
      showToast('Resume deleted', 'success');
    } else {
      throw new Error(response?.error || 'Delete failed');
    }
  } catch (error) {
    console.error('Failed to delete uploaded resume:', error);
    showToast('Failed to delete resume', 'error');
  }
}
