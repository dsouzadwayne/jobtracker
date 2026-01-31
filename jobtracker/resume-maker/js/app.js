/**
 * Resume Maker - Main Application
 * Initializes all modules and handles global interactions
 */

import { openDB, getBaseResume, saveBaseResume, createEmptyBaseResume, saveGeneratedResume, createGeneratedResume } from './db.js';
import {
  setBaseResume,
  setJobData,
  setAnalysisResult,
  setCurrentTab,
  addGeneratedResume,
  subscribe,
  subscribeSaveStatus,
  getBaseResume as getStateBaseResume,
  getAnalysisResult,
  startEditingGeneratedResume,
  stopEditingGeneratedResume,
  getEditingMode,
  getGeneratedResumes
} from './state.js';
import { initAutoSave } from './auto-save.js';
import { initForms, loadProfileForm, renderAllSections, loadResumeDetailsForm } from './forms.js';
import { initPreview, renderPreview } from './preview.js';
import { initPdfExport } from './pdfme-export.js';
import { initResumeList, loadResumes } from './resume-list.js';
import { analyzeJobDescription } from './ai-analysis.js';
import { parseUrlParams, showToast, initTheme, toggleTheme, escapeHtml, stripHtmlTags } from './utils.js';
import { getJobTrackerProfile, isBaseResumeEmpty, transformProfile, mergeWithExisting } from './profile-import.js';
import { initResumeUpload } from './resume-upload.js';

/**
 * Initialize the application
 */
async function init() {
  try {
    // Initialize theme
    initTheme();

    // Open database
    await openDB();

    // Load base resume or create empty one
    let baseResume = await getBaseResume();
    if (!baseResume) {
      baseResume = createEmptyBaseResume();
      await saveBaseResume(baseResume);
    }

    // Auto-import from JobTracker profile if resume is empty
    if (isBaseResumeEmpty(baseResume)) {
      try {
        const jtProfile = await getJobTrackerProfile();
        if (jtProfile?.personal && (jtProfile.personal.firstName || jtProfile.personal.email)) {
          const imported = transformProfile(jtProfile);
          baseResume = mergeWithExisting(baseResume, imported);
          await saveBaseResume(baseResume);
          showToast('Profile imported from JobTracker', 'success');
        }
      } catch (error) {
        console.log('Resume Maker: Could not auto-import profile:', error);
      }
    }

    // Set state without triggering saves (data is already in DB)
    await setBaseResume(baseResume, { persist: false, markDirty: false });

    // Initialize preview first (doesn't need form data)
    initPreview();
    initPdfExport();
    initResumeList();
    initResumeUpload();

    // Initialize UI components before forms
    initTabs();
    initThemeToggle();
    initSaveIndicator();
    initJdModal();
    initSaveModal();
    initImportButton();

    // IMPORTANT: Load data into forms BEFORE initializing form listeners (Bug #8)
    // This prevents triggering auto-save when populating fields
    loadProfileForm(baseResume.profile);
    renderAllSections();

    // Initialize form event listeners AFTER data is loaded
    initForms();

    // Initialize auto-save (uses Zustand store for atomic saves)
    initAutoSave();

    // Load generated resumes (non-critical - continue even if this fails)
    try {
      await loadResumes();

      // Handle edit/view parameter AFTER resumes are loaded
      const params = parseUrlParams();
      if (params.edit || params.view) {
        const resumeId = params.edit || params.view;
        const success = startEditingGeneratedResume(resumeId);
        if (success) {
          // Get the resume object to populate the details form
          const resumes = getGeneratedResumes();
          const resume = resumes.find(r => r.id === resumeId);
          if (resume) {
            loadResumeDetailsForm(resume);
          }

          // Switch to the editor tab
          setCurrentTab('editor');
          document.querySelector('[data-tab="editor"]')?.click();

          showToast(params.view ? 'Loaded resume' : 'Loaded resume for editing', 'success');
        } else {
          showToast('Resume not found', 'error');
        }
      }
    } catch (error) {
      console.error('Failed to load generated resumes:', error);
      // Continue initialization - this is non-critical
    }

    // Check for job data from URL params (non-critical)
    try {
      const params = parseUrlParams();

      if (params.job) {
        setJobData(params.job);
        // Pre-fill JD modal if job description is available
        if (params.job.description) {
          const jdText = document.getElementById('jd-text');
          if (jdText) {
            jdText.value = stripHtmlTags(params.job.description);
          }
          // Show job info
          const jdInfo = document.getElementById('jd-info');
          const jdTitle = document.getElementById('jd-job-title');
          const jdCompany = document.getElementById('jd-job-company');

          if (jdInfo && (params.job.title || params.job.company)) {
            jdInfo.style.display = 'block';
            if (jdTitle) jdTitle.textContent = params.job.title || 'Unknown Position';
            if (jdCompany) jdCompany.textContent = params.job.company || 'Unknown Company';
          }

          // Open JD modal automatically
          setTimeout(() => {
            document.getElementById('jd-modal')?.classList.remove('hidden');
          }, 500);
        }
      }
    } catch (error) {
      console.error('Failed to parse URL parameters:', error);
      // Continue - URL params are not critical
    }

    console.log('Resume Maker initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Resume Maker:', error);
    showToast('Failed to initialize. Please refresh the page.', 'error');
  }
}

