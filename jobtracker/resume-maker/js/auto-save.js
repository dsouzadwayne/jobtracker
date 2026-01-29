/**
 * Resume Maker - Auto-Save Logic
 * Handles automatic saving with debouncing and error recovery
 *
 * Features:
 * - Debounced saves to reduce database writes
 * - Save queue to prevent concurrent saves
 * - Retry mechanism for failed saves
 * - Version tracking to detect stale saves
 */

import { resumeStore, getState, getSaveStatus } from './store.js';
import { saveBaseResume, saveGeneratedResume } from './db.js';

// Save configuration
let saveTimeout = null;
let saveInProgress = false;
let pendingSave = false;
let saveVersion = 0;

const SAVE_DEBOUNCE_MS = 1000;

/**
 * Initialize auto-save by subscribing to isDirty changes
 */
export function initAutoSave() {
  if (!resumeStore) {
    console.warn('[AutoSave] Store not available');
    return;
  }

  // Subscribe to isDirty changes to trigger auto-save
  resumeStore.subscribe((state, prevState) => {
    if (state.isDirty && !prevState.isDirty) {
      scheduleAutoSave();
    }
  });

  // Warn user about unsaved changes when closing tab/window
  window.addEventListener('beforeunload', (e) => {
    const state = getState();
    if (state.isDirty || state.saveStatus === 'unsaved' || state.saveStatus === 'saving') {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });

  console.log('[AutoSave] Initialized');
}

/**
 * Schedule auto-save with debounce
 */
function scheduleAutoSave() {
  // Increment version on every edit to track stale saves
  saveVersion++;

  // Mark as unsaved immediately
  resumeStore.getState().setSaveStatus('unsaved');

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(performSave, SAVE_DEBOUNCE_MS);
}

/**
 * Perform the actual save operation
 * Uses save queue to prevent concurrent saves
 */
async function performSave() {
  // If already saving, mark pending and return
  if (saveInProgress) {
    pendingSave = true;
    return;
  }

  const state = getState();

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
  resumeStore.getState().setSaveStatus('saving');

  try {
    if (isGeneratedMode) {
      // Saving a generated resume
      const genResume = state.generatedResumes.find(
        r => r.id === state.currentEditingResumeId
      );
      if (genResume) {
        // Update the generated resume with current edits
        genResume.baseResume = state.currentResume;
        genResume.updatedAt = Date.now();
        await saveGeneratedResume(genResume);

        // Update state to reflect the change
        resumeStore.getState().updateGeneratedResume?.(genResume.id, {
          baseResume: state.currentResume,
          updatedAt: genResume.updatedAt
        });

        console.log('[AutoSave] Saved generated resume:', state.currentEditingResumeId);
      }
    } else {
      // Saving base resume
      await saveBaseResume(state.baseResume);
      console.log('[AutoSave] Saved base resume');
    }

    // Only mark as saved if no newer edits occurred during save
    if (currentVersion === saveVersion) {
      resumeStore.getState().setDirty(false);
      resumeStore.getState().setSaveStatus('saved');
    } else {
      // Newer edits occurred, keep as unsaved and schedule another save
      resumeStore.getState().setSaveStatus('unsaved');
      scheduleAutoSave();
    }
  } catch (error) {
    console.error('[AutoSave] Save failed:', error);
    resumeStore.getState().setSaveStatus('error', error);

    // Dispatch custom event for error handling in UI
    window.dispatchEvent(new CustomEvent('resume-save-error', {
      detail: {
        error,
        retry: () => retrySave(),
        isQuotaExceeded: error?.isQuotaExceeded || false
      }
    }));
  } finally {
    saveInProgress = false;

    // Process pending save if any
    if (pendingSave) {
      pendingSave = false;
      // Use setTimeout to prevent stack overflow
      setTimeout(() => performSave(), 0);
    }
  }
}

/**
 * Retry the last failed save
 */
export async function retrySave() {
  const { status } = getSaveStatus();

  if (status !== 'error') {
    return;
  }

  // Clear the error and retry
  resumeStore.getState().setDirty(true);
  resumeStore.getState().setSaveStatus('unsaved');
  await performSave();
}

/**
 * Force immediate save, bypassing debounce
 * Use this when user is about to leave or for critical saves
 */
export async function forceSave() {
  // Clear any pending auto-save
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  const state = getState();

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
  resumeStore.getState().setDirty(true);
  await performSave();

  // Check if save actually succeeded
  const { status, error } = getSaveStatus();
  if (status === 'error') {
    throw error || new Error('Save failed');
  }
}

/**
 * Alias for forceSave
 */
export const saveNow = forceSave;

/**
 * Manually trigger a save schedule (useful after bulk operations)
 */
export function markDirtyAndSave() {
  resumeStore.getState().setDirty(true);
  scheduleAutoSave();
}
