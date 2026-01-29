/**
 * Resume Maker - State Management
 * LEGACY: This module now delegates to the Zustand store for backwards compatibility
 *
 * All new code should import directly from './store.js' instead.
 *
 * Bug fixes implemented:
 * - #4: setBaseResume/setGeneratedResumes now optionally persist to DB
 * - #9: Retry mechanism for save failures with retry button
 * - #13: Save queue prevents concurrent save conflicts
 * - #14: Subscription cleanup prevents memory leaks
 * - #19/#20: Improved isDirty and saveStatus handling
 */

import { saveBaseResume, saveGeneratedResume, createEmptyBaseResume, JobTrackerDB } from './db.js';

// Import store for delegation
import * as store from './store.js';

// Check if Zustand store is available
const useStore = store.resumeStore !== null;

// State object
const state = {
  baseResume: null,
  currentResume: null, // The resume being edited (base or generated)
  currentEditingResumeId: null, // ID of generated resume being edited
  editingMode: 'base', // 'base' | 'generated'
  generatedResumes: [],
  currentTab: 'resumes',
  zoom: 100,
  isDirty: false,
  jobData: null, // Job data from URL params
  analysisResult: null,
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved' | 'error'
  lastSaveError: null // Store last error for retry
};

// Save status subscribers (separate from main subscribers for performance)
const saveStatusSubscribers = new Set();

// Subscribers
const subscribers = new Map();

// Save queue for preventing concurrent saves (Bug #13)
let saveInProgress = false;
let pendingSave = false;
let saveVersion = 0; // Incremented on each edit to detect stale saves

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch (or '*' for all)
 * @param {Function} callback - Called when state changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
  // If using Zustand store, delegate subscription
  if (useStore && store.resumeStore) {
    // Map key names to store selectors
    const selectorMap = {
      'baseResume': state => state.baseResume,
      'currentResume': state => state.currentResume,
      'generatedResumes': state => state.generatedResumes,
      'profile': state => state.currentResume?.profile || state.baseResume?.profile,
      'experience': state => state.currentResume?.experience || state.baseResume?.experience,
      'education': state => state.currentResume?.education || state.baseResume?.education,
      'projects': state => state.currentResume?.projects || state.baseResume?.projects,
      'skills': state => state.currentResume?.skills || state.baseResume?.skills,
      'custom': state => state.currentResume?.custom || state.baseResume?.custom,
      'currentTab': state => state.currentTab,
      'zoom': state => state.zoom,
      'jobData': state => state.jobData,
      'analysisResult': state => state.analysisResult,
      '*': state => state
    };

    const selector = selectorMap[key] || selectorMap['*'];
    return store.subscribe(selector, callback);
  }

  // Legacy pub/sub fallback
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key).add(callback);

  // Return unsubscribe function that also cleans up empty Sets (Bug #14)
  return () => {
    const set = subscribers.get(key);
    if (set) {
      set.delete(callback);
      // Clean up empty Sets to prevent memory leak
      if (set.size === 0) {
        subscribers.delete(key);
      }
    }
  };
}

/**
 * Notify subscribers of state change
 */
function notify(key, value) {
  // Notify specific key subscribers
  if (subscribers.has(key)) {
    subscribers.get(key).forEach(cb => cb(value, key));
  }
  // Notify wildcard subscribers
  if (subscribers.has('*')) {
    subscribers.get('*').forEach(cb => cb(value, key));
  }
}

/**
 * Subscribe to save status changes
 * @param {Function} callback - Called when save status changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeSaveStatus(callback) {
  // Delegate to store if available
  if (useStore) {
    return store.subscribeSaveStatus(callback);
  }

  // Legacy fallback
  saveStatusSubscribers.add(callback);
  // Call immediately with current status and error if any
  callback(state.saveStatus, state.lastSaveError);
  return () => saveStatusSubscribers.delete(callback);
}

/**
 * Notify save status subscribers
 */
function notifySaveStatus() {
  saveStatusSubscribers.forEach(cb => cb(state.saveStatus, state.lastSaveError));
}

/**
 * Update save status
 * @param {string} status - 'saved' | 'saving' | 'unsaved' | 'error'
 * @param {Error} [error] - Error object if status is 'error'
 */
