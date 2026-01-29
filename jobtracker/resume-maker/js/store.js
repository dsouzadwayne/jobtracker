/**
 * Resume Maker - Zustand Store
 * Replaces custom pub/sub with atomic state management
 *
 * Benefits:
 * - Atomic state updates (all subscribers notified together)
 * - Immutable updates without manual deep copying via Immer
 * - Loading states to prevent race conditions
 * - Cleaner, more maintainable code
 */

import { saveBaseResume, saveGeneratedResume, createEmptyBaseResume, JobTrackerDB } from './db.js';

// Get Zustand and Immer from window (loaded via CDN)
// Zustand vanilla UMD exports createStore directly on window.zustandVanilla or window.zustand
const createStore = window.zustandVanilla?.createStore || window.zustand?.createStore || window.zustand;
const produce = window.immer?.produce || window.immer?.default?.produce;

// Debug logging for initialization
console.log('[Store] Zustand available:', !!createStore);
console.log('[Store] Immer available:', !!produce);

// Fallback check
if (!createStore || !produce) {
  console.error('[Store] Zustand or Immer not loaded. Check CDN scripts.');
}

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

// Create the store
export const resumeStore = createStore ? createStore((set, get) => ({
  // ==================== State ====================
  baseResume: null,
  currentResume: null,
  currentEditingResumeId: null,
  editingMode: 'base', // 'base' | 'generated'
  generatedResumes: [],
  currentTab: 'resumes',
  zoom: 100,
  isDirty: false,
  isLoading: false,  // Prevents race conditions during resume switching
  jobData: null,
  analysisResult: null,
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved' | 'error'
  lastSaveError: null,

  // ==================== Base Resume Actions ====================

  /**
   * Set the base resume
   * @param {Object} resume - The resume object
   * @param {Object} options - Options
   * @param {boolean} options.persist - If true, save to database
   * @param {boolean} options.markDirty - If true, mark as dirty for auto-save
   */
  setBaseResume: async (resume, options = {}) => {
    const { persist = false, markDirty = false } = options;

    set({
      baseResume: resume,
      currentResume: resume
    });

    if (persist && resume) {
      try {
        await saveBaseResume(resume);
      } catch (error) {
        console.error('[Store] Failed to persist base resume:', error);
      }
    }

    if (markDirty) {
      set({ isDirty: true });
    }
  },

  setCurrentResume: (resume) => set({ currentResume: resume }),

  // ==================== Generated Resume Editing ====================

  /**
   * Start editing a generated resume
   * Sets isLoading to prevent race conditions during form population
   * @param {string} resumeId - ID of the generated resume to edit
   * @returns {boolean} True if resume was found and editing started
   */
  startEditingGeneratedResume: (resumeId) => {
    const state = get();
    const resume = state.generatedResumes.find(r => r.id === resumeId);
    if (!resume) return false;

    // Set loading state and update atomically
    set({
      isLoading: true,
      currentEditingResumeId: resumeId,
      editingMode: 'generated',
      currentResume: produce(resume.baseResume, draft => {
        // Ensure complete structure exists
        if (!draft.profile) draft.profile = {};
        if (!draft.experience) draft.experience = { title: 'Experience', items: [] };
        if (!draft.education) draft.education = { title: 'Education', items: [] };
        if (!draft.projects) draft.projects = { title: 'Projects', items: [] };
        if (!draft.skills) draft.skills = { title: 'Skills', items: [] };
        if (!draft.custom) draft.custom = { title: 'Additional', items: [] };
      })
    });

    // Clear loading after microtask to ensure DOM updates complete
    queueMicrotask(() => set({ isLoading: false }));
    return true;
  },

  /**
   * Stop editing a generated resume and return to base resume
   */
  stopEditingGeneratedResume: () => set(state => ({
    currentEditingResumeId: null,
    editingMode: 'base',
    currentResume: state.baseResume
  })),

  /**
   * Get the current editing mode
   * @returns {{ mode: string, resumeId: string|null }}
   */
  getEditingMode: () => {
    const state = get();
    return {
      mode: state.editingMode,
      resumeId: state.currentEditingResumeId
    };
  },

  // ==================== Profile Updates with Immer ====================

  updateProfile: (field, value) => set(state => {
    // Ignore updates during loading to prevent race conditions
    if (state.isLoading) return state;

    // Validate field name
    if (!VALID_PROFILE_FIELDS.has(field)) {
      console.warn(`[Store] Invalid profile field: ${field}`);
      return state;
    }

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    let targetResume = state[target];

    // Initialize if needed
    if (!targetResume) {
      targetResume = createEmptyBaseResume();
    }

    const updated = produce(targetResume, draft => {
      if (!draft.profile) draft.profile = {};
      draft.profile[field] = value;
    });

    // Update both target and currentResume when editing base
    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  // ==================== Section Updates ====================

  addSectionItem: (section, item) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    let targetResume = state[target];
    if (!targetResume) {
      targetResume = createEmptyBaseResume();
    }

    const newItem = { ...item, id: JobTrackerDB.generateId() };

    const updated = produce(targetResume, draft => {
      if (!draft[section]) {
        draft[section] = {
          title: section.charAt(0).toUpperCase() + section.slice(1),
          items: []
        };
      }
      draft[section].items.push(newItem);
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  updateSectionItem: (section, itemId, updates) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    const targetResume = state[target];
    if (!targetResume?.[section]?.items) return state;

    const updated = produce(targetResume, draft => {
      const item = draft[section]?.items?.find(i => i.id === itemId);
      if (item) Object.assign(item, updates);
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  removeSectionItem: (section, itemId) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    const targetResume = state[target];
    if (!targetResume?.[section]?.items) return state;

    const updated = produce(targetResume, draft => {
      if (draft[section]?.items) {
        draft[section].items = draft[section].items.filter(i => i.id !== itemId);
      }
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  reorderSectionItems: (section, itemIds) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    const targetResume = state[target];
    if (!targetResume?.[section]?.items) return state;

    const updated = produce(targetResume, draft => {
      const itemMap = new Map(draft[section].items.map(item => [item.id, item]));
      draft[section].items = itemIds.map(id => itemMap.get(id)).filter(Boolean);
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  setSectionTitle: (section, title) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    let targetResume = state[target];
    if (!targetResume) {
      targetResume = createEmptyBaseResume();
    }

    const updated = produce(targetResume, draft => {
      if (!draft[section]) {
        draft[section] = { title, items: [] };
      } else {
        draft[section].title = title;
      }
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  // ==================== Skills ====================

  addSkill: (skill) => set(state => {
    if (state.isLoading) return state;

    const normalized = skill.trim();
    if (!normalized) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    let targetResume = state[target];
    if (!targetResume) {
      targetResume = createEmptyBaseResume();
    }

    // Check for duplicates
    const existing = targetResume?.skills?.items || [];
    if (existing.some(s => s.toLowerCase() === normalized.toLowerCase())) {
      return state; // Duplicate, no change
    }

    const updated = produce(targetResume, draft => {
      if (!draft.skills) draft.skills = { title: 'Skills', items: [] };
      draft.skills.items.push(normalized);
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  removeSkill: (skill) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    const targetResume = state[target];
    if (!targetResume?.skills?.items) return state;

    const updated = produce(targetResume, draft => {
      if (draft.skills?.items) {
        draft.skills.items = draft.skills.items.filter(
          s => s.toLowerCase() !== skill.toLowerCase()
        );
      }
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  setSkills: (skills) => set(state => {
    if (state.isLoading) return state;

    const target = state.editingMode === 'generated'
      ? 'currentResume'
      : 'baseResume';

    let targetResume = state[target];
    if (!targetResume) {
      targetResume = createEmptyBaseResume();
    }

    const updated = produce(targetResume, draft => {
      if (!draft.skills) draft.skills = { title: 'Skills', items: [] };
      draft.skills.items = [...skills];
    });

    if (target === 'baseResume') {
      return {
        baseResume: updated,
        currentResume: updated,
        isDirty: true
      };
    }

    return {
      [target]: updated,
      isDirty: true
    };
  }),

  // ==================== Resume Metadata (name, customSubtitle) ====================

  /**
   * Update resume metadata (name, customSubtitle)
   * These are stored on the generated resume object, not the baseResume
   * @param {string} field - 'name' or 'customSubtitle'
   * @param {string} value - The new value
   */
  updateResumeMeta: (field, value) => set(state => {
    if (state.isLoading) return state;

    // Only works when editing a generated resume
    if (state.editingMode !== 'generated' || !state.currentEditingResumeId) {
      console.warn('[Store] updateResumeMeta requires editing a generated resume');
      return state;
    }

    // Validate field
    if (field !== 'name' && field !== 'customSubtitle') {
      console.warn('[Store] Invalid resume meta field:', field);
      return state;
    }

    // Update the generated resume in the list
    const updatedResumes = state.generatedResumes.map(r => {
      if (r.id === state.currentEditingResumeId) {
        return {
          ...r,
          [field]: value,
          updatedAt: Date.now()
        };
      }
      return r;
    });

    return {
      generatedResumes: updatedResumes,
      isDirty: true
    };
  }),

  // ==================== Generated Resumes ====================

  setGeneratedResumes: (resumes) => set({ generatedResumes: resumes }),

  addGeneratedResume: (resume) => set(state => ({
    generatedResumes: [resume, ...state.generatedResumes]
  })),

  removeGeneratedResume: (id) => set(state => ({
    generatedResumes: state.generatedResumes.filter(r => r.id !== id)
  })),

  updateGeneratedResume: (id, updates) => set(state => ({
    generatedResumes: state.generatedResumes.map(r =>
      r.id === id ? { ...r, ...updates } : r
    )
  })),

  // ==================== UI State ====================

  setCurrentTab: (tab) => set({ currentTab: tab }),
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(150, zoom)) }),
  setJobData: (data) => set({ jobData: data }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setSaveStatus: (status, error = null) => set({ saveStatus: status, lastSaveError: error }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setLoading: (loading) => set({ isLoading: loading })
})) : null;

// ==================== Subscription Helpers ====================

/**
 * Subscribe to specific state slices with shallow comparison
 * @param {Function} selector - Function to select state slice
 * @param {Function} callback - Called when selected state changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(selector, callback) {
  if (!resumeStore) return () => {};

  return resumeStore.subscribe((state, prevState) => {
    const curr = selector(state);
    const prev = selector(prevState);
    if (curr !== prev) {
      callback(curr, state);
    }
  });
}

/**
 * Subscribe to save status changes
 * @param {Function} callback - Called with (status, error)
 * @returns {Function} Unsubscribe function
 */
export function subscribeSaveStatus(callback) {
  if (!resumeStore) return () => {};

  // Call immediately with current status
  const state = resumeStore.getState();
  callback(state.saveStatus, state.lastSaveError);

  return resumeStore.subscribe((state, prevState) => {
    if (state.saveStatus !== prevState.saveStatus ||
        state.lastSaveError !== prevState.lastSaveError) {
      callback(state.saveStatus, state.lastSaveError);
    }
  });
}

// ==================== Convenience Getters ====================

export const getState = () => resumeStore?.getState() || {};
export const getBaseResume = () => resumeStore?.getState()?.baseResume || null;
export const getCurrentResume = () => {
  const state = resumeStore?.getState();
  return state?.currentResume || state?.baseResume || null;
};
export const getGeneratedResumes = () => resumeStore?.getState()?.generatedResumes || [];
export const getEditingMode = () => {
  const state = resumeStore?.getState();
  return {
    mode: state?.editingMode || 'base',
    resumeId: state?.currentEditingResumeId || null
  };
};
export const isLoading = () => resumeStore?.getState()?.isLoading || false;
export const getCurrentTab = () => resumeStore?.getState()?.currentTab || 'resumes';
export const getZoom = () => resumeStore?.getState()?.zoom || 100;
export const getJobData = () => resumeStore?.getState()?.jobData || null;
export const getAnalysisResult = () => resumeStore?.getState()?.analysisResult || null;
export const getSaveStatus = () => {
  const state = resumeStore?.getState();
  return {
    status: state?.saveStatus || 'saved',
    error: state?.lastSaveError || null
  };
};

// ==================== Store Actions (convenience wrappers) ====================

export const setBaseResume = (resume, options) => resumeStore?.getState()?.setBaseResume(resume, options);
export const setCurrentResume = (resume) => resumeStore?.getState()?.setCurrentResume(resume);
export const startEditingGeneratedResume = (id) => resumeStore?.getState()?.startEditingGeneratedResume(id);
export const stopEditingGeneratedResume = () => resumeStore?.getState()?.stopEditingGeneratedResume();
export const updateProfile = (field, value) => resumeStore?.getState()?.updateProfile(field, value);
export const addSectionItem = (section, item) => resumeStore?.getState()?.addSectionItem(section, item);
export const updateSectionItem = (section, itemId, updates) => resumeStore?.getState()?.updateSectionItem(section, itemId, updates);
export const removeSectionItem = (section, itemId) => resumeStore?.getState()?.removeSectionItem(section, itemId);
export const reorderSectionItems = (section, itemIds) => resumeStore?.getState()?.reorderSectionItems(section, itemIds);
export const setSectionTitle = (section, title) => resumeStore?.getState()?.setSectionTitle(section, title);
export const addSkill = (skill) => resumeStore?.getState()?.addSkill(skill);
export const removeSkill = (skill) => resumeStore?.getState()?.removeSkill(skill);
export const setSkills = (skills) => resumeStore?.getState()?.setSkills(skills);
export const setGeneratedResumes = (resumes) => resumeStore?.getState()?.setGeneratedResumes(resumes);
export const addGeneratedResume = (resume) => resumeStore?.getState()?.addGeneratedResume(resume);
export const removeGeneratedResume = (id) => resumeStore?.getState()?.removeGeneratedResume(id);
export const updateGeneratedResume = (id, updates) => resumeStore?.getState()?.updateGeneratedResume?.(id, updates);
export const setCurrentTab = (tab) => resumeStore?.getState()?.setCurrentTab(tab);
export const setZoom = (zoom) => resumeStore?.getState()?.setZoom(zoom);
export const setJobData = (data) => resumeStore?.getState()?.setJobData(data);
export const setAnalysisResult = (result) => resumeStore?.getState()?.setAnalysisResult(result);
export const setSaveStatus = (status, error) => resumeStore?.getState()?.setSaveStatus(status, error);
export const setDirty = (dirty) => resumeStore?.getState()?.setDirty(dirty);
export const updateResumeMeta = (field, value) => resumeStore?.getState()?.updateResumeMeta(field, value);
