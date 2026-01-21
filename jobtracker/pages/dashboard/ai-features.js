/**
 * Dashboard AI Features Module
 * Provides UI for AI-powered features:
 * - Smart tag suggestions
 * - Resume parsing
 * - Job posting extraction
 * - Skill matching
 *
 * NOTE: AI features are disabled by default.
 * Users must enable them in settings.
 */

import { aiService } from '../../lib/ai-service.js';
import { elements, MessageTypes, getApplications, getCachedSettings } from './state.js';
import { escapeHtml, showNotification } from './utils.js';

// Extend MessageTypes for settings functionality (will be merged with state.js types)
const SettingsMessageTypes = {
  GET_APPLICATIONS_SIZE: 'GET_APPLICATIONS_SIZE',
  GET_PROFILE_SIZE: 'GET_PROFILE_SIZE',
  GET_MODELS_STATUS: 'GET_MODELS_STATUS',
  SET_MODEL_METADATA: 'SET_MODEL_METADATA',
  CLEAR_MODELS_METADATA: 'CLEAR_MODELS_METADATA',
  CLEAR_PROFILE: 'CLEAR_PROFILE',
  CLEAR_APPLICATIONS: 'CLEAR_APPLICATIONS',
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA'
};

// Track AI status
let aiInitialized = false;
let aiAvailable = false;
let aiEnabled = false;  // Controlled by settings

// Track toasts being created to prevent race conditions (fixes duplicate toast bug)
const toastsBeingCreated = new Set();

// Track event listener cleanup (fixes listener accumulation bug)
let modelDownloadListenersInitialized = false;
const modelDownloadListenerCleanup = [];

/**
 * Check if AI is enabled in settings
 */
export function isAIEnabled() {
  const settings = getCachedSettings();
  return settings?.ai?.enabled === true;
}

/**
 * Initialize AI features (only if enabled in settings)
 */
export async function initAI() {
  // Check settings first
  aiEnabled = isAIEnabled();

  if (!aiEnabled) {
    console.log('[AI Features] Disabled in settings. Skipping initialization.');
    return false;
  }

  try {
    await aiService.init();
    aiAvailable = aiService.isMLAvailable();
    aiInitialized = true;

    // Set up progress callback
    aiService.setProgressCallback((progress) => {
      console.log(`[AI] Loading ${progress.model}: ${progress.progress}%`);
      updateLoadingIndicator(progress);
    });

    console.log(`[AI Features] Initialized. ML available: ${aiAvailable}`);
    return true;
  } catch (error) {
    console.log('[AI Features] Failed to initialize:', error);
    return false;
  }
}

/**
 * Enable AI features (call after user enables in settings)
 */
export async function enableAI() {
  aiEnabled = true;
  if (!aiInitialized) {
    return await initAI();
  }
  return true;
}

/**
 * Disable AI features
 */
export function disableAI() {
  aiEnabled = false;
  console.log('[AI Features] Disabled');
}

/**
 * Show model download toast notification
 */
function showModelDownloadToast(modelName, size) {
  // Check if toast already exists or is being created (fixes race condition)
  const existingToast = document.getElementById(`model-toast-${modelName}`);
  if (existingToast || toastsBeingCreated.has(modelName)) return;

  // Mark as being created to prevent duplicate creation from rapid events
  toastsBeingCreated.add(modelName);

  const toast = document.createElement('div');
  toast.className = 'model-download-toast';
  toast.id = `model-toast-${modelName}`;
  toast.innerHTML = `
    <div class="toast-header">
      <span class="icon">&#11015;</span>
      <span class="title">Downloading ${modelName === 'embeddings' ? 'Embeddings' : 'NER'} Model</span>
      <span class="size">${size}MB</span>
    </div>
    <div class="download-progress-bar">
      <div class="download-progress-fill" style="width: 0%"></div>
    </div>
    <div class="toast-details">
      <span class="progress-text">0%</span>
      <span class="status-text">Preparing download...</span>
    </div>
  `;
  document.body.appendChild(toast);

  // Clear from tracking set after toast is added to DOM
  toastsBeingCreated.delete(modelName);
}

/**
 * Update model download progress
 */