function setSaveStatus(status, error = null) {
  const statusChanged = state.saveStatus !== status;
  const errorChanged = state.lastSaveError !== error;

  if (statusChanged || errorChanged) {
    state.saveStatus = status;
    state.lastSaveError = error;
    notifySaveStatus();
  }
}

// Auto-save debounce
let saveTimeout = null;

/**
 * Perform the actual save operation
 * Uses save queue to prevent concurrent saves (Bug #13)
 */
async function performSave() {
  // If already saving, mark pending and return
  if (saveInProgress) {
    pendingSave = true;
    return;
  }

  if (!state.isDirty) {
    return;
  }

  // Determine what we're saving
  const isGeneratedMode = state.editingMode === 'generated' && state.currentEditingResumeId;

  if (isGeneratedMode) {
    if (!state.currentResume) return;
  } else {
    if (!state.baseResume) return;
  }

  // Capture current version to detect stale saves
  const currentVersion = ++saveVersion;
  saveInProgress = true;
  setSaveStatus('saving');

  try {
    if (isGeneratedMode) {
      // Saving a generated resume
      const genResume = state.generatedResumes.find(r => r.id === state.currentEditingResumeId);
      if (genResume) {
        genResume.baseResume = state.currentResume;
        genResume.updatedAt = Date.now();
        await saveGeneratedResume(genResume);
        // Update the generatedResumes array with the modified resume
        notify('generatedResumes', state.generatedResumes);
        console.log('Auto-saved generated resume:', state.currentEditingResumeId);
      }
    } else {
      // Saving base resume
      await saveBaseResume(state.baseResume);
      console.log('Auto-saved base resume');
    }

    // Only mark as saved if no newer edits occurred during save
    if (currentVersion === saveVersion) {
      state.isDirty = false;
      setSaveStatus('saved');
    } else {
      // Newer edits occurred, keep as unsaved
      setSaveStatus('unsaved');
    }
  } catch (error) {
    console.error('Auto-save failed:', error);
    setSaveStatus('error', error);
    // Dispatch custom event for error handling in UI (includes retry capability)
    window.dispatchEvent(new CustomEvent('resume-save-error', {
      detail: {
        error,
        retry: () => retrySave(),
        isQuotaExceeded: error?.isQuotaExceeded || false
      }
    }));
  } finally {
    saveInProgress = false;

    // Process pending save if any (Bug #13)
    if (pendingSave) {
      pendingSave = false;
      // Use setTimeout to prevent stack overflow
      setTimeout(() => performSave(), 0);
    }
  }
}

/**
 * Retry the last failed save (Bug #9)
 */
export async function retrySave() {
  if (state.saveStatus !== 'error') {
    return;
  }

  // Clear the error and retry
  state.isDirty = true; // Mark dirty to force save
  state.lastSaveError = null;
  await performSave();
}

/**
 * Schedule auto-save with debounce
 */
function scheduleAutoSave() {
  // Increment version on every edit (Bug #19/#20)
  saveVersion++;

  // Mark as unsaved immediately
  setSaveStatus('unsaved');

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(performSave, 1000);
}

// ========================================
// Getters (delegate to store if available)
// ========================================

export function getState() {
  if (useStore) return store.getState();
  return { ...state };
}

export function getBaseResume() {
  if (useStore) return store.getBaseResume();
  return state.baseResume;
}

export function getCurrentResume() {
  if (useStore) return store.getCurrentResume();
  return state.currentResume || state.baseResume;
}

export function getGeneratedResumes() {
  if (useStore) return store.getGeneratedResumes();
  return [...state.generatedResumes];
}

export function getCurrentTab() {
  if (useStore) return store.getCurrentTab();
  return state.currentTab;
}

export function getZoom() {
  if (useStore) return store.getZoom();
  return state.zoom;
}

export function getJobData() {
  if (useStore) return store.getJobData();
  return state.jobData;
}

export function getAnalysisResult() {
  if (useStore) return store.getAnalysisResult();
  return state.analysisResult;
}

// ========================================
// Setters (delegate to store if available)
// ========================================

/**
 * Set base resume in state
 * @param {Object} resume - The resume object
 * @param {Object} options - Options for setting the resume
 * @param {boolean} options.persist - If true, also save to database (default: false)
 * @param {boolean} options.markDirty - If true, mark as dirty for auto-save (default: false)
 */
