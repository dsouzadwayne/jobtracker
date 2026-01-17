/**
 * Theme Management Module
 * Handles dark/light theme switching synced with chrome.storage
 */

import { getCurrentPage } from './state.js';

const STORAGE_KEY = 'jobtracker_ui_prefs';

// Reference to updateStats function (set during initialization)
let updateStatsCallback = null;

export function setUpdateStatsCallback(callback) {
  updateStatsCallback = callback;
}

export const ThemeManager = {
  STORAGE_KEY,

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.setupListeners();
  },

  async getTheme() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY]?.theme || 'system';
    } catch {
      return 'system';
    }
  },

  async setTheme(theme) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const prefs = result[STORAGE_KEY] || {};
      prefs.theme = theme;
      await chrome.storage.local.set({ [STORAGE_KEY]: prefs });
      this.applyTheme(theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  },

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    // Re-render charts with new theme colors (with slight delay to let CSS variables update)
    setTimeout(() => {
      if (getCurrentPage() === 'stats' && updateStatsCallback) {
        updateStatsCallback();
      }
    }, 50);
  },

  async toggleTheme() {
    const currentTheme = await this.getTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = currentTheme === 'dark' || (currentTheme === 'system' && prefersDark);
    await this.setTheme(isDark ? 'light' : 'dark');
  },

  setupListeners() {
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const theme = await this.getTheme();
      if (theme === 'system') {
        this.applyTheme('system');
      }
    });

    // Listen for storage changes from other extension pages
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newTheme = changes[STORAGE_KEY].newValue?.theme || 'system';
        this.applyTheme(newTheme);
      }
    });
  }
};
