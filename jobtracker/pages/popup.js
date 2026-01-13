/**
 * JobTracker Popup Script
 */

// Theme Management
// Uses separate storage key to avoid conflict with data migration
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.setupListeners();
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

    this.updateToggleButton(theme);
  },

  updateToggleButton(theme) {
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  },

  setupListeners() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        const currentTheme = await this.getTheme();
        const isDark = currentTheme === 'dark' ||
          (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const newTheme = isDark ? 'light' : 'dark';
        await this.setTheme(newTheme);
      });
    }

    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTheme(btn.dataset.theme);
      });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const theme = await this.getTheme();
      if (theme === 'system') {
        this.applyTheme('system');
      }
    });

    // Listen for storage changes from other extension pages
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[this.STORAGE_KEY]) {
        const newTheme = changes[this.STORAGE_KEY].newValue?.theme || 'system';
        this.applyTheme(newTheme);
        this.updateToggleButton(newTheme);
      }
    });
  }
};

// Message types
const MessageTypes = {
  GET_APPLICATIONS: 'GET_APPLICATIONS',
  ADD_APPLICATION: 'ADD_APPLICATION',
  GET_APPLICATION_STATS: 'GET_APPLICATION_STATS',
  TRIGGER_AUTOFILL: 'TRIGGER_AUTOFILL'
};

// DOM Elements
const elements = {
  statTotal: document.getElementById('stat-total'),
  statWeek: document.getElementById('stat-week'),
  statInterview: document.getElementById('stat-interview'),
  statOffer: document.getElementById('stat-offer'),
  recentList: document.getElementById('recent-list'),
  emptyState: document.getElementById('empty-state'),
  autofillBtn: document.getElementById('autofill-btn'),
  addAppBtn: document.getElementById('add-app-btn'),
  viewAllBtn: document.getElementById('view-all-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  addModal: document.getElementById('add-modal'),
  closeModal: document.getElementById('close-modal'),
  cancelAdd: document.getElementById('cancel-add'),
  addAppForm: document.getElementById('add-app-form'),
  openDashboardBtn: document.getElementById('open-dashboard-btn')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await ThemeManager.init();
  await loadStats();
  await loadRecentApplications();
  setupEventListeners();
  setTodayAsDefault();
});

// Load stats
async function loadStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATION_STATS });
    elements.statTotal.textContent = stats.total || 0;
    elements.statWeek.textContent = stats.thisWeek || 0;
    elements.statInterview.textContent = stats.byStatus?.interview || 0;
    elements.statOffer.textContent = stats.byStatus?.offer || 0;
  } catch (error) {
    console.log('Error loading stats:', error);
  }
}

// Load recent applications
async function loadRecentApplications() {
  try {
    const applications = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATIONS });

    if (!applications || applications.length === 0) {
      elements.emptyState.classList.remove('hidden');
      return;
    }

    elements.emptyState.classList.add('hidden');

    // Show only 5 most recent
    const recent = applications.slice(0, 5);
    elements.recentList.innerHTML = '';

    recent.forEach(app => {
      const item = createApplicationItem(app);
      elements.recentList.appendChild(item);
    });
  } catch (error) {
    console.log('Error loading applications:', error);
  }
}

// Valid status values for sanitization
const VALID_STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'saved'];

// Sanitize status to prevent XSS via class injection
function sanitizeStatus(status) {
  const normalized = (status || 'applied').toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : 'applied';
}

// Create application list item
function createApplicationItem(app) {
  const item = document.createElement('div');
  item.className = 'app-item';
  item.dataset.id = app.id;

  const initial = escapeHtml((app.company || 'U')[0].toUpperCase());
  const dateStr = formatRelativeDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());
  const statusClass = `status-${sanitizeStatus(app.status)}`;

  item.innerHTML = `
    <div class="app-icon">${initial}</div>
    <div class="app-details">
      <div class="app-company">${escapeHtml(app.company || 'Unknown Company')}</div>
      <div class="app-position">${escapeHtml(app.position || 'Unknown Position')}</div>
      <div class="app-meta">
        <span class="status-badge ${statusClass}">${escapeHtml(capitalizeStatus(app.status))}</span>
        <span class="app-date">${escapeHtml(dateStr)}</span>
      </div>
    </div>
  `;

  item.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`pages/applications.html?id=${app.id}`) });
  });

  return item;
}

// Setup event listeners
function setupEventListeners() {
  // Autofill button
  elements.autofillBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: MessageTypes.TRIGGER_AUTOFILL });
        window.close();
      }
    } catch (error) {
      console.log('Error triggering autofill:', error);
      alert('Could not trigger autofill. Make sure you are on a job application page.');
    }
  });

  // Add application button
  elements.addAppBtn.addEventListener('click', () => {
    elements.addModal.classList.remove('hidden');
    document.getElementById('app-company').focus();
  });

  // Close modal
  elements.closeModal.addEventListener('click', closeModal);
  elements.cancelAdd.addEventListener('click', closeModal);
  elements.addModal.addEventListener('click', (e) => {
    if (e.target === elements.addModal) closeModal();
  });

  // Add application form
  elements.addAppForm.addEventListener('submit', handleAddApplication);

  // View all applications
  elements.viewAllBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/applications.html') });
  });

  // Settings
  elements.settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/profile.html#settings') });
  });

  // Open Dashboard
  elements.openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.addModal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// Handle add application
async function handleAddApplication(e) {
  e.preventDefault();

  const application = {
    company: document.getElementById('app-company').value.trim(),
    position: document.getElementById('app-position').value.trim(),
    jobUrl: document.getElementById('app-url').value.trim(),
    status: document.getElementById('app-status').value,
    dateApplied: document.getElementById('app-date').value
      ? new Date(document.getElementById('app-date').value).toISOString()
      : new Date().toISOString(),
    notes: document.getElementById('app-notes').value.trim(),
    platform: detectPlatformFromUrl(document.getElementById('app-url').value)
  };

  try {
    const result = await chrome.runtime.sendMessage({
      type: MessageTypes.ADD_APPLICATION,
      payload: application
    });

    if (result?.id) {
      closeModal();
      elements.addAppForm.reset();
      setTodayAsDefault();
      await loadStats();
      await loadRecentApplications();
    }
  } catch (error) {
    console.log('Error adding application:', error);
    alert('Failed to add application. Please try again.');
  }
}

// Close modal
function closeModal() {
  elements.addModal.classList.add('hidden');
}

// Set today as default date
function setTodayAsDefault() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('app-date').value = today;
}

// Detect platform from URL
function detectPlatformFromUrl(url) {
  if (!url) return 'other';
  const platforms = {
    'linkedin': /linkedin\.com/i,
    'indeed': /indeed\.com/i,
    'glassdoor': /glassdoor\.(com|co\.uk)/i,
    'greenhouse': /greenhouse\.io/i,
    'lever': /lever\.(co|com)/i,
    'workday': /(myworkdayjobs|workday)\.com/i,
    'icims': /icims\.com/i,
    'smartrecruiters': /smartrecruiters\.com/i
  };

  for (const [platform, pattern] of Object.entries(platforms)) {
    if (pattern.test(url)) return platform;
  }
  return 'other';
}

// Format relative date
function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Capitalize status
function capitalizeStatus(status) {
  if (!status) return 'Applied';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