/**
 * Initialize tab navigation
 */
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      const targetTab = tab.dataset.tab;

      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${targetTab}-tab`);
      });

      setCurrentTab(targetTab);

      // When switching to resumes tab, stop editing generated resume and reload list
      if (targetTab === 'resumes') {
        // Reset editing context to base resume mode
        const { mode } = getEditingMode();
        if (mode === 'generated') {
          stopEditingGeneratedResume();
          // Reload base resume data into form for when user returns to editor
          const baseResume = getStateBaseResume();
          if (baseResume) {
            loadProfileForm(baseResume.profile);
            renderAllSections();
          }
        }
        await loadResumes();
      }
    });
  });
}

/**
 * Initialize theme toggle
 */
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      toggleTheme();
    });
  }
}

/**
 * Initialize save status indicator (Bug #9 - with retry button support)
 */
function initSaveIndicator() {
  const el = document.getElementById('save-status');
  if (!el) return;

  const savedEl = el.querySelector('.save-status-saved');
  const savingEl = el.querySelector('.save-status-saving');
  const unsavedEl = el.querySelector('.save-status-unsaved');
  const errorEl = el.querySelector('.save-status-error');

  subscribeSaveStatus((status, error) => {
    // Hide all status indicators
    savedEl?.classList.add('hidden');
    savingEl?.classList.add('hidden');
    unsavedEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');

    // Show the current status
    switch (status) {
      case 'saved':
        savedEl?.classList.remove('hidden');
        break;
      case 'saving':
        savingEl?.classList.remove('hidden');
        break;
      case 'unsaved':
        unsavedEl?.classList.remove('hidden');
        break;
      case 'error':
        errorEl?.classList.remove('hidden');
        break;
    }
  });

  // Listen for save errors to show toast with retry button (Bug #9)
  window.addEventListener('resume-save-error', (e) => {
    const { error, retry, isQuotaExceeded } = e.detail || {};

    if (isQuotaExceeded) {
      // Show special message for quota exceeded
      showToast('Storage full! Please delete old resumes to free space.', 'error', 10000);
    } else {
      // Show error - user can retry by making another edit
      showToast('Failed to save resume. Changes will retry automatically.', 'error', 5000);
    }
  });
}

/**
 * Initialize Import Profile button
 */
function initImportButton() {
  const btn = document.getElementById('import-profile-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    // Confirm before importing
    if (!confirm('Import profile from JobTracker? This will update your resume with data from your JobTracker profile.')) {
      return;
    }

    try {
      const jtProfile = await getJobTrackerProfile();

      if (!jtProfile?.personal || (!jtProfile.personal.firstName && !jtProfile.personal.email)) {
        showToast('No profile found in JobTracker. Please fill out your profile first.', 'error');
        return;
      }

      const imported = transformProfile(jtProfile);
      const current = getStateBaseResume();

      // Merge imported data with current resume, preserving customizations
      const merged = mergeWithExisting(current, imported);

      // Save and update UI
      await saveBaseResume(merged);
      setBaseResume(merged);
      loadProfileForm(merged.profile);
      renderAllSections();

      showToast('Profile imported successfully!', 'success');
    } catch (error) {
      console.error('Failed to import profile:', error);
      showToast('Failed to import profile. Please try again.', 'error');
    }
  });
}

/**
 * Initialize Job Description modal
 */
function initJdModal() {
  const modal = document.getElementById('jd-modal');
  const openBtn = document.getElementById('create-from-jd-btn');
  const closeBtn = document.getElementById('close-jd-modal');
  const cancelBtn = document.getElementById('cancel-jd-btn');
  const analyzeBtn = document.getElementById('analyze-jd-btn');
  const applyBtn = document.getElementById('apply-jd-btn');
  const jdText = document.getElementById('jd-text');
  const analysisSection = document.getElementById('jd-analysis');

  if (!modal) return;

  // Open modal
  openBtn?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    // Reset state
    analysisSection?.classList.add('hidden');
    analyzeBtn?.classList.remove('hidden');
    applyBtn?.classList.add('hidden');
  });

  // Close modal
  const closeModal = () => {
    modal.classList.add('hidden');
    // Reset
    if (jdText) jdText.value = '';
    analysisSection?.classList.add('hidden');
    analyzeBtn?.classList.remove('hidden');
    applyBtn?.classList.add('hidden');
    setAnalysisResult(null);
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Analyze button
  analyzeBtn?.addEventListener('click', () => {
    let text = jdText?.value?.trim();
    if (!text) {
      showToast('Please enter a job description', 'error');
      return;
    }

    // Strip HTML tags and decode entities before analysis
    text = stripHtmlTags(text);

    // Get base resume for analysis
    const baseResume = getStateBaseResume();

    // Analyze
    const result = analyzeJobDescription(text, baseResume);
    setAnalysisResult(result);

    // Display results
    displayAnalysisResults(result);

    // Show analysis section and apply button
    analysisSection?.classList.remove('hidden');
    analyzeBtn?.classList.add('hidden');
    applyBtn?.classList.remove('hidden');
  });

  // Apply button
  applyBtn?.addEventListener('click', async () => {
    const analysis = getAnalysisResult();
    if (!analysis) {
      showToast('Please analyze the job description first', 'error');
      return;
    }

    const baseResume = getStateBaseResume();

    // Show save modal to name the resume
    openSaveModal(async (name) => {
      // Create generated resume
      const generatedResume = createGeneratedResume(
        baseResume,
        analysis.jobDescription,
        analysis.tailoring
      );
      generatedResume.name = name;

      // Save to database
      await saveGeneratedResume(generatedResume);

      // Add to state
      addGeneratedResume(generatedResume);

      // Close JD modal
      closeModal();

      // Render preview with highlights
      renderPreview();

      showToast('Resume tailored and saved!', 'success');
    });
  });
}

/**
 * Display analysis results in modal
 */
function displayAnalysisResults(result) {
  const matchingSkillsEl = document.getElementById('matching-skills');
  const highlightSkillsEl = document.getElementById('highlight-skills');
  const missingSkillsEl = document.getElementById('missing-skills');

  if (matchingSkillsEl) {
    const skills = result.tailoring.matchingSkills || [];
    matchingSkillsEl.innerHTML = skills.length > 0
      ? skills.map(s => `<span class="skill-tag matched">${escapeHtml(s)}</span>`).join('')
      : '<span class="text-muted">No matching skills found</span>';
  }

  if (highlightSkillsEl) {
    const skills = result.tailoring.highlightSkills || [];
    highlightSkillsEl.innerHTML = skills.length > 0
      ? skills.map(s => `<span class="skill-tag highlight">${escapeHtml(s)}</span>`).join('')
      : '<span class="text-muted">No skills to highlight</span>';
  }

  if (missingSkillsEl) {
    const skills = result.tailoring.missingSkills || [];
    missingSkillsEl.innerHTML = skills.length > 0
      ? skills.map(s => `<span class="skill-tag missing">${escapeHtml(s)}</span>`).join('')
      : '<span class="text-muted">Great! You have all the required skills</span>';
  }
}

/**
 * Initialize Save modal
 */
function initSaveModal() {
  const modal = document.getElementById('save-modal');
  const closeBtn = document.getElementById('close-save-modal');
  const cancelBtn = document.getElementById('cancel-save-btn');
  const form = document.getElementById('save-form');

  if (!modal) return;

  // Close handlers
  const closeModal = () => {
    modal.classList.add('hidden');
    form?.reset();
    saveCallback = null;
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Form submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('resume-name');
    const name = nameInput?.value?.trim();

    if (!name) {
      showToast('Please enter a name for the resume', 'error');
      return;
    }

    if (saveCallback) {
      try {
        await saveCallback(name);
      } catch (error) {
        console.error('Failed to save resume:', error);
        showToast('Failed to save resume. Please try again.', 'error');
        return;
      }
    }

    closeModal();
  });
}

// Callback for save modal
let saveCallback = null;

/**
 * Open save modal with callback
 */
function openSaveModal(callback) {
  const modal = document.getElementById('save-modal');
  const nameInput = document.getElementById('resume-name');

  if (!modal) return;

  // Pre-fill with job title if available
  const analysis = getAnalysisResult();
  if (analysis?.jobDescription?.title && nameInput) {
    const company = analysis.jobDescription.company;
    nameInput.value = company
      ? `${analysis.jobDescription.title} - ${company}`
      : analysis.jobDescription.title;
  }

  saveCallback = callback;
  modal.classList.remove('hidden');
  nameInput?.focus();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
