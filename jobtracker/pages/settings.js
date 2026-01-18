/**
 * Settings Page Module
 * Handles all settings functionality
 */

import { aiService } from '../lib/ai-service.js';

// Message types
const SettingsMessageTypes = {
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  GET_APPLICATIONS_SIZE: 'GET_APPLICATIONS_SIZE',
  GET_PROFILE_SIZE: 'GET_PROFILE_SIZE',
  GET_MODELS_STATUS: 'GET_MODELS_STATUS',
  SET_MODEL_METADATA: 'SET_MODEL_METADATA',
  CLEAR_MODELS_METADATA: 'CLEAR_MODELS_METADATA',
  CLEAR_PROFILE: 'CLEAR_PROFILE',
  CLEAR_APPLICATIONS: 'CLEAR_APPLICATIONS',
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA',
  EXPORT_DATA: 'EXPORT_DATA',
  IMPORT_DATA: 'IMPORT_DATA'
};

// Theme Manager
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.updateSelector(theme);
    this.setupListeners();
    this.setupToggle();
  },

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
      this.updateSelector(theme);
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
  },

  updateSelector(theme) {
    document.querySelectorAll('#theme-selector .theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  },

  setupListeners() {
    document.querySelectorAll('#theme-selector .theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTheme(btn.dataset.theme);
      });
    });
  },

  setupToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', async () => {
        const current = await this.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
      });
    }
  }
};

// Mobile sidebar handling
function setupMobileSidebar() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('dashboard-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('hidden');
    menuBtn.setAttribute('aria-expanded', sidebar.classList.contains('open'));
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  });
}

// Settings state
let settings = {};

// Load settings
async function loadSettings() {
  try {
    settings = await chrome.runtime.sendMessage({ type: SettingsMessageTypes.GET_SETTINGS });
    populateSettings();
  } catch (error) {
    console.log('Error loading settings:', error);
  }
}

// Populate form with current settings
function populateSettings() {
  const autofillEnabled = document.getElementById('setting-autofill-enabled');
  const floatingBtn = document.getElementById('setting-floating-btn');
  const delaySlider = document.getElementById('setting-autofill-delay');
  const delayValue = document.getElementById('delay-value');

  if (autofillEnabled) autofillEnabled.checked = settings?.autofill?.enabled ?? true;
  if (floatingBtn) floatingBtn.checked = settings?.autofill?.showFloatingButton ?? true;
  if (delaySlider) {
    delaySlider.value = settings?.autofill?.delay || 0;
    if (delayValue) delayValue.textContent = formatDelay(delaySlider.value);
  }

  // AI settings
  const aiEnabled = document.getElementById('setting-ai-enabled');
  const aiTags = document.getElementById('setting-ai-tags');
  const aiResume = document.getElementById('setting-ai-resume');

  if (aiEnabled) aiEnabled.checked = settings?.ai?.enabled ?? false;
  if (aiTags) aiTags.checked = settings?.ai?.autoSuggestTags ?? true;
  if (aiResume) aiResume.checked = settings?.ai?.enhanceResumeParsing ?? true;

  // Update AI models section visibility based on AI enabled state
  updateAIModelsVisibility();

  renderCustomRules();
}

// Update AI models section visibility
function updateAIModelsVisibility() {
  const aiEnabled = document.getElementById('setting-ai-enabled')?.checked;
  const modelsCard = document.getElementById('ai-models-card');
  const preloadBtn = document.getElementById('preload-models-btn');

  if (modelsCard) {
    modelsCard.style.opacity = aiEnabled ? '1' : '0.6';
  }

  if (preloadBtn) {
    preloadBtn.disabled = !aiEnabled;
    if (!aiEnabled) {
      preloadBtn.title = 'Enable AI features first to download models';
    } else {
      preloadBtn.title = '';
    }
  }
}

function formatDelay(ms) {
  const seconds = parseInt(ms) / 1000;
  return seconds === 0 ? '0s' : `${seconds}s`;
}

// Save autofill settings
async function saveAutofillSettings() {
  settings.autofill = settings.autofill || {};
  settings.autofill.enabled = document.getElementById('setting-autofill-enabled')?.checked ?? true;
  settings.autofill.showFloatingButton = document.getElementById('setting-floating-btn')?.checked ?? true;
  settings.autofill.delay = parseInt(document.getElementById('setting-autofill-delay')?.value) || 0;

  await chrome.runtime.sendMessage({ type: SettingsMessageTypes.SAVE_SETTINGS, payload: settings });
  showNotification('Settings saved', 'success');
}