function updateModelDownloadProgress(modelName, progress, loaded, total) {
  const toast = document.getElementById(`model-toast-${modelName}`);
  if (!toast) return;

  const progressFill = toast.querySelector('.download-progress-fill');
  const progressText = toast.querySelector('.progress-text');
  const statusText = toast.querySelector('.status-text');

  if (progressFill) progressFill.style.width = `${progress}%`;
  if (progressText) progressText.textContent = `${progress}%`;

  if (statusText && loaded && total) {
    const loadedMB = (loaded / 1024 / 1024).toFixed(1);
    const totalMB = (total / 1024 / 1024).toFixed(1);
    statusText.textContent = `${loadedMB} MB / ${totalMB} MB`;
  }
}

/**
 * Complete model download toast
 */
function completeModelDownload(modelName) {
  const toast = document.getElementById(`model-toast-${modelName}`);
  if (!toast) return;

  const icon = toast.querySelector('.icon');
  const title = toast.querySelector('.title');
  const statusText = toast.querySelector('.status-text');
  const progressFill = toast.querySelector('.download-progress-fill');

  if (icon) icon.textContent = '\u2713'; // Checkmark
  if (title) title.textContent = 'Model Downloaded';
  if (statusText) statusText.textContent = 'Cached for offline use';
  if (progressFill) progressFill.style.width = '100%';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Show model download error
 */
function showModelDownloadError(modelName, error) {
  const toast = document.getElementById(`model-toast-${modelName}`);
  if (!toast) return;

  const icon = toast.querySelector('.icon');
  const title = toast.querySelector('.title');
  const statusText = toast.querySelector('.status-text');

  if (icon) icon.textContent = '\u2717'; // X mark
  if (title) title.textContent = 'Download Failed';
  if (statusText) statusText.textContent = error || 'Please try again';

  toast.style.borderColor = 'var(--color-danger)';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Update loading indicator during model download (enhanced with toast)
 */
function updateLoadingIndicator(progress) {
  const { model, status, progress: pct, loaded, total, size } = progress;

  // Show toast on initiate
  if (status === 'initiate') {
    showModelDownloadToast(model, size || (model === 'embeddings' ? 23 : 109));
  }

  // Update progress
  if (status === 'downloading' || status === 'progress') {
    updateModelDownloadProgress(model, pct || 0, loaded, total);
  }

  // Legacy indicator support
  let indicator = document.getElementById('ai-loading-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'ai-loading-indicator';
    indicator.className = 'ai-loading-indicator hidden';
    document.body.appendChild(indicator);
  }
}

/**
 * Setup global event listeners for model downloads
 * Includes cleanup tracking to prevent listener accumulation on re-initialization
 */
export function setupModelDownloadListeners() {
  // Prevent duplicate listener registration (fixes listener accumulation bug)
  if (modelDownloadListenersInitialized) {
    console.log('[AI Features] Model download listeners already initialized, skipping');
    return;
  }

  // Define listener functions so we can remove them later
  const progressListener = (event) => {
    const { model, status, progress, loaded, total, size } = event.detail;

    if (status === 'initiate') {
      showModelDownloadToast(model, size || (model === 'embeddings' ? 23 : 109));
    }

    if (status === 'downloading') {
      updateModelDownloadProgress(model, progress, loaded, total);
    }
  };

  const completeListener = async (event) => {
    const { model } = event.detail;
    completeModelDownload(model);

    // Save metadata to database
    try {
      await chrome.runtime.sendMessage({
        type: SettingsMessageTypes.SET_MODEL_METADATA,
        payload: { modelId: model, downloadStatus: 'downloaded', downloadedAt: new Date().toISOString() }
      });
      // Refresh storage sizes if on settings page
      if (document.getElementById('settings-section')?.classList.contains('hidden') === false) {
        loadStorageSizes();
      }
    } catch (error) {
      console.log('[AI Features] Failed to save model metadata:', error);
    }
  };

  const errorListener = (event) => {
    const { model, error } = event.detail;
    showModelDownloadError(model, error);
  };

  // Add listeners
  window.addEventListener('model-download-progress', progressListener);
  window.addEventListener('model-download-complete', completeListener);
  window.addEventListener('model-download-error', errorListener);

  // Store cleanup functions for later removal
  modelDownloadListenerCleanup.push(
    () => window.removeEventListener('model-download-progress', progressListener),
    () => window.removeEventListener('model-download-complete', completeListener),
    () => window.removeEventListener('model-download-error', errorListener)
  );

  modelDownloadListenersInitialized = true;
  console.log('[AI Features] Model download listeners initialized');
}

/**
 * Remove model download event listeners
 * Call this when navigating away or cleaning up
 */
export function removeModelDownloadListeners() {
  modelDownloadListenerCleanup.forEach(cleanup => cleanup());
  modelDownloadListenerCleanup.length = 0;
  modelDownloadListenersInitialized = false;
  console.log('[AI Features] Model download listeners removed');
}

/**
 * Get smart tag suggestions for text
 * @param {string} text - Job description or notes
 * @returns {string[]} Suggested tags
 */
export async function getSmartTags(text) {
  if (!aiEnabled) return [];  // AI disabled

  const settings = getCachedSettings();
  if (!settings?.ai?.autoSuggestTags) return [];  // Tag suggestions disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return [];  // Failed to initialize

  try {
    // Always try ML first, falls back to regex in worker
    const tags = await aiService.suggestTags(text);
    return tags || [];
  } catch (error) {
    console.log('[AI Features] Tag suggestion failed:', error);
    return [];
  }
}

/**
 * Parse resume text and extract structured data
 * @param {string} text - Resume content
 * @returns {Object} Extracted data
 */
export async function parseResumeText(text) {
  if (!aiEnabled) return null;  // AI disabled

  const settings = getCachedSettings();
  if (!settings?.ai?.enhanceResumeParsing) return null;

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return null;

  try {
    const result = await aiService.parseResume(text, aiAvailable);
    return result;
  } catch (error) {
    console.log('[AI Features] Resume parsing failed:', error);
    // Return basic regex extraction as fallback
    return await aiService.extractBasic(text);
  }
}

/**
 * Parse job posting and extract structured data
 * @param {string} text - Job posting content
 * @returns {Object} Extracted data
 */
export async function parseJobText(text) {
  if (!aiEnabled) return null;  // AI disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return null;

  try {
    const result = await aiService.parseJobPosting(text, aiAvailable);
    return result;
  } catch (error) {
    console.log('[AI Features] Job parsing failed:', error);
    return await aiService.extractBasic(text);
  }
}

/**
 * Match resume against job posting
 * @param {string} resumeText - Resume content
 * @param {string} jobText - Job posting content
 * @returns {Object} Match analysis
 */
export async function matchResumeToJob(resumeText, jobText) {
  if (!aiEnabled) return null;  // AI disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return null;

  try {
    return await aiService.matchResumeToJob(resumeText, jobText);
  } catch (error) {
    console.log('[AI Features] Matching failed:', error);
    return null;
  }
}

/**
 * Extract skills from text
 * @param {string} text - Text to analyze
 * @returns {Object} Skills by category
 */
export async function extractSkills(text) {
  if (!aiEnabled) return {};  // AI disabled

  if (!aiInitialized) await initAI();
  if (!aiInitialized) return {};

  try {
    return await aiService.extractSkills(text);
  } catch (error) {
    console.log('[AI Features] Skill extraction failed:', error);
    return {};
  }
}

/**
 * Render AI tag suggestions UI
 * @param {HTMLElement} container - Container element
 * @param {string} text - Text to analyze
 * @param {function} onSelect - Callback when tag is selected
 */
export async function renderTagSuggestions(container, text, onSelect) {
  // Check if AI is enabled
  if (!aiEnabled) {
    container.innerHTML = '';  // Hide container if AI disabled
    return;
  }

  if (!text || text.length < 50) {
    container.innerHTML = '<span class="text-muted">Add more text for suggestions</span>';
    return;
  }

  container.innerHTML = '<span class="text-muted">Analyzing...</span>';

  try {
    const tags = await getSmartTags(text);

    if (tags.length === 0) {
      container.innerHTML = '<span class="text-muted">No suggestions</span>';
      return;
    }

    container.innerHTML = tags.map(tag => `
      <button type="button" class="suggested-tag" data-tag="${escapeHtml(tag)}">
        + ${escapeHtml(tag)}
      </button>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.suggested-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        onSelect(tag);
        btn.remove();
      });
    });
  } catch (error) {
    container.innerHTML = '<span class="text-muted">Suggestions unavailable</span>';
  }
}

/**
 * Render skill match visualization
 * @param {HTMLElement} container - Container element
 * @param {Object} matchResult - Result from matchResumeToJob
 */
export function renderSkillMatch(container, matchResult) {
  if (!matchResult) {
    container.innerHTML = '<p class="text-muted">Unable to analyze match</p>';
    return;
  }

  const { matchPercentage, matchingSkills, missingSkills, overallSimilarity } = matchResult;

  // Color based on match percentage
  let matchColor = 'var(--color-danger)';
  if (matchPercentage >= 70) matchColor = 'var(--color-success)';
  else if (matchPercentage >= 40) matchColor = 'var(--color-warning)';

  container.innerHTML = `
    <div class="skill-match-result">
      <div class="match-score" style="--match-color: ${matchColor}">
        <div class="match-percentage">${matchPercentage}%</div>
        <div class="match-label">Skill Match</div>
      </div>

      <div class="match-details">
        <div class="match-section">
          <h5>✓ Matching Skills (${matchingSkills.length})</h5>
          <div class="skill-chips matching">
            ${matchingSkills.length > 0
              ? matchingSkills.map(s => `<span class="skill-chip match">${escapeHtml(s)}</span>`).join('')
              : '<span class="text-muted">None found</span>'
            }
          </div>
        </div>

        <div class="match-section">
          <h5>✗ Missing Skills (${missingSkills.length})</h5>
          <div class="skill-chips missing">
            ${missingSkills.length > 0
              ? missingSkills.slice(0, 10).map(s => `<span class="skill-chip missing">${escapeHtml(s)}</span>`).join('')
              : '<span class="text-muted">None - great match!</span>'
            }
            ${missingSkills.length > 10 ? `<span class="text-muted">+${missingSkills.length - 10} more</span>` : ''}
          </div>
        </div>

        ${overallSimilarity !== undefined ? `
          <div class="similarity-bar">
            <label>Content Similarity</label>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${Math.round(overallSimilarity * 100)}%"></div>
            </div>
            <span>${Math.round(overallSimilarity * 100)}%</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Auto-fill application form from job posting
 * @param {string} jobText - Job posting text
 * @returns {Object} Extracted application data
 */
export async function autofillFromJobPosting(jobText) {
  const parsed = await parseJobText(jobText);

  return {
    company: parsed.entities?.organizations?.[0] || parsed.company || '',
    position: '', // Hard to extract reliably
    location: parsed.entities?.locations?.join(', ') || parsed.location || '',
    salary: parsed.salary || '',
    jobType: parsed.jobType || '',
    tags: parsed.suggestedTags || [],
    skills: parsed.skills || {}
  };
}

/**
 * Get AI status info for display
 */
export function getAIStatus() {
  return {
    enabled: aiEnabled,
    initialized: aiInitialized,
    mlAvailable: aiAvailable,
    mode: !aiEnabled ? 'Disabled' : (aiAvailable ? 'ML + Regex' : 'Regex Only')
  };
}

/**
 * Preload AI models for faster subsequent use
 */
export async function preloadModels() {
  if (!aiInitialized) await initAI();

  if (!aiAvailable) {
    console.log('[AI Features] ML not available, skipping preload');
    return false;
  }

  try {
    showNotification('Loading AI models...', 'info');
    await aiService.preloadModels(false); // Don't preload NER by default (saves memory)
    showNotification('AI models ready!', 'success');
    return true;
  } catch (error) {
    console.log('[AI Features] Preload failed:', error);
    showNotification('AI models failed to load', 'error');
    return false;
  }
}

/**
 * Clean up AI resources
 */
export async function cleanup() {
  // Remove event listeners to prevent accumulation
  removeModelDownloadListeners();

  if (aiInitialized) {
    await aiService.unloadModels();
    aiService.terminate();
    aiInitialized = false;
  }
}

// ==================== SETTINGS FUNCTIONALITY ====================

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Load and display storage sizes in settings
 */
export async function loadStorageSizes() {
  try {
    // Get applications size
    const appsResponse = await chrome.runtime.sendMessage({ type: SettingsMessageTypes.GET_APPLICATIONS_SIZE });
    const appsSize = appsResponse?.size || 0;
    const appsSizeEl = document.getElementById('applications-size');
    if (appsSizeEl) appsSizeEl.textContent = formatBytes(appsSize);

    // Get profile size
    const profileResponse = await chrome.runtime.sendMessage({ type: SettingsMessageTypes.GET_PROFILE_SIZE });
    const profileSize = profileResponse?.size || 0;
    const profileSizeEl = document.getElementById('profile-size');
    if (profileSizeEl) profileSizeEl.textContent = formatBytes(profileSize);

    // Estimate models cache size (if downloaded)
    const modelsStatus = await chrome.runtime.sendMessage({ type: SettingsMessageTypes.GET_MODELS_STATUS });
    let modelsCacheSize = 0;
    if (modelsStatus?.embeddings?.downloadStatus === 'downloaded') {
      modelsCacheSize += 23 * 1024 * 1024; // 23 MB
    }
    if (modelsStatus?.ner?.downloadStatus === 'downloaded') {
      modelsCacheSize += 109 * 1024 * 1024; // 109 MB
    }
    const modelsSizeEl = document.getElementById('models-cache-size');
    if (modelsSizeEl) modelsSizeEl.textContent = modelsCacheSize > 0 ? formatBytes(modelsCacheSize) : 'Not downloaded';

    // Update model status badges
    updateModelStatusBadge('embeddings', modelsStatus?.embeddings?.downloadStatus);
    updateModelStatusBadge('ner', modelsStatus?.ner?.downloadStatus);

    // Update preload button state based on download status
    const preloadBtn = document.getElementById('preload-models-btn');
    if (preloadBtn) {
      const allDownloaded = modelsStatus?.embeddings?.downloadStatus === 'downloaded' &&
                            modelsStatus?.ner?.downloadStatus === 'downloaded';
      if (allDownloaded) {
        preloadBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Models Downloaded
        `;
        preloadBtn.classList.add('downloaded');
      } else {
        preloadBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download All Models (132 MB)
        `;
        preloadBtn.classList.remove('downloaded');
      }
    }

    // Calculate total
    const totalSize = appsSize + profileSize + modelsCacheSize;
    const totalSizeEl = document.getElementById('total-storage-size');
    if (totalSizeEl) totalSizeEl.textContent = formatBytes(totalSize);

    // Update cache info
    const cacheInfoEl = document.getElementById('models-cache-info');
    if (cacheInfoEl) {
      if (modelsStatus?.embeddings?.downloadStatus === 'downloaded' && modelsStatus?.ner?.downloadStatus === 'downloaded') {
        cacheInfoEl.textContent = 'All models downloaded and ready for offline use';
      } else if (modelsStatus?.embeddings?.downloadStatus === 'downloaded' || modelsStatus?.ner?.downloadStatus === 'downloaded') {
        cacheInfoEl.textContent = 'Some models downloaded. Download all for full offline capability.';
      } else {
        cacheInfoEl.textContent = 'Models will be cached for offline use after download';
      }
    }
  } catch (error) {
    console.log('[Settings] Failed to load storage sizes:', error);
  }
}

/**
 * Update model status badge
 */
function updateModelStatusBadge(modelName, status) {
  const badge = document.getElementById(`${modelName}-status`);
  if (!badge) return;

  badge.classList.remove('not-downloaded', 'downloading', 'downloaded', 'failed');

  switch (status) {
    case 'downloaded':
      badge.textContent = 'Downloaded';
      badge.classList.add('downloaded');
      break;
    case 'downloading':
      badge.textContent = 'Downloading...';
      badge.classList.add('downloading');
      break;
    case 'failed':
      badge.textContent = 'Failed';
      badge.classList.add('failed');
      break;
    default:
      badge.textContent = 'Not Downloaded';
      badge.classList.add('not-downloaded');
  }
}


// ==================== DASHBOARD SETTINGS FUNCTIONALITY ====================

// Theme Management (synced with profile page)
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async getTheme() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY]?.theme || 'system';
    } catch {
      return 'system';
    }
  },

  async setTheme(theme) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const prefs = result[this.STORAGE_KEY] || {};
      prefs.theme = theme;
      await chrome.storage.local.set({ [this.STORAGE_KEY]: prefs });
      this.applyTheme(theme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  },

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    this.updateThemeSelector(theme);
  },

  updateThemeSelector(theme) {
    document.querySelectorAll('#theme-selector .theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }
};

// Settings state
let dashboardSettings = null;

/**
 * Load and populate all dashboard settings
 */
export async function loadDashboardSettings() {
  try {
    // Load settings from background
    dashboardSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

    // Populate autofill settings
    const autofillEnabled = document.getElementById('setting-autofill-enabled');
    const floatingBtn = document.getElementById('setting-floating-btn');
    const delaySlider = document.getElementById('setting-autofill-delay');
    const delayValue = document.getElementById('delay-value');

    if (autofillEnabled) autofillEnabled.checked = dashboardSettings?.autofill?.enabled ?? true;
    if (floatingBtn) floatingBtn.checked = dashboardSettings?.autofill?.showFloatingButton ?? true;
    if (delaySlider) {
      delaySlider.value = dashboardSettings?.autofill?.delay || 0;
      if (delayValue) delayValue.textContent = formatDelay(delaySlider.value);
    }

    // Load and display theme
    const currentTheme = await ThemeManager.getTheme();
    ThemeManager.updateThemeSelector(currentTheme);

    // Render custom rules
    renderCustomRules();

    // Load storage sizes
    loadStorageSizes();

    console.log('[Dashboard Settings] Loaded successfully');
  } catch (error) {
    console.log('[Dashboard Settings] Failed to load:', error);
  }
}

/**
 * Format delay value for display
 */
function formatDelay(ms) {
  const seconds = parseInt(ms) / 1000;
  return seconds === 0 ? '0s' : `${seconds}s`;
}

/**
 * Save autofill settings
 */
async function saveAutofillSettings() {
  if (!dashboardSettings) {
    dashboardSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  }

  dashboardSettings.autofill = dashboardSettings.autofill || {};
  dashboardSettings.autofill.enabled = document.getElementById('setting-autofill-enabled')?.checked ?? true;
  dashboardSettings.autofill.showFloatingButton = document.getElementById('setting-floating-btn')?.checked ?? true;
  dashboardSettings.autofill.delay = parseInt(document.getElementById('setting-autofill-delay')?.value) || 0;

  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: dashboardSettings });
  showNotification('Settings saved', 'success');
}

/**
 * Render custom field rules list
 */
function renderCustomRules() {
  const list = document.getElementById('custom-rules-list');
  const empty = document.getElementById('rules-empty');
  const rules = dashboardSettings?.customFieldRules || [];

  if (!list || !empty) return;

  list.innerHTML = '';

  if (rules.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  rules.forEach(rule => {
    list.appendChild(createRuleCard(rule));
  });
}

/**
 * Create a rule card element
 */
function createRuleCard(rule) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.innerHTML = `
    <div class="entry-info">
      <div class="entry-title">${escapeHtml(rule.name)}</div>
      <div class="entry-subtitle"><code>${escapeHtml(rule.pattern)}</code> → ${escapeHtml(rule.profilePath)}</div>
      <div class="entry-meta">${rule.enabled ? 'Enabled' : 'Disabled'}</div>
    </div>
    <div class="entry-actions">
      <button class="edit" title="Edit" data-id="${escapeHtml(rule.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="delete" title="Delete" data-id="${escapeHtml(rule.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  card.querySelector('.edit').addEventListener('click', () => openRuleModal(rule));
  card.querySelector('.delete').addEventListener('click', () => deleteRule(rule.id));

  return card;
}

/**
 * Open rule modal for add/edit
 */
function openRuleModal(rule = null) {
  const modal = document.getElementById('rule-modal');
  const title = document.getElementById('rule-modal-title');
  const form = document.getElementById('rule-form');

  if (!modal || !form) return;

  title.textContent = rule ? 'Edit Custom Rule' : 'Add Custom Rule';
  form.reset();
  document.getElementById('pattern-error')?.classList.add('hidden');

  if (rule) {
    document.getElementById('rule-id').value = rule.id;
    document.getElementById('rule-name').value = rule.name || '';
    document.getElementById('rule-pattern').value = rule.pattern || '';
    document.getElementById('rule-profile-path').value = rule.profilePath || 'personal.email';
    document.getElementById('rule-enabled').checked = rule.enabled !== false;
  } else {
    document.getElementById('rule-id').value = '';
    document.getElementById('rule-enabled').checked = true;
  }

  modal.classList.remove('hidden');
}

/**
 * Handle rule form submission
 */
async function handleRuleSubmit(e) {
  e.preventDefault();

  const pattern = document.getElementById('rule-pattern').value.trim();

  // Validate regex
  try {
    new RegExp(pattern, 'i');
  } catch (err) {
    document.getElementById('pattern-error')?.classList.remove('hidden');
    return;
  }
  document.getElementById('pattern-error')?.classList.add('hidden');

  const id = document.getElementById('rule-id').value;
  const rule = {
    id: id || generateId(),
    name: document.getElementById('rule-name').value.trim(),
    pattern: pattern,
    profilePath: document.getElementById('rule-profile-path').value,
    enabled: document.getElementById('rule-enabled').checked
  };

  if (!dashboardSettings) {
    dashboardSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  }

  dashboardSettings.customFieldRules = dashboardSettings.customFieldRules || [];

  if (id) {
    const index = dashboardSettings.customFieldRules.findIndex(r => r.id === id);
    if (index !== -1) dashboardSettings.customFieldRules[index] = rule;
  } else {
    dashboardSettings.customFieldRules.push(rule);
  }

  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: dashboardSettings });
  document.getElementById('rule-modal').classList.add('hidden');
  renderCustomRules();
  showNotification('Rule saved', 'success');
}

/**
 * Delete a custom rule
 */
async function deleteRule(id) {
  if (!confirm('Delete this custom rule?')) return;

  if (!dashboardSettings) {
    dashboardSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  }

  dashboardSettings.customFieldRules = (dashboardSettings.customFieldRules || []).filter(r => r.id !== id);
  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: dashboardSettings });
  renderCustomRules();
  showNotification('Rule deleted', 'success');
}

/**
 * Generate unique ID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Handle profile data export
 */
async function handleExport() {
  try {
    const data = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobtracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.log('Error exporting data:', error);
    showNotification('Failed to export data', 'error');
  }
}

/**
 * Handle profile data import
 */
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !data.profile) {
      throw new Error('Invalid import file format');
    }

    const merge = confirm('Do you want to merge with existing data? Click Cancel to replace all data.');

    await chrome.runtime.sendMessage({
      type: 'IMPORT_DATA',
      payload: { data, merge }
    });

    showNotification('Data imported successfully!', 'success');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    console.log('Error importing data:', error);
    showNotification('Failed to import data. Check file format.', 'error');
  }

  e.target.value = '';
}