export async function setBaseResume(resume, options = {}) {
  // Delegate to store if available
  if (useStore) {
    return store.setBaseResume(resume, options);
  }

  // Legacy fallback
  const { persist = false, markDirty = false } = options;

  state.baseResume = resume;
  state.currentResume = resume;
  notify('baseResume', resume);
  notify('currentResume', resume);

  // Optionally persist to database immediately (Bug #4)
  if (persist && resume) {
    try {
      await saveBaseResume(resume);
    } catch (error) {
      console.error('Failed to persist base resume:', error);
      // Don't throw - state is updated, just DB save failed
    }
  }

  // Optionally mark as dirty for later auto-save
  if (markDirty) {
    state.isDirty = true;
    scheduleAutoSave();
  }
}

export function setCurrentResume(resume) {
  if (useStore) {
    return store.setCurrentResume(resume);
  }
  state.currentResume = resume;
  notify('currentResume', resume);
}

/**
 * Start editing a generated resume
 * Sets up tracking so updates and saves go to the correct resume
 * @param {string} resumeId - ID of the generated resume to edit
 * @returns {boolean} True if resume was found and editing started
 */
export function startEditingGeneratedResume(resumeId) {
  // Delegate to store if available
  if (useStore) {
    return store.startEditingGeneratedResume(resumeId);
  }

  // Legacy fallback
  const resume = state.generatedResumes.find(r => r.id === resumeId);
  if (!resume) return false;

  state.currentEditingResumeId = resumeId;
  state.editingMode = 'generated';
  state.currentResume = JSON.parse(JSON.stringify(resume.baseResume)); // Deep copy
  notify('currentResume', state.currentResume);
  return true;
}

/**
 * Stop editing a generated resume and return to base resume
 */
export function stopEditingGeneratedResume() {
  // Delegate to store if available
  if (useStore) {
    return store.stopEditingGeneratedResume();
  }

  // Legacy fallback
  state.currentEditingResumeId = null;
  state.editingMode = 'base';
  state.currentResume = state.baseResume;
  notify('currentResume', state.currentResume);
}

/**
 * Get the current editing mode
 * @returns {{ mode: string, resumeId: string|null }}
 */
export function getEditingMode() {
  if (useStore) {
    return store.getEditingMode();
  }
  return {
    mode: state.editingMode,
    resumeId: state.currentEditingResumeId
  };
}

/**
 * Get the resume that should be modified by update functions
 * @returns {Object} The target resume (currentResume for generated, baseResume for base)
 */
function getEditingTarget() {
  if (state.editingMode === 'generated' && state.currentEditingResumeId) {
    return state.currentResume;
  }
  return state.baseResume;
}

/**
 * Set generated resumes in state
 * @param {Array} resumes - Array of generated resumes
 */
export function setGeneratedResumes(resumes) {
  if (useStore) {
    return store.setGeneratedResumes(resumes);
  }
  state.generatedResumes = resumes;
  notify('generatedResumes', resumes);
}

export function addGeneratedResume(resume) {
  if (useStore) {
    return store.addGeneratedResume(resume);
  }
  state.generatedResumes = [resume, ...state.generatedResumes];
  notify('generatedResumes', state.generatedResumes);
}

export function removeGeneratedResume(id) {
  if (useStore) {
    return store.removeGeneratedResume(id);
  }
  state.generatedResumes = state.generatedResumes.filter(r => r.id !== id);
  notify('generatedResumes', state.generatedResumes);
}

export function setCurrentTab(tab) {
  if (useStore) {
    return store.setCurrentTab(tab);
  }
  state.currentTab = tab;
  notify('currentTab', tab);
}

export function setZoom(zoom) {
  if (useStore) {
    return store.setZoom(zoom);
  }
  state.zoom = Math.max(50, Math.min(150, zoom));
  notify('zoom', state.zoom);
}

export function setJobData(data) {
  if (useStore) {
    return store.setJobData(data);
  }
  state.jobData = data;
  notify('jobData', data);
}

export function setAnalysisResult(result) {
  if (useStore) {
    return store.setAnalysisResult(result);
  }
  state.analysisResult = result;
  notify('analysisResult', result);
}