// Save AI settings
async function saveAISettings() {
  settings.ai = settings.ai || {};
  settings.ai.enabled = document.getElementById('setting-ai-enabled')?.checked ?? false;
  settings.ai.autoSuggestTags = document.getElementById('setting-ai-tags')?.checked ?? true;
  settings.ai.enhanceResumeParsing = document.getElementById('setting-ai-resume')?.checked ?? true;

  await chrome.runtime.sendMessage({ type: SettingsMessageTypes.SAVE_SETTINGS, payload: settings });

  // Update UI state
  updateAIModelsVisibility();

  showNotification('AI settings saved', 'success');
}

// Custom Rules
function renderCustomRules() {
  const list = document.getElementById('custom-rules-list');
  const empty = document.getElementById('rules-empty');
  const rules = settings?.customFieldRules || [];

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

function createRuleCard(rule) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.innerHTML = `
    <div class="entry-info">
      <div class="entry-title">${escapeHtml(rule.name)}</div>
      <div class="entry-subtitle"><code>${escapeHtml(rule.pattern)}</code> -> ${escapeHtml(rule.profilePath)}</div>
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

function closeRuleModal() {
  document.getElementById('rule-modal')?.classList.add('hidden');
}

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

  settings.customFieldRules = settings.customFieldRules || [];

  if (id) {
    const index = settings.customFieldRules.findIndex(r => r.id === id);
    if (index !== -1) settings.customFieldRules[index] = rule;
  } else {
    settings.customFieldRules.push(rule);
  }

  await chrome.runtime.sendMessage({ type: SettingsMessageTypes.SAVE_SETTINGS, payload: settings });
  closeRuleModal();
  renderCustomRules();
  showNotification('Rule saved', 'success');
}

async function deleteRule(id) {
  if (!confirm('Delete this custom rule?')) return;

  settings.customFieldRules = (settings.customFieldRules || []).filter(r => r.id !== id);
  await chrome.runtime.sendMessage({ type: SettingsMessageTypes.SAVE_SETTINGS, payload: settings });
  renderCustomRules();
  showNotification('Rule deleted', 'success');
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Storage sizes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function loadStorageSizes() {
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

    // Get models status
    const modelsStatus = await chrome.runtime.sendMessage({ type: SettingsMessageTypes.GET_MODELS_STATUS });
    let modelsCacheSize = 0;
    if (modelsStatus?.embeddings?.downloadStatus === 'downloaded') {
      modelsCacheSize += 23 * 1024 * 1024;
    }
    if (modelsStatus?.ner?.downloadStatus === 'downloaded') {
      modelsCacheSize += 109 * 1024 * 1024;
    }
    const modelsSizeEl = document.getElementById('models-cache-size');
    if (modelsSizeEl) modelsSizeEl.textContent = modelsCacheSize > 0 ? formatBytes(modelsCacheSize) : 'Not downloaded';

    // Update model status badges
    updateModelStatusBadge('embeddings', modelsStatus?.embeddings?.downloadStatus);
    updateModelStatusBadge('ner', modelsStatus?.ner?.downloadStatus);

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
    console.log('Error loading storage sizes:', error);
  }
}

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

// Export/Import
async function handleExport() {
  try {
    const data = await chrome.runtime.sendMessage({ type: SettingsMessageTypes.EXPORT_DATA });
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
      type: SettingsMessageTypes.IMPORT_DATA,
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

// Clear data functions
async function clearProfile() {
  if (!confirm('Clear your profile information? This cannot be undone.')) return;

  try {
    await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_PROFILE });
    showNotification('Profile cleared', 'success');
    loadStorageSizes();
  } catch (error) {
    console.log('Error clearing profile:', error);
    showNotification('Failed to clear profile', 'error');
  }
}

async function clearApplications() {
  if (!confirm('Delete ALL job applications, interviews, tasks, and activities? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure? This will permanently delete all your tracked applications.')) return;

  try {
    await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_APPLICATIONS });
    showNotification('All applications cleared', 'success');
    loadStorageSizes();
  } catch (error) {
    console.log('Error clearing applications:', error);
    showNotification('Failed to clear applications', 'error');
  }
}

async function clearModelsCache() {
  if (!confirm('Clear AI models cache? Models will need to be re-downloaded for AI features.')) return;

  try {
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
    console.log('Error clearing models:', error);
    showNotification('Failed to clear models cache', 'error');
  }
}

async function clearAllData() {
  if (!confirm('WARNING: This will delete ALL data including models, profile, applications, and settings. This cannot be undone!')) return;
  if (!confirm('Last chance! Are you absolutely sure you want to delete everything?')) return;

  try {
    await chrome.runtime.sendMessage({ type: SettingsMessageTypes.CLEAR_ALL_DATA });

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes('transformers') || name.includes('onnx')) {
          await caches.delete(name);
        }
      }
    }

    showNotification('All data cleared', 'success');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    console.log('Error clearing all data:', error);
    showNotification('Failed to clear all data', 'error');
  }
}

// Notification
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Setup event listeners
function setupEventListeners() {
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
  document.getElementById('add-rule-btn')?.addEventListener('click', () => openRuleModal());
  document.getElementById('rule-form')?.addEventListener('submit', handleRuleSubmit);
  document.getElementById('close-rule-modal')?.addEventListener('click', closeRuleModal);
  document.getElementById('cancel-rule-btn')?.addEventListener('click', closeRuleModal);
  document.getElementById('rule-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'rule-modal') closeRuleModal();
  });

  // Export/Import
  document.getElementById('settings-export-btn')?.addEventListener('click', handleExport);
  document.getElementById('settings-import-btn')?.addEventListener('click', () => {
    document.getElementById('settings-import-file')?.click();
  });
  document.getElementById('settings-import-file')?.addEventListener('change', handleImport);

  // Clear buttons
  document.getElementById('clear-profile-btn')?.addEventListener('click', clearProfile);
  document.getElementById('clear-applications-btn')?.addEventListener('click', clearApplications);
  document.getElementById('clear-ai-models-btn')?.addEventListener('click', clearModelsCache);
  document.getElementById('clear-models-btn')?.addEventListener('click', clearModelsCache);
  document.getElementById('clear-all-data-btn')?.addEventListener('click', clearAllData);

  // AI settings
  const aiEnabled = document.getElementById('setting-ai-enabled');
  const aiTags = document.getElementById('setting-ai-tags');
  const aiResume = document.getElementById('setting-ai-resume');

  if (aiEnabled) aiEnabled.addEventListener('change', saveAISettings);
  if (aiTags) aiTags.addEventListener('change', saveAISettings);
  if (aiResume) aiResume.addEventListener('change', saveAISettings);

  // Preload models button
  const preloadBtn = document.getElementById('preload-models-btn');
  if (preloadBtn) {
    preloadBtn.addEventListener('click', async () => {
      // Check if AI is enabled
      const isAIEnabled = document.getElementById('setting-ai-enabled')?.checked;
      if (!isAIEnabled) {
        showNotification('Enable AI features first to download models', 'warning');
        return;
      }

      preloadBtn.disabled = true;
      preloadBtn.textContent = 'Downloading...';

      try {
        // Mark both as downloading
        updateModelStatusBadge('embeddings', 'downloading');
        updateModelStatusBadge('ner', 'downloading');

        // Initialize aiService - this creates the worker
        await aiService.init();

        // Download both models
        // Progress events are handled by setupModelDownloadListeners()
        await aiService.preloadModels(true); // true = include NER model

        showNotification('Models downloaded successfully!', 'success');
        loadStorageSizes();
      } catch (error) {
        console.log('Model download failed:', error);
        showNotification('Download failed: ' + (error.message || 'Check your internet connection.'), 'error');
      } finally {
        preloadBtn.disabled = false;
        preloadBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download All Models (132 MB)
        `;
        // Re-check if AI is still enabled
        updateAIModelsVisibility();
      }
    });
  }
}

