/**
 * Supported Sites Page Module
 * Minimal JS for theme handling and mobile sidebar
 */

// Theme Manager
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
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

// Initialize page
async function init() {
  await ThemeManager.init();
  setupMobileSidebar();
}

// Start
document.addEventListener('DOMContentLoaded', init);