// ========================================
// Resume Metadata Updates (name, customSubtitle)
// ========================================

/**
 * Update resume metadata (name, customSubtitle)
 * These are stored on the generated resume object, not the baseResume
 * @param {string} field - 'name' or 'customSubtitle'
 * @param {string} value - The new value
 */
export function updateResumeMeta(field, value) {
  // Delegate to store if available
  if (useStore) {
    return store.updateResumeMeta(field, value);
  }

  // Legacy fallback - only works when editing a generated resume
  if (state.editingMode !== 'generated' || !state.currentEditingResumeId) {
    console.warn('[State] updateResumeMeta requires editing a generated resume');
    return;
  }

  const resume = state.generatedResumes.find(r => r.id === state.currentEditingResumeId);
  if (!resume) return;

  // Update the field
  if (field === 'name' || field === 'customSubtitle') {
    resume[field] = value;
    resume.updatedAt = Date.now();
    state.isDirty = true;
    notify('generatedResumes', state.generatedResumes);
    scheduleAutoSave();
  }
}

// ========================================
// Profile Updates
// ========================================

// Valid profile fields whitelist
const VALID_PROFILE_FIELDS = new Set([
  'name',
  'headline',
  'email',
  'phone',
  'location',
  'website',
  'summary'
]);

export function updateProfile(field, value) {
  // Delegate to store if available
  if (useStore) {
    return store.updateProfile(field, value);
  }

  // Legacy fallback
  // Validate field name against whitelist
  if (!VALID_PROFILE_FIELDS.has(field)) {
    console.warn(`[State] Invalid profile field: ${field}`);
    return;
  }

  let target = getEditingTarget();
  if (!target) {
    // If no target, initialize base resume
    state.baseResume = createEmptyBaseResume();
    state.currentResume = state.baseResume;
    target = state.baseResume;
  }

  target.profile[field] = value;
  state.isDirty = true;
  notify('profile', target.profile);
  notify('currentResume', target);
  scheduleAutoSave();
}

// ========================================
// Section Updates (delegate to store if available)
// ========================================

export function addSectionItem(section, item) {
  if (useStore) {
    return store.addSectionItem(section, item);
  }

  // Legacy fallback
  let target = getEditingTarget();
  if (!target) {
    state.baseResume = createEmptyBaseResume();
    state.currentResume = state.baseResume;
    target = state.baseResume;
  }
  if (!target[section]) {
    target[section] = { title: capitalizeFirst(section), items: [] };
  }
  // Use proper UUID generation (Bug #17)
  const newItem = {
    ...item,
    id: JobTrackerDB.generateId()
  };
  target[section].items.push(newItem);
  state.isDirty = true;
  saveVersion++; // Increment version for concurrent save tracking
  notify(section, target[section]);
  notify('currentResume', target);
  scheduleAutoSave();
  return newItem;
}

export function updateSectionItem(section, itemId, updates) {
  if (useStore) {
    return store.updateSectionItem(section, itemId, updates);
  }

  // Legacy fallback
  const target = getEditingTarget();
  if (!target || !target[section]) return;

  const items = target[section].items;
  const index = items.findIndex(item => item.id === itemId);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates };
    state.isDirty = true;
    notify(section, target[section]);
    notify('currentResume', target);
    scheduleAutoSave();
  }
}

export function removeSectionItem(section, itemId) {
  if (useStore) {
    return store.removeSectionItem(section, itemId);
  }

  // Legacy fallback
  const target = getEditingTarget();
  if (!target || !target[section]) return;

  target[section].items = target[section].items.filter(
    item => item.id !== itemId
  );
  state.isDirty = true;
  notify(section, target[section]);
  notify('currentResume', target);
  scheduleAutoSave();
}

export function reorderSectionItems(section, itemIds) {
  if (useStore) {
    return store.reorderSectionItems(section, itemIds);
  }

  // Legacy fallback
  const target = getEditingTarget();
  if (!target || !target[section]) return;

  const itemMap = new Map(target[section].items.map(item => [item.id, item]));
  target[section].items = itemIds.map(id => itemMap.get(id)).filter(Boolean);
  state.isDirty = true;
  notify(section, target[section]);
  notify('currentResume', target);
  scheduleAutoSave();
}