// Setup model download progress listeners
function setupModelDownloadListeners() {
  // Listen for model download progress events from worker
  window.addEventListener('model-download-progress', (event) => {
    const { model, status, progress } = event.detail;

    if (status === 'initiate') {
      updateModelStatusBadge(model, 'downloading');
    }

    if (status === 'downloading') {
      const badge = document.getElementById(`${model}-status`);
      if (badge) {
        badge.textContent = `${progress || 0}%`;
      }
    }
  });

  // Listen for model download completion
  window.addEventListener('model-download-complete', async (event) => {
    const { model } = event.detail;
    updateModelStatusBadge(model, 'downloaded');

    // Update metadata in database
    try {
      await chrome.runtime.sendMessage({
        type: SettingsMessageTypes.SET_MODEL_METADATA,
        payload: { modelId: model, downloadStatus: 'downloaded', downloadedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.warn('Failed to save model metadata:', error);
    }
  });

  // Listen for model download errors
  window.addEventListener('model-download-error', (event) => {
    const { model, error } = event.detail;
    updateModelStatusBadge(model, 'failed');
    showNotification(`Model download failed: ${error}`, 'error');
  });
}

// Initialize page
async function init() {
  await ThemeManager.init();
  setupMobileSidebar();
  setupModelDownloadListeners();
  await loadSettings();
  await loadStorageSizes();
  setupEventListeners();
}

// Start
document.addEventListener('DOMContentLoaded', init);
