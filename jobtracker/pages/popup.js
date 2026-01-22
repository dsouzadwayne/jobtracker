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
  TRIGGER_AUTOFILL: 'TRIGGER_AUTOFILL',
  AI_EXTRACT_JOB: 'AI_EXTRACT_JOB'
};

// DOM Elements
const elements = {
  statTotal: document.getElementById('stat-total'),
  statWeek: document.getElementById('stat-week'),
  statInterview: document.getElementById('stat-interview'),
  statOffer: document.getElementById('stat-offer'),
  recentList: document.getElementById('recent-list'),
  emptyState: document.getElementById('empty-state'),
  trackJobBtn: document.getElementById('track-job-btn'),
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

// BroadcastChannel for cross-page real-time updates
const applicationChannel = new BroadcastChannel('jobtracker-applications');
applicationChannel.onmessage = async (event) => {
  if (event.data.type === 'DATA_CHANGED') {
    await loadStats();
    await loadRecentApplications();
  }
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
    chrome.tabs.create({ url: chrome.runtime.getURL(`pages/dashboard.html?id=${app.id}`) });
  });

  return item;
}

// Setup event listeners
function setupEventListeners() {
  // Track This Job button
  elements.trackJobBtn.addEventListener('click', handleTrackJob);

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
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
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

// Handle Track This Job button click
async function handleTrackJob() {
  const btn = elements.trackJobBtn;
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');

  // Show loading state
  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      throw new Error('No active tab found');
    }

    const pageUrl = tab.url;

    // Check if we can access this page
    if (pageUrl.startsWith('chrome://') || pageUrl.startsWith('chrome-extension://') || pageUrl.startsWith('about:')) {
      throw new Error('Cannot scan browser pages. Please navigate to a job posting.');
    }

    let extracted = {
      company: '',
      position: '',
      location: '',
      salary: '',
      description: ''
    };
    let pageText = '';

    // Step 1: Try to get job info from page using content script
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const result = {
            company: '',
            position: '',
            location: '',
            salary: '',
            description: '',
            pageText: ''
          };

          // Try platform-specific extractor first
          if (typeof window.__jobTrackerExtractJob === 'function') {
            const platformData = window.__jobTrackerExtractJob();
            if (platformData) {
              result.company = platformData.company || '';
              result.position = platformData.position || '';
              result.location = platformData.location || '';
              result.salary = platformData.salary || '';
              result.description = platformData.description || '';
            }
          }

          // If still missing data, try common selectors (regex approach)
          if (!result.company || !result.position) {
            // Try JSON-LD first
            try {
              const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
              for (const script of jsonLdScripts) {
                const data = JSON.parse(script.textContent);
                if (data['@type'] === 'JobPosting') {
                  if (!result.position) result.position = data.title || '';
                  if (!result.company) result.company = data.hiringOrganization?.name || '';
                  if (!result.location && data.jobLocation?.address) {
                    const addr = data.jobLocation.address;
                    result.location = addr.addressLocality || addr.name || '';
                  }
                  break;
                }
              }
            } catch (e) {
              // JSON-LD parsing may fail for malformed data
              console.warn('JobTracker: JSON-LD parsing failed in popup', e.message);
            }

            // Try common selectors
            if (!result.position) {
              const h1 = document.querySelector('h1');
              if (h1) result.position = h1.textContent.trim().substring(0, 200);
            }

            if (!result.company) {
              const companyEl = document.querySelector('[class*="company"], [class*="employer"], [data-company]');
              if (companyEl) result.company = companyEl.textContent.trim().substring(0, 100);
            }
          }

          // Get page text for AI fallback
          result.pageText = document.body.innerText.substring(0, 30000);

          return result;
        }
      });

      const scriptResult = results?.[0]?.result;
      if (scriptResult) {
        extracted.company = scriptResult.company || '';
        extracted.position = scriptResult.position || '';
        extracted.location = scriptResult.location || '';
        extracted.salary = scriptResult.salary || '';
        extracted.description = scriptResult.description || '';
        pageText = scriptResult.pageText || '';
      }
    } catch (scriptError) {
      console.log('[Popup] Script execution error:', scriptError.message);
    }

    // Step 2: If company or position still blank, use AI extraction
    if ((!extracted.company || !extracted.position) && pageText.length > 100) {
      console.log('[Popup] Using AI to fill missing fields...');
      try {
        const aiResult = await chrome.runtime.sendMessage({
          type: MessageTypes.AI_EXTRACT_JOB,
          payload: { text: pageText }
        });

        if (aiResult?.success && aiResult.data) {
          // Only fill in blank fields
          if (!extracted.company && aiResult.data.company) {
            extracted.company = aiResult.data.company;
            console.log('[Popup] AI filled company:', extracted.company);
          }
          if (!extracted.position && aiResult.data.position) {
            extracted.position = aiResult.data.position;
            console.log('[Popup] AI filled position:', extracted.position);
          }
          if (!extracted.location && aiResult.data.location) {
            extracted.location = aiResult.data.location;
          }
          if (!extracted.salary && aiResult.data.salary) {
            extracted.salary = aiResult.data.salary;
          }
        }
      } catch (aiError) {
        console.log('[Popup] AI extraction failed:', aiError.message);
      }
    }

    // Step 3: Use page title as fallback
    if (!extracted.position) {
      extracted.position = tab.title?.split(' - ')[0]?.substring(0, 100) || 'Job Position';
    }
    if (!extracted.company) {
      // Try to get from URL
      try {
        const hostname = new URL(pageUrl).hostname.replace('www.', '').split('.')[0];
        extracted.company = hostname.charAt(0).toUpperCase() + hostname.slice(1);
      } catch (e) {
        extracted.company = 'Unknown Company';
      }
    }

    console.log('[Popup] Final extracted data:', extracted);

    // Step 4: Save the application
    const application = {
      company: extracted.company,
      position: extracted.position,
      jobUrl: pageUrl,
      status: 'saved',
      dateApplied: new Date().toISOString(),
      location: extracted.location || '',
      salary: extracted.salary || '',
      jobDescription: extracted.description || '',
      platform: detectPlatformFromUrl(pageUrl),
      autoDetected: true
    };

    const addResult = await chrome.runtime.sendMessage({
      type: MessageTypes.ADD_APPLICATION,
      payload: application
    });

    console.log('[Popup] Add result:', addResult);

    // Check for duplicate
    if (addResult?.duplicate) {
      // Already tracked - show as success anyway
      btnText.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Already Tracked
      `;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
      btn.disabled = false;

      setTimeout(() => {
        btnText.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Track This Job
        `;
      }, 2000);
      return;
    }

    if (addResult?.success) {
      // Success - update UI
      await loadStats();
      await loadRecentApplications();

      // Show success feedback
      btnText.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Tracked!
      `;
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');

      // Reset after 2 seconds
      setTimeout(() => {
        btnText.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Track This Job
        `;
        btn.disabled = false;
      }, 2000);

      return;
    } else {
      throw new Error(addResult?.error || addResult?.message || 'Failed to save application');
    }

  } catch (error) {
    console.log('[Popup] Track job error:', error);
    // Show user-friendly error message without exposing internal details
    const userMessage = getUserFriendlyErrorMessage(error);
    alert(userMessage);

    // Reset button state on error
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
  }
}

/**
 * Convert error to user-friendly message
 */
function getUserFriendlyErrorMessage(error) {
  const message = error?.message || '';

  // Map known errors to user-friendly messages
  if (message.includes('duplicate') || message.includes('already exists')) {
    return 'This job has already been tracked.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('Failed to fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (message.includes('permission') || message.includes('access denied')) {
    return 'Permission error. Please refresh the page and try again.';
  }
  if (message.includes('database') || message.includes('IndexedDB')) {
    return 'Storage error. Please try again or clear browser data.';
  }
  if (message.includes('not found') || message.includes('no job')) {
    return 'Could not detect job information on this page.';
  }

  // Default message
  return 'Failed to track job. Please try again.';
}