export function setSectionTitle(section, title) {
  if (useStore) {
    return store.setSectionTitle(section, title);
  }

  // Legacy fallback
  let target = getEditingTarget();
  if (!target) {
    state.baseResume = createEmptyBaseResume();
    state.currentResume = state.baseResume;
    target = state.baseResume;
  }
  if (!target[section]) {
    target[section] = { title, items: [] };
  }
  target[section].title = title;
  state.isDirty = true;
  notify(section, target[section]);
  notify('currentResume', target);
  scheduleAutoSave();
}

// ========================================
// Skills Updates (delegate to store if available)
// ========================================

export function addSkill(skill) {
  if (useStore) {
    return store.addSkill(skill);
  }

  // Legacy fallback
  let target = getEditingTarget();
  if (!target) {
    state.baseResume = createEmptyBaseResume();
    state.currentResume = state.baseResume;
    target = state.baseResume;
  }
  const normalizedSkill = skill.trim();
  if (!normalizedSkill) return;

  // Check for duplicates (case-insensitive)
  const existingSkills = target.skills.items.map(s => s.toLowerCase());
  if (existingSkills.includes(normalizedSkill.toLowerCase())) return;

  target.skills.items.push(normalizedSkill);
  state.isDirty = true;
  notify('skills', target.skills);
  notify('currentResume', target);
  scheduleAutoSave();
}

export function removeSkill(skill) {
  if (useStore) {
    return store.removeSkill(skill);
  }

  // Legacy fallback
  const target = getEditingTarget();
  if (!target) return;

  target.skills.items = target.skills.items.filter(
    s => s.toLowerCase() !== skill.toLowerCase()
  );
  state.isDirty = true;
  notify('skills', target.skills);
  notify('currentResume', target);
  scheduleAutoSave();
}

export function setSkills(skills) {
  if (useStore) {
    return store.setSkills(skills);
  }

  // Legacy fallback
  let target = getEditingTarget();
  if (!target) {
    state.baseResume = createEmptyBaseResume();
    state.currentResume = state.baseResume;
    target = state.baseResume;
  }
  target.skills.items = [...skills];
  state.isDirty = true;
  notify('skills', target.skills);
  notify('currentResume', target);
  scheduleAutoSave();
}

// ========================================
// Force Save / Immediate Save
// ========================================

// Import auto-save module for store-based saves
let autoSaveModule = null;
if (useStore) {
  import('./auto-save.js').then(mod => {
    autoSaveModule = mod;
  }).catch(err => {
    console.warn('[State] Auto-save module not loaded:', err);
  });
}

/**
 * Force immediate save, bypassing debounce
 * Use this when user is about to leave or for critical saves
 * Respects save queue to prevent concurrent saves (Bug #13)
 */
export async function forceSave() {
  // Delegate to auto-save module if available
  if (useStore && autoSaveModule?.forceSave) {
    return autoSaveModule.forceSave();
  }

  // Legacy fallback
  // Clear any pending auto-save
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  // Check if we have something to save
  const isGeneratedMode = state.editingMode === 'generated' && state.currentEditingResumeId;
  if (isGeneratedMode) {
    if (!state.currentResume) return;
  } else {
    if (!state.baseResume) return;
  }

  // If save in progress, wait for it to complete then save again
  if (saveInProgress) {
    pendingSave = true;
    // Wait for current save to complete
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!saveInProgress) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });
  }

  // Mark dirty to ensure save happens
  state.isDirty = true;
  await performSave();

  // Check if save actually succeeded
  if (state.saveStatus === 'error') {
    throw state.lastSaveError || new Error('Save failed');
  }
}

/**
 * Alias for forceSave - immediate save bypassing debounce
 */
export const saveNow = forceSave;

/**
 * Get current save status
 * @returns {{ status: string, error: Error|null }}
 */
export function getSaveStatus() {
  if (useStore) {
    return store.getSaveStatus();
  }
  return {
    status: state.saveStatus,
    error: state.lastSaveError
  };
}

// ========================================
// Beforeunload Warning
// ========================================

// Warn user about unsaved changes when closing tab/window
window.addEventListener('beforeunload', (e) => {
  if (state.isDirty || state.saveStatus === 'unsaved' || state.saveStatus === 'saving') {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});

// ========================================
// Helpers
// ========================================

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