/**
 * Setup all settings event listeners
 */
export function setupSettingsListeners() {
  // Theme selector
  document.querySelectorAll('#theme-selector .theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      ThemeManager.setTheme(btn.dataset.theme);
    });
  });

  // Autofill settings
  const autofillEnabled = document.getElementById('setting-autofill-enabled');
  const floatingBtn = document.getElementById('setting-floating-btn');
  const delaySlider = document.getElementById('setting-autofill-delay');
  const delayValue = document.getElementById('delay-value');

  if (autofillEnabled) autofillEnabled.addEventListener('change', saveAutofillSettings);
  if (floatingBtn) floatingBtn.addEventListener('change', saveAutofillSettings);
  if (delaySlider) {
    delaySlider.addEventListener('input', (e) => {
      if (delayValue) delayValue.textContent = formatDelay(e.target.value);
    });
    delaySlider.addEventListener('change', saveAutofillSettings);
  }

  // Custom rules
  const addRuleBtn = document.getElementById('add-rule-btn');
  const ruleForm = document.getElementById('rule-form');
  const closeRuleModal = document.getElementById('close-rule-modal');
  const cancelRuleBtn = document.getElementById('cancel-rule-btn');
  const ruleModal = document.getElementById('rule-modal');

  if (addRuleBtn) addRuleBtn.addEventListener('click', () => openRuleModal());
  if (ruleForm) ruleForm.addEventListener('submit', handleRuleSubmit);
  if (closeRuleModal) closeRuleModal.addEventListener('click', () => ruleModal?.classList.add('hidden'));
  if (cancelRuleBtn) cancelRuleBtn.addEventListener('click', () => ruleModal?.classList.add('hidden'));
  if (ruleModal) {
    ruleModal.addEventListener('click', (e) => {
      if (e.target === ruleModal) ruleModal.classList.add('hidden');
    });
  }

  // Import/Export
  const exportBtn = document.getElementById('settings-export-btn');
  const importBtn = document.getElementById('settings-import-btn');
  const importFile = document.getElementById('settings-import-file');

  if (exportBtn) exportBtn.addEventListener('click', handleExport);
  if (importBtn) importBtn.addEventListener('click', () => importFile?.click());
  if (importFile) importFile.addEventListener('change', handleImport);

  // Preload models button
  const preloadBtn = document.getElementById('preload-models-btn');
  if (preloadBtn) {
    preloadBtn.addEventListener('click', async () => {
      preloadBtn.disabled = true;
      preloadBtn.textContent = 'Downloading...';

      try {
        // Mark status as downloading
        updateModelStatusBadge('embeddings', 'downloading');
        updateModelStatusBadge('ner', 'downloading');

        // Initialize AI and preload both models
        if (!aiInitialized) await initAI();
        await aiService.preloadModels(true); // true = include NER

        // Update status to downloaded
        await chrome.runtime.sendMessage({
          type: SettingsMessageTypes.SET_MODEL_METADATA,
          payload: { modelId: 'embeddings', downloadStatus: 'downloaded', downloadedAt: new Date().toISOString() }
        });
        await chrome.runtime.sendMessage({
          type: SettingsMessageTypes.SET_MODEL_METADATA,
          payload: { modelId: 'ner', downloadStatus: 'downloaded', downloadedAt: new Date().toISOString() }
        });

        updateModelStatusBadge('embeddings', 'downloaded');
        updateModelStatusBadge('ner', 'downloaded');
        showNotification('Models downloaded successfully!', 'success');
        loadStorageSizes();
      } catch (error) {
        console.log('[Settings] Model download failed:', error);
        updateModelStatusBadge('embeddings', 'failed');
        updateModelStatusBadge('ner', 'failed');
        showNotification('Download failed. Check your internet connection.', 'error');
      } finally {
        preloadBtn.disabled = false;

        // Check if models were successfully downloaded
        const modelsStatus = await chrome.runtime.sendMessage({
          type: SettingsMessageTypes.GET_MODELS_STATUS
        });

        const allDownloaded = modelsStatus?.embeddings?.downloadStatus === 'downloaded' &&
                              modelsStatus?.ner?.downloadStatus === 'downloaded';

        if (allDownloaded) {
          preloadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Models Downloaded
          `;
          preloadBtn.classList.add('downloaded');
        } else {
          preloadBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download All Models (132 MB)
          `;
          preloadBtn.classList.remove('downloaded');
        }
      }
    });
  }

  // Clear AI models button (in data management section)
  const clearAiModelsBtn = document.getElementById('clear-ai-models-btn');
  if (clearAiModelsBtn) {
    clearAiModelsBtn.addEventListener('click', async () => {
      if (!confirm('Clear AI models cache?')) return;
      try {
        // Unload models from worker memory first (worker stays running for re-download)
        if (aiInitialized) {
          await aiService.unloadModels();
        }

        await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_MODELS_METADATA });
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            if (name.includes('transformers') || name.includes('onnx')) {
              await caches.delete(name);
            }
          }
        }
        updateModelStatusBadge('embeddings', 'not_downloaded');
        updateModelStatusBadge('ner', 'not_downloaded');
        showNotification('AI models cache cleared', 'success');
        loadStorageSizes();
      } catch (error) {
        console.log('[Settings] Failed to clear models:', error);
        showNotification('Failed to clear models cache', 'error');
      }
    });
  }

  // Clear profile button
  const clearProfileBtn = document.getElementById('clear-profile-btn');
  if (clearProfileBtn) {
    clearProfileBtn.addEventListener('click', async () => {
      if (!confirm('Clear your profile information? This cannot be undone.')) return;

      try {
        await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_PROFILE });
        showNotification('Profile cleared', 'success');
        loadStorageSizes();
      } catch (error) {
        console.log('[Settings] Failed to clear profile:', error);
        showNotification('Failed to clear profile', 'error');
      }
    });
  }

  // Clear applications button
  const clearAppsBtn = document.getElementById('clear-applications-btn');
  if (clearAppsBtn) {
    clearAppsBtn.addEventListener('click', async () => {
      if (!confirm('Delete ALL job applications, interviews, tasks, and activities? This cannot be undone.')) return;
      if (!confirm('Are you absolutely sure? This will permanently delete all your tracked applications.')) return;

      try {
        await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_APPLICATIONS });
        showNotification('All applications cleared', 'success');
        loadStorageSizes();
        // Refresh the page to reflect changes
        window.location.reload();
      } catch (error) {
        console.log('[Settings] Failed to clear applications:', error);
        showNotification('Failed to clear applications', 'error');
      }
    });
  }

  // Clear all data button
  const clearAllBtn = document.getElementById('clear-all-data-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('WARNING: This will delete ALL data including models, profile, applications, and settings. This cannot be undone!')) return;
      if (!confirm('Last chance! Are you absolutely sure you want to delete everything?')) return;

      try {
        // Unload models from worker memory first
        if (aiInitialized) {
          await aiService.unloadModels();
        }

        await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_ALL_DATA });

        // Also clear browser models cache
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            if (name.includes('transformers') || name.includes('onnx')) {
              await caches.delete(name);
            }
          }
        }

        showNotification('All data cleared', 'success');
        // Refresh the page
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        console.log('[Settings] Failed to clear all data:', error);
        showNotification('Failed to clear all data', 'error');
      }
    });
  }

  console.log('[Dashboard Settings] Event listeners initialized');
}

// Make loadStorageSizes and loadDashboardSettings globally available for navigation.js
if (typeof window !== 'undefined') {
  window.loadStorageSizes = loadStorageSizes;
  window.loadDashboardSettings = loadDashboardSettings;
}
