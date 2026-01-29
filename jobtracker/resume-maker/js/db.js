/**
 * Resume Maker Database - Uses JobTrackerDB
 * Thin wrapper for backwards compatibility with existing app.js imports
 *
 * This module re-exports all resume-related methods from JobTrackerDB
 * to maintain the same API while consolidating storage to a single database.
 */

import { JobTrackerDB } from '../../lib/database.js';

/**
 * Open or initialize the database
 */
export async function openDB() {
  return JobTrackerDB.init();
}

// ========================================
// Base Resume Operations
// ========================================

/**
 * Get the base resume
 */
export async function getBaseResume() {
  await JobTrackerDB.init();
  return JobTrackerDB.getBaseResume();
}

/**
 * Save the base resume
 */
export async function saveBaseResume(resume) {
  await JobTrackerDB.init();
  return JobTrackerDB.saveBaseResume(resume);
}

/**
 * Create empty base resume template
 */
export function createEmptyBaseResume() {
  return JobTrackerDB.getDefaultBaseResume();
}

// ========================================
// Generated Resume Operations
// ========================================

/**
 * Get all generated resumes
 */
export async function getAllGeneratedResumes() {
  await JobTrackerDB.init();
  return JobTrackerDB.getAllGeneratedResumes();
}

/**
 * Get a specific generated resume
 */
export async function getGeneratedResume(id) {
  await JobTrackerDB.init();
  return JobTrackerDB.getGeneratedResume(id);
}

/**
 * Save a generated resume
 */
export async function saveGeneratedResume(resume) {
  await JobTrackerDB.init();
  return JobTrackerDB.saveGeneratedResume(resume);
}

/**
 * Delete a generated resume
 */
export async function deleteGeneratedResume(id) {
  await JobTrackerDB.init();
  return JobTrackerDB.deleteGeneratedResume(id);
}

/**
 * Create a new generated resume template
 */
export function createGeneratedResume(baseResume, jobDescription, tailoring) {
  return JobTrackerDB.createGeneratedResume(baseResume, jobDescription, tailoring);
}

// ========================================
// Settings Operations (use JobTrackerDB settings)
// ========================================

/**
 * Get settings
 */
export async function getSettings() {
  await JobTrackerDB.init();
  const settings = await JobTrackerDB.getSettings();
  return { id: 'settings', theme: settings?.ui?.theme || 'system' };
}

/**
 * Save settings
 */
export async function saveSettings(settings) {
  await JobTrackerDB.init();
  const currentSettings = await JobTrackerDB.getSettings();
  currentSettings.ui = {
    ...currentSettings.ui,
    theme: settings.theme || currentSettings.ui?.theme || 'system'
  };
  return JobTrackerDB.saveSettings(currentSettings);
}

// ========================================
// Utility Functions
// ========================================

/**
 * Export all resume data for backup
 */
export async function exportAllData() {
  await JobTrackerDB.init();
  const baseResume = await JobTrackerDB.getBaseResume();
  const generatedResumes = await JobTrackerDB.getAllGeneratedResumes();
  const settings = await getSettings();

  return {
    version: 1,
    exportedAt: Date.now(),
    baseResume,
    generatedResumes,
    settings
  };
}

/**
 * Import resume data from backup
 */
export async function importData(data) {
  await JobTrackerDB.init();

  if (data.baseResume) {
    await JobTrackerDB.saveBaseResume(data.baseResume);
  }

  if (data.generatedResumes) {
    for (const resume of data.generatedResumes) {
      await JobTrackerDB.saveGeneratedResume(resume);
    }
  }

  if (data.settings) {
    await saveSettings(data.settings);
  }
}

/**
 * Clear all resume data
 */
export async function clearAllData() {
  await JobTrackerDB.init();

  // Clear base resume
  await new Promise((resolve, reject) => {
    const transaction = JobTrackerDB.db.transaction([JobTrackerDB.STORES.BASE_RESUME], 'readwrite');
    const store = transaction.objectStore(JobTrackerDB.STORES.BASE_RESUME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Clear generated resumes
  await new Promise((resolve, reject) => {
    const transaction = JobTrackerDB.db.transaction([JobTrackerDB.STORES.GENERATED_RESUMES], 'readwrite');
    const store = transaction.objectStore(JobTrackerDB.STORES.GENERATED_RESUMES);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Re-export JobTrackerDB for direct access if needed
export { JobTrackerDB };
