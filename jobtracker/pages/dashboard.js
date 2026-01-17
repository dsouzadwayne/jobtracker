/**
 * JobTracker Dashboard Script
 * Standalone web app for managing job applications
 */

// Theme Management (synced with chrome.storage.local for consistency across extension)
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
      if (currentPage === 'stats' && typeof updateStats === 'function') {
        updateStats();
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
      if (areaName === 'local' && changes[this.STORAGE_KEY]) {
        const newTheme = changes[this.STORAGE_KEY].newValue?.theme || 'system';
        this.applyTheme(newTheme);
      }
    });
  }
};

// Message types
const MessageTypes = {
  GET_APPLICATIONS: 'GET_APPLICATIONS',
  ADD_APPLICATION: 'ADD_APPLICATION',
  UPDATE_APPLICATION: 'UPDATE_APPLICATION',
  DELETE_APPLICATION: 'DELETE_APPLICATION',
  GET_APPLICATION_STATS: 'GET_APPLICATION_STATS',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  // Intelligence (Phase 4)
  GET_INSIGHTS: 'GET_INSIGHTS',
  GET_RECOMMENDATIONS: 'GET_RECOMMENDATIONS',
  GET_GOAL_PROGRESS: 'GET_GOAL_PROGRESS',
  SAVE_GOALS: 'SAVE_GOALS'
};

// State
let applications = [];
let filteredApplications = [];
let selectedAppId = null;
let currentView = 'cards'; // Will be loaded from settings
let currentPage = 'applications'; // 'applications' or 'stats'
let cachedSettings = null; // Cache settings for view preference updates
let formIsDirty = false; // Track if form has unsaved changes
let isSubmitting = false; // Track form submission state

// Event handler references for cleanup
let keyboardShortcutHandler = null;
let escapeKeyHandler = null;

// Chart instances
let statusChart = null;
let timelineChart = null;
let platformChart = null;
let funnelChart = null;
let timeStatusChart = null;

// Phase 3: Date range state
let currentDateRange = null; // null = all time, number = days, or {start, end}

// Status colors matching existing CSS
const STATUS_COLORS = {
  saved: '#6b7280',
  applied: '#3b82f6',
  screening: '#f59e0b',
  interview: '#8b5cf6',
  offer: '#10b981',
  rejected: '#ef4444',
  withdrawn: '#9ca3af'
};

const PLATFORM_COLORS = {
  linkedin: '#0077b5',
  indeed: '#2164f3',
  glassdoor: '#0caa41',
  greenhouse: '#3ab549',
  lever: '#1a1a1a',
  workday: '#0875e1',
  icims: '#00a0df',
  smartrecruiters: '#10b981',
  other: '#6b7280'
};

// DOM Elements - initialized after DOM is ready
let elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize DOM elements
  elements = {
    // Stats
    statTotal: document.getElementById('stat-total'),
    statWeek: document.getElementById('stat-week'),
    statInterviews: document.getElementById('stat-interviews'),
    statOffers: document.getElementById('stat-offers'),
    statInterviewRate: document.getElementById('stat-interview-rate'),
    statOfferRate: document.getElementById('stat-offer-rate'),
    statAvgDays: document.getElementById('stat-avg-days'),
    statWow: document.getElementById('stat-wow'),

    // List
    list: document.getElementById('applications-list'),
    emptyState: document.getElementById('empty-state'),
    appCount: document.getElementById('app-count'),

    // Filters
    searchInput: document.getElementById('search-input'),
    filterStatus: document.getElementById('filter-status'),
    filterSort: document.getElementById('filter-sort'),

    // Buttons
    addBtn: document.getElementById('add-btn'),
    emptyAddBtn: document.getElementById('empty-add-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    exportBtn: document.getElementById('export-btn'),

    // View Toggle
    viewCardsBtn: document.getElementById('view-cards'),
    viewTableBtn: document.getElementById('view-table'),
    tableContainer: document.getElementById('applications-table'),
    tableBody: document.getElementById('table-body'),

    // Modal
    modal: document.getElementById('app-modal'),
    modalTitle: document.getElementById('modal-title'),
    closeModal: document.getElementById('close-modal'),
    cancelBtn: document.getElementById('cancel-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    appForm: document.getElementById('app-form'),

    // Details Panel
    detailsPanel: document.getElementById('details-panel'),
    detailsPosition: document.getElementById('details-position'),
    detailsContent: document.getElementById('details-content'),
    closeDetails: document.getElementById('close-details'),

    // Sidebar
    sidebar: document.querySelector('.dashboard-sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),

    // Navigation
    navItems: document.querySelectorAll('.nav-item[data-view]'),

    // Sections
    statsSection: document.getElementById('stats-section'),
    filtersSection: document.querySelector('.filters-section'),
    applicationsSection: document.querySelector('.applications-section'),
    headerTitle: document.querySelector('.header-left h1'),

    // Phase 3: Date range filter
    dateRangeFilter: document.getElementById('date-range-filter'),
    customRange: document.getElementById('custom-range'),
    dateStart: document.getElementById('date-start'),
    dateEnd: document.getElementById('date-end'),
    applyRangeBtn: document.getElementById('apply-range'),

    // Phase 3: New chart containers
    funnelConversions: document.getElementById('funnel-conversions'),

    // Phase 4: Intelligence panel
    intelligencePanel: document.getElementById('intelligence-panel'),
    goalCard: document.getElementById('goal-card'),
    goalProgressContainer: document.getElementById('goal-progress-container'),
    goalSettingsBtn: document.getElementById('goal-settings-btn'),
    goalSetupBtn: document.getElementById('goal-setup-btn'),
    insightsCard: document.getElementById('insights-card'),
    insightsList: document.getElementById('insights-list'),
    recommendationsCard: document.getElementById('recommendations-card'),
    recommendationsList: document.getElementById('recommendations-list'),

    // Phase 4: Goal modal
    goalModal: document.getElementById('goal-modal'),
    goalForm: document.getElementById('goal-form'),
    closeGoalModal: document.getElementById('close-goal-modal'),
    cancelGoalBtn: document.getElementById('cancel-goal-btn'),
    weeklyGoalEnabled: document.getElementById('weekly-goal-enabled'),
    weeklyGoal: document.getElementById('weekly-goal'),
    weeklyGoalInputRow: document.getElementById('weekly-goal-input-row'),
    monthlyGoalEnabled: document.getElementById('monthly-goal-enabled'),
    monthlyGoal: document.getElementById('monthly-goal'),
    monthlyGoalInputRow: document.getElementById('monthly-goal-input-row')
  };

  await ThemeManager.init();
  await loadSettings();
  await loadApplications();
  await updateStats();
  setupEventListeners();
  setupKeyboardShortcuts();
  initViewToggle();
  setupNavigation();
  initDateRangeFilter();
  setupIntelligencePanel();
  checkUrlParams();
});

// Check URL params to auto-select application
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    const app = applications.find(a => a.id === id);
    if (app) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        selectApp(id);
        // Scroll to card
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
}

// Load settings from IndexedDB
async function loadSettings() {
  try {
    cachedSettings = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });

    // Check for localStorage migration (one-time)
    const localStorageView = localStorage.getItem('dashboardView');
    if (localStorageView && !cachedSettings?.ui?.dashboardView) {
      // Migrate from localStorage to IndexedDB
      cachedSettings.ui = cachedSettings.ui || {};
      cachedSettings.ui.dashboardView = localStorageView;
      await chrome.runtime.sendMessage({
        type: MessageTypes.SAVE_SETTINGS,
        payload: cachedSettings
      });
      localStorage.removeItem('dashboardView');
      console.log('JobTracker: Migrated dashboardView from localStorage to IndexedDB');
    }

    if (cachedSettings?.ui?.dashboardView) {
      currentView = cachedSettings.ui.dashboardView;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load applications
async function loadApplications() {
  try {
    applications = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATIONS }) || [];
    applyFilters();
  } catch (error) {
    console.error('Error loading applications:', error);
  }
}

// Update stats
async function updateStats() {
  try {
    const message = {
      type: MessageTypes.GET_APPLICATION_STATS,
      payload: currentDateRange ? { dateRange: currentDateRange } : {}
    };
    const stats = await chrome.runtime.sendMessage(message);
    if (stats) {
      elements.statTotal.textContent = stats.total || 0;
      elements.statWeek.textContent = stats.thisWeek || 0;
      elements.statInterviews.textContent = stats.byStatus?.interview || 0;
      elements.statOffers.textContent = stats.byStatus?.offer || 0;

      // Phase 2 metrics
      elements.statInterviewRate.textContent = `${stats.interviewRate || 0}%`;
      elements.statOfferRate.textContent = `${stats.offerRate || 0}%`;
      elements.statAvgDays.textContent = stats.avgDaysToInterview !== null
        ? `${stats.avgDaysToInterview}d`
        : '--';

      // Week-over-week with +/- indicator
      const wow = stats.weekOverWeekChange || 0;
      elements.statWow.textContent = wow >= 0 ? `+${wow}` : `${wow}`;
      elements.statWow.className = 'stat-value' + (wow > 0 ? ' wow-positive' : wow < 0 ? ' wow-negative' : '');

      // Initialize charts with stats data (only when in stats view)
      initCharts(stats);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Apply filters and render
function applyFilters() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const statusFilter = elements.filterStatus.value;
  const sortOrder = elements.filterSort.value;

  // Filter
  filteredApplications = applications.filter(app => {
    const matchesSearch = !searchTerm ||
      (app.company?.toLowerCase().includes(searchTerm)) ||
      (app.position?.toLowerCase().includes(searchTerm));

    const matchesStatus = !statusFilter || app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort
  filteredApplications.sort((a, b) => {
    switch (sortOrder) {
      case 'date-desc':
        return new Date(b.dateApplied || b.meta?.createdAt) - new Date(a.dateApplied || a.meta?.createdAt);
      case 'date-asc':
        return new Date(a.dateApplied || a.meta?.createdAt) - new Date(b.dateApplied || b.meta?.createdAt);
      case 'company':
        return (a.company || '').localeCompare(b.company || '');
      case 'status':
        const statusOrder = ['offer', 'interview', 'screening', 'applied', 'saved', 'rejected', 'withdrawn'];
        const aIdx = statusOrder.indexOf(a.status);
        const bIdx = statusOrder.indexOf(b.status);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      default:
        return 0;
    }
  });

  render();
}

// Valid status values for sanitization
const VALID_STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'saved'];

// Sanitize status to prevent XSS via class injection
function sanitizeStatus(status) {
  const normalized = (status || 'applied').toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : 'applied';
}

// Render applications
function render() {
  elements.appCount.textContent = `${filteredApplications.length} application${filteredApplications.length !== 1 ? 's' : ''}`;

  if (filteredApplications.length === 0) {
    elements.list.innerHTML = '';
    elements.tableBody.innerHTML = '';
    elements.emptyState.classList.remove('hidden');

    // Check if filters are active to show appropriate message
    const hasActiveFilters = elements.searchInput.value.trim() || elements.filterStatus.value;
    const emptyTitle = elements.emptyState.querySelector('h2');
    const emptyDesc = elements.emptyState.querySelector('p');
    const emptyBtn = elements.emptyState.querySelector('#empty-add-btn');

    if (hasActiveFilters && applications.length > 0) {
      // Filters are active but no results
      emptyTitle.textContent = 'No matching applications';
      emptyDesc.textContent = 'Try adjusting your search or filter criteria';
      emptyBtn.style.display = 'none';
    } else {
      // No applications at all
      emptyTitle.textContent = 'No applications yet';
      emptyDesc.textContent = 'Start tracking your job search by adding your first application';
      emptyBtn.style.display = '';
    }
    return;
  }

  elements.emptyState.classList.add('hidden');

  // Render based on current view
  if (currentView === 'table') {
    renderTable();
  } else {
    elements.list.innerHTML = '';
    filteredApplications.forEach(app => {
      elements.list.appendChild(createAppCard(app));
    });
  }
}

// Create application card
function createAppCard(app) {
  const card = document.createElement('div');
  card.className = `app-card ${selectedAppId === app.id ? 'selected' : ''}`;
  card.dataset.id = escapeHtml(app.id);

  const initial = escapeHtml((app.company || 'U')[0].toUpperCase());
  const dateStr = formatDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());
  const statusClass = `status-${sanitizeStatus(app.status)}`;

  card.innerHTML = `
    <div class="app-card-header">
      <div class="app-icon">${initial}</div>
      <div class="app-info">
        <div class="app-company">${escapeHtml(app.company || 'Unknown Company')}</div>
        <div class="app-position">${escapeHtml(app.position || 'Unknown Position')}</div>
      </div>
      <span class="status-badge ${statusClass}" aria-label="Status: ${escapeHtml(capitalizeStatus(app.status))}">${escapeHtml(capitalizeStatus(app.status))}</span>
    </div>
    <div class="app-card-footer">
      <span class="app-date">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        ${escapeHtml(dateStr)}
      </span>
      ${app.location ? `<span class="app-location">${escapeHtml(app.location)}</span>` : ''}
    </div>
    <div class="app-card-actions">
      <button class="action-btn edit-btn" title="Edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="action-btn delete-btn" title="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  // Event listeners
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.action-btn')) {
      selectApp(app.id);
    }
  });

  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(app);
  });

  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteApplication(app.id);
  });

  return card;
}

// Select application
function selectApp(id) {
  selectedAppId = id;
  const app = applications.find(a => a.id === id);

  // Update card selection
  document.querySelectorAll('.app-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === id);
  });

  // Always show details panel (view mode)
  if (app) {
    showDetailsPanel(app);
  }
}

// Show details panel
function showDetailsPanel(app) {
  // Show overlay on smaller screens
  if (window.innerWidth < 1200) {
    showDetailsOverlay();
  }

  elements.detailsPosition.textContent = app.position || 'Unknown Position';

  const detailsInitial = escapeHtml((app.company || 'U')[0].toUpperCase());
  const detailsStatusClass = `status-${sanitizeStatus(app.status)}`;
  const detailsDateStr = formatDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());

  elements.detailsContent.innerHTML = `
    <div class="details-company">
      <span class="company-initial">${detailsInitial}</span>
      <div>
        <div class="company-name">${escapeHtml(app.company || 'Unknown Company')}</div>
        ${app.location ? `<div class="company-location">${escapeHtml(app.location)}</div>` : ''}
      </div>
    </div>

    <div class="details-status">
      <span class="status-badge ${detailsStatusClass}" aria-label="Status: ${escapeHtml(capitalizeStatus(app.status))}">${escapeHtml(capitalizeStatus(app.status))}</span>
      <span class="details-date">${escapeHtml(detailsDateStr)}</span>
    </div>

    ${app.salary ? `<div class="details-field"><strong>Salary:</strong> ${escapeHtml(app.salary)}</div>` : ''}
    ${app.jobType ? `<div class="details-field"><strong>Type:</strong> ${escapeHtml(capitalizeStatus(app.jobType))}</div>` : ''}
    ${app.remote ? `<div class="details-field"><strong>Remote:</strong> ${escapeHtml(capitalizeStatus(app.remote))}</div>` : ''}
    ${app.jobUrl && isValidUrl(app.jobUrl) ? `<div class="details-field">
      <a href="${sanitizeUrl(app.jobUrl)}" target="_blank" rel="noopener noreferrer" class="job-link">
        <span>View Job Posting</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>` : ''}
    ${app.jobDescription ? `
      <div class="details-description">
        <div class="details-description-header">
          <strong>Job Description</strong>
          <button class="description-toggle-btn" onclick="toggleDetailsDescription(this)" title="Toggle description">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <div class="details-description-content" data-expanded="false">${formatJobDescription(app.jobDescription)}</div>
      </div>
    ` : ''}
    ${app.notes ? `<div class="details-notes"><strong>Notes:</strong><p>${escapeHtml(app.notes)}</p></div>` : ''}

    <div class="details-actions">
      <button class="btn-secondary details-edit-btn">Edit</button>
      <button class="btn-danger details-delete-btn">Delete</button>
    </div>
  `;

  // Add event listeners for details panel buttons
  elements.detailsContent.querySelector('.details-edit-btn').addEventListener('click', () => openModal(app));
  elements.detailsContent.querySelector('.details-delete-btn').addEventListener('click', () => deleteApplication(app.id));

  elements.detailsPanel.classList.remove('hidden');
}

// Setup event listeners
function setupEventListeners() {
  // Filters
  elements.searchInput?.addEventListener('input', debounce(applyFilters, 300));
  elements.filterStatus?.addEventListener('change', applyFilters);
  elements.filterSort?.addEventListener('change', applyFilters);

  // Add buttons
  elements.addBtn?.addEventListener('click', () => openModal());
  elements.emptyAddBtn?.addEventListener('click', () => openModal());

  // View toggle
  elements.viewCardsBtn?.addEventListener('click', () => toggleView('cards'));
  elements.viewTableBtn?.addEventListener('click', () => toggleView('table'));

  // Export CSV
  elements.exportBtn?.addEventListener('click', exportToCSV);

  // Theme toggle
  elements.themeToggle?.addEventListener('click', async () => await ThemeManager.toggleTheme());

  // Mobile menu
  elements.mobileMenuBtn?.addEventListener('click', toggleMobileSidebar);
  elements.sidebarOverlay?.addEventListener('click', toggleMobileSidebar);

  // Modal
  elements.closeModal?.addEventListener('click', () => closeModalWithConfirm());
  elements.cancelBtn?.addEventListener('click', () => closeModalWithConfirm());
  elements.deleteBtn?.addEventListener('click', handleDelete);
  elements.appForm?.addEventListener('submit', handleSubmit);
  elements.modal?.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModalWithConfirm();
  });

  // Track form changes for dirty state
  elements.appForm?.addEventListener('input', () => {
    formIsDirty = true;
  });

  // Details panel
  elements.closeDetails?.addEventListener('click', closeDetailsPanel);

  // Remove old escape handler if exists, then add new one
  if (escapeKeyHandler) {
    document.removeEventListener('keydown', escapeKeyHandler);
  }
  escapeKeyHandler = (e) => {
    if (e.key === 'Escape') {
      if (!elements.modal.classList.contains('hidden')) closeModalWithConfirm();
      else if (!elements.detailsPanel.classList.contains('hidden')) closeDetailsPanel();
    }
  };
  document.addEventListener('keydown', escapeKeyHandler);
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  // Remove old handler if exists to prevent accumulation
  if (keyboardShortcutHandler) {
    document.removeEventListener('keydown', keyboardShortcutHandler);
  }

  keyboardShortcutHandler = (e) => {
    // Don't handle if in input/textarea (except for Escape)
    if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;

    // Skip if modal is open (except for Escape which is handled elsewhere)
    if (!elements.modal.classList.contains('hidden') && e.key !== 'Escape') return;

    // Skip J/K navigation if details panel is open on mobile (overlay mode)
    const isDetailsPanelOverlay = !elements.detailsPanel.classList.contains('hidden') && window.innerWidth < 1200;

    switch (e.key) {
      case 'n':
        // Require Ctrl/Cmd modifier to avoid conflicts with typing
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          openModal();
        }
        break;
      case 'j':
        if (!isDetailsPanelOverlay) {
          e.preventDefault();
          navigateList(1);
        }
        break;
      case 'k':
        if (!isDetailsPanelOverlay) {
          e.preventDefault();
          navigateList(-1);
        }
        break;
      case 'Enter':
        if (selectedAppId && !isDetailsPanelOverlay) {
          const app = applications.find(a => a.id === selectedAppId);
          if (app) openModal(app);
        }
        break;
      case '?':
        e.preventDefault();
        showKeyboardShortcutsHelp();
        break;
    }
  };

  document.addEventListener('keydown', keyboardShortcutHandler);
}

// Show keyboard shortcuts help modal
function showKeyboardShortcutsHelp() {
  // Check if help modal already exists
  let helpModal = document.getElementById('keyboard-help-modal');
  if (helpModal) {
    helpModal.classList.remove('hidden');
    helpModal.focus();
    return;
  }

  // Create help modal
  helpModal = document.createElement('div');
  helpModal.id = 'keyboard-help-modal';
  helpModal.className = 'modal';
  helpModal.setAttribute('role', 'dialog');
  helpModal.setAttribute('aria-modal', 'true');
  helpModal.setAttribute('aria-labelledby', 'keyboard-help-title');
  helpModal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3 id="keyboard-help-title">Keyboard Shortcuts</h3>
        <button class="close-btn" aria-label="Close help">&times;</button>
      </div>
      <div style="padding: var(--space-lg);">
        <dl style="margin: 0; display: grid; gap: var(--space-md);">
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Ctrl/Cmd + N</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">New application</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">J</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Next application</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">K</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Previous application</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Enter</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Open selected</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">Esc</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Close modal/panel</dd>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <dt><kbd style="background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-family: monospace;">?</kbd></dt>
            <dd style="margin: 0; color: var(--text-secondary);">Show this help</dd>
          </div>
        </dl>
      </div>
    </div>
  `;

  document.body.appendChild(helpModal);

  // Event listeners
  const closeBtn = helpModal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });
  helpModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') helpModal.classList.add('hidden');
  });

  helpModal.focus();
}

// Navigate list with keyboard
function navigateList(direction) {
  if (filteredApplications.length === 0) return;

  const currentIndex = selectedAppId
    ? filteredApplications.findIndex(a => a.id === selectedAppId)
    : -1;

  let newIndex = currentIndex + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= filteredApplications.length) newIndex = filteredApplications.length - 1;

  selectApp(filteredApplications[newIndex].id);

  // Scroll into view
  const card = document.querySelector(`[data-id="${filteredApplications[newIndex].id}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Toggle mobile sidebar
function toggleMobileSidebar() {
  const isOpen = elements.sidebar.classList.toggle('open');
  elements.sidebarOverlay.classList.toggle('hidden');

  // Update aria-expanded for accessibility
  elements.mobileMenuBtn.setAttribute('aria-expanded', isOpen);
}

// Store previously focused element for focus restoration
let previouslyFocusedElement = null;
let focusTrapHandler = null;

// Focus trap function for modals
function trapFocus(modal) {
  const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    '[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])'
  ].join(', ');

  const focusableElements = modal.querySelectorAll(focusableSelectors);

  // Filter to only visible elements
  const focusableArray = Array.from(focusableElements).filter(el => {
    // Check if element is visible
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    // Check if element or parent has display: none or visibility: hidden
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // Check if element is in a hidden parent
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  });

  if (focusableArray.length === 0) return;

  const firstFocusable = focusableArray[0];
  const lastFocusable = focusableArray[focusableArray.length - 1];

  // Remove old handler if exists
  if (focusTrapHandler) {
    modal.removeEventListener('keydown', focusTrapHandler);
  }

  focusTrapHandler = (e) => {
    if (e.key !== 'Tab') return;

    // Re-calculate focusable elements in case of dynamic changes
    const currentFocusable = Array.from(modal.querySelectorAll(focusableSelectors)).filter(el => {
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (currentFocusable.length === 0) return;

    const first = currentFocusable[0];
    const last = currentFocusable[currentFocusable.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  modal.addEventListener('keydown', focusTrapHandler);
}

// Open modal
function openModal(app = null) {
  // Store the currently focused element for restoration
  previouslyFocusedElement = document.activeElement;

  // Reset form state
  formIsDirty = false;
  hideFormError();

  elements.modalTitle.textContent = app ? 'Edit Application' : 'Add Application';
  elements.appForm.reset();
  elements.deleteBtn.classList.toggle('hidden', !app);

  if (app) {
    document.getElementById('app-id').value = app.id;
    document.getElementById('app-company').value = app.company || '';
    document.getElementById('app-position').value = app.position || '';
    document.getElementById('app-url').value = app.jobUrl || '';
    document.getElementById('app-status').value = app.status || 'applied';
    document.getElementById('app-date').value = formatDateInput(app.dateApplied);
    document.getElementById('app-location').value = app.location || '';
    document.getElementById('app-salary').value = app.salary || '';
    document.getElementById('app-type').value = app.jobType || '';
    document.getElementById('app-remote').value = app.remote || '';
    document.getElementById('app-description').value = app.jobDescription || '';
    document.getElementById('app-notes').value = app.notes || '';
  } else {
    document.getElementById('app-id').value = '';
    document.getElementById('app-date').value = new Date().toISOString().split('T')[0];
  }

  elements.modal.classList.remove('hidden');

  // Set up focus trap and focus first input
  trapFocus(elements.modal);
  document.getElementById('app-company').focus();
}

// Close modal with confirmation if form is dirty
function closeModalWithConfirm() {
  if (formIsDirty && !isSubmitting) {
    if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
  }
  closeModal();
}

// Close modal (force close without confirmation)
function closeModal() {
  elements.modal.classList.add('hidden');
  formIsDirty = false;
  hideFormError();

  // Remove focus trap handler
  if (focusTrapHandler) {
    elements.modal.removeEventListener('keydown', focusTrapHandler);
    focusTrapHandler = null;
  }

  // Restore focus to previously focused element
  if (previouslyFocusedElement && previouslyFocusedElement.focus) {
    previouslyFocusedElement.focus();
    previouslyFocusedElement = null;
  }
}

// Handle form submit
async function handleSubmit(e) {
  e.preventDefault();

  // Prevent double submission
  if (isSubmitting) return;

  hideFormError();

  const id = document.getElementById('app-id').value;
  const appData = {
    company: document.getElementById('app-company').value.trim(),
    position: document.getElementById('app-position').value.trim(),
    jobUrl: document.getElementById('app-url').value.trim(),
    status: document.getElementById('app-status').value,
    dateApplied: document.getElementById('app-date').value
      ? new Date(document.getElementById('app-date').value).toISOString()
      : new Date().toISOString(),
    location: document.getElementById('app-location').value.trim(),
    salary: document.getElementById('app-salary').value.trim(),
    jobType: document.getElementById('app-type').value,
    remote: document.getElementById('app-remote').value,
    jobDescription: document.getElementById('app-description').value.trim(),
    notes: document.getElementById('app-notes').value.trim(),
    platform: detectPlatform(document.getElementById('app-url').value)
  };

  // Validate form data
  const validationErrors = validateFormData(appData);
  if (validationErrors.length > 0) {
    showFormError(validationErrors.join('. '));
    return;
  }

  // Set loading state
  setSubmitState(true);

  try {
    if (id) {
      await chrome.runtime.sendMessage({
        type: MessageTypes.UPDATE_APPLICATION,
        payload: { id, ...appData }
      });
    } else {
      await chrome.runtime.sendMessage({
        type: MessageTypes.ADD_APPLICATION,
        payload: appData
      });
    }

    formIsDirty = false;
    closeModal();
    await loadApplications();
    await updateStats();
  } catch (error) {
    console.error('Error saving application:', error);
    // Keep modal open and show specific error
    showFormError('Failed to save application. Please check your connection and try again.');
  } finally {
    setSubmitState(false);
  }
}

// Handle delete from modal
async function handleDelete() {
  const id = document.getElementById('app-id').value;
  if (!id) return;
  await deleteApplication(id);
  closeModal();
}

// Delete application
async function deleteApplication(id) {
  if (!confirm('Are you sure you want to delete this application?')) return;

  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.DELETE_APPLICATION,
      payload: { id }
    });

    if (selectedAppId === id) {
      selectedAppId = null;
      elements.detailsPanel.classList.add('hidden');
      hideDetailsOverlay();
    }

    await loadApplications();
    await updateStats();
  } catch (error) {
    console.error('Error deleting application:', error);
    // Show error in a way that's visible regardless of modal state
    showNotification('Failed to delete application. Please try again.', 'error');
  }
}

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateInput(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function capitalizeStatus(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
}

function detectPlatform(url) {
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

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Validate URL format and protocol (prevent XSS via javascript: URLs)
function isValidUrl(url) {
  if (!url || !url.trim()) return true; // Empty URLs are valid (optional field)
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Sanitize URL for safe use in href attributes
function sanitizeUrl(url) {
  if (!url || !url.trim()) return '';
  if (!isValidUrl(url)) return '#invalid-url';
  return escapeHtml(url);
}

// Show form error message
function showFormError(message) {
  let errorEl = document.getElementById('form-error-message');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'form-error-message';
    errorEl.className = 'form-error-message';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    const formActions = document.querySelector('.form-actions');
    if (formActions) {
      formActions.parentNode.insertBefore(errorEl, formActions);
    }
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

// Hide form error message
function hideFormError() {
  const errorEl = document.getElementById('form-error-message');
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
}

// Show notification toast (for errors outside modal context)
function showNotification(message, type = 'info') {
  // Remove existing notification if any
  const existing = document.getElementById('notification-toast');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'notification-toast';
  notification.className = `notification-toast notification-${type}`;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');
  notification.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="notification-close" aria-label="Dismiss">&times;</button>
  `;

  document.body.appendChild(notification);

  // Add close handler
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('notification-fade-out');
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// Validate form data
function validateFormData(appData) {
  const errors = [];

  // Required fields
  if (!appData.company || appData.company.length === 0) {
    errors.push('Company name is required');
  }
  if (!appData.position || appData.position.length === 0) {
    errors.push('Position is required');
  }

  // Max length validation (prevent excessive data)
  const maxLengths = {
    company: 200,
    position: 200,
    location: 200,
    salary: 100,
    jobUrl: 2000,
    jobDescription: 50000,
    notes: 10000
  };

  for (const [field, maxLen] of Object.entries(maxLengths)) {
    if (appData[field] && appData[field].length > maxLen) {
      errors.push(`${capitalizeStatus(field)} exceeds maximum length of ${maxLen} characters`);
    }
  }

  // URL validation
  if (appData.jobUrl && !isValidUrl(appData.jobUrl)) {
    errors.push('Please enter a valid URL starting with http:// or https://');
  }

  return errors;
}

// Set form submitting state (loading indicator)
function setSubmitState(submitting) {
  isSubmitting = submitting;
  const submitBtn = elements.appForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = submitting;
    submitBtn.innerHTML = submitting
      ? '<span class="spinner"></span> Saving...'
      : 'Save';
  }
}

// Format job description with bullet points and structure
function formatJobDescription(text) {
  if (!text) return '';

  // Escape HTML first
  let formatted = escapeHtml(text);

  // Convert lines starting with bullet-like characters to proper bullets
  formatted = formatted
    // Handle lines starting with •, -, *, or similar
    .replace(/^[\s]*[•\-\*\●\○\■\□\►\▸]\s*/gm, '<li>')
    // Handle numbered lists (1. 2. etc)
    .replace(/^[\s]*\d+[\.\)]\s+/gm, '<li>')
    // Wrap consecutive <li> items in <ul>
    .replace(/(<li>.*?)(?=(?:<li>|$))/gs, '$1</li>');

  // Wrap sequences of list items in ul tags
  formatted = formatted.replace(/((?:<li>.*?<\/li>\s*)+)/gs, '<ul class="job-desc-list">$1</ul>');

  // Convert double line breaks to paragraph breaks
  formatted = formatted.replace(/\n\n+/g, '</p><p>');

  // Convert remaining single line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  // Wrap in paragraph if not empty
  if (formatted.trim()) {
    formatted = '<p>' + formatted + '</p>';
  }

  // Clean up empty paragraphs
  formatted = formatted.replace(/<p>\s*<\/p>/g, '');

  return formatted;
}

// ==================== CHARTS ====================

// Get theme-aware text color
function getChartTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6b7280';
}

// Initialize charts
function initCharts(stats) {
  const chartsSection = document.getElementById('charts-section');
  if (!chartsSection) return;

  // Only show charts when there's data and in stats view
  if (stats.total === 0 || currentPage !== 'stats') {
    chartsSection.classList.add('hidden');
    return;
  }
  chartsSection.classList.remove('hidden');

  renderStatusChart(stats.byStatus);
  renderTimelineChart(stats.weeklyTrend);
  renderPlatformChart(stats.byPlatform);

  // Phase 3 charts
  renderFunnelChart(stats.funnelData);
  renderHeatmap(stats.dailyCounts);
  renderTimeStatusChart(stats.timeInStatus);
}

// Status Distribution Donut Chart
function renderStatusChart(byStatus) {
  const ctx = document.getElementById('status-chart');
  if (!ctx) return;

  const labels = Object.keys(byStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1));
  const data = Object.values(byStatus);
  const colors = Object.keys(byStatus).map(s => STATUS_COLORS[s] || '#6b7280');

  if (statusChart) statusChart.destroy();

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 12 },
            color: getChartTextColor()
          }
        }
      }
    }
  });
}

// Applications Timeline Line Chart
function renderTimelineChart(weeklyTrend) {
  const ctx = document.getElementById('timeline-chart');
  if (!ctx) return;

  const labels = weeklyTrend.map(w => w.week);
  const data = weeklyTrend.map(w => w.count);
  const textColor = getChartTextColor();

  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Applications',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        x: {
          ticks: {
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Platform Distribution Bar Chart
function renderPlatformChart(byPlatform) {
  const ctx = document.getElementById('platform-chart');
  if (!ctx) return;

  // Sort by count descending
  const sorted = Object.entries(byPlatform)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // Top 6 platforms

  const labels = sorted.map(([p]) => p.charAt(0).toUpperCase() + p.slice(1));
  const data = sorted.map(([, count]) => count);
  const colors = sorted.map(([p]) => PLATFORM_COLORS[p] || '#6b7280');
  const textColor = getChartTextColor();

  if (platformChart) platformChart.destroy();

  platformChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ==================== PHASE 3: ADVANCED ANALYTICS ====================

// Initialize date range filter
function initDateRangeFilter() {
  const presetBtns = document.querySelectorAll('.preset-btn');

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;

      // Update active state
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Handle custom range
      if (range === 'custom') {
        elements.customRange?.classList.remove('hidden');
        // Set default dates
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (elements.dateEnd) elements.dateEnd.value = now.toISOString().split('T')[0];
        if (elements.dateStart) elements.dateStart.value = monthAgo.toISOString().split('T')[0];
      } else {
        elements.customRange?.classList.add('hidden');
        applyDateRange(range === 'all' ? null : parseInt(range));
      }
    });
  });

  // Apply custom range button
  elements.applyRangeBtn?.addEventListener('click', () => {
    const start = elements.dateStart?.value;
    const end = elements.dateEnd?.value;
    if (start && end) {
      applyDateRange({ start, end });
    }
  });
}

// Apply date range filter
async function applyDateRange(range) {
  currentDateRange = range;
  await updateStats();
  // Refresh intelligence panel with new date range
  await loadIntelligencePanel();
}

// Application Funnel Chart (Horizontal Bar)
function renderFunnelChart(funnelData) {
  const ctx = document.getElementById('funnel-chart');
  if (!ctx) return;

  if (!funnelData) {
    // Show empty state
    return;
  }

  const labels = ['Saved', 'Applied', 'Screening', 'Interview', 'Offer'];
  const data = [
    funnelData.saved,
    funnelData.applied,
    funnelData.screening,
    funnelData.interview,
    funnelData.offer
  ];
  const textColor = getChartTextColor();

  // Gradient colors from light to dark
  const colors = [
    'rgba(59, 130, 246, 0.3)',
    'rgba(59, 130, 246, 0.45)',
    'rgba(59, 130, 246, 0.6)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(59, 130, 246, 1)'
  ];

  if (funnelChart) funnelChart.destroy();

  funnelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // Render conversion rates
  renderFunnelConversions(funnelData);
}

// Render funnel conversion rates
function renderFunnelConversions(funnelData) {
  const container = elements.funnelConversions;
  if (!container) return;

  container.innerHTML = `
    <div class="conversion-item">
      <div class="conversion-rate">${funnelData.appliedToScreening}%</div>
      <div class="conversion-label">Applied → Screening</div>
    </div>
    <div class="conversion-item">
      <div class="conversion-rate">${funnelData.screeningToInterview}%</div>
      <div class="conversion-label">Screening → Interview</div>
    </div>
    <div class="conversion-item">
      <div class="conversion-rate">${funnelData.interviewToOffer}%</div>
      <div class="conversion-label">Interview → Offer</div>
    </div>
  `;
}

// Calendar Heatmap - delegates to HeatmapRenderer module
function renderHeatmap(dailyCounts) {
  if (window.HeatmapRenderer) {
    window.HeatmapRenderer.render('#activity-heatmap', dailyCounts);
  }
}

// Time-in-Status Chart
function renderTimeStatusChart(timeInStatus) {
  const ctx = document.getElementById('time-status-chart');
  if (!ctx) return;

  // Check if we have any data
  const hasData = timeInStatus &&
    Object.values(timeInStatus).some(v => v !== null);

  if (!hasData) {
    // Show empty state in the canvas container
    const container = ctx.parentElement;
    if (container && !container.querySelector('.time-status-empty')) {
      ctx.style.display = 'none';
      const emptyState = document.createElement('div');
      emptyState.className = 'time-status-empty';
      emptyState.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>Not enough status history<br>to calculate time data</p>
      `;
      container.appendChild(emptyState);
    }
    return;
  }

  // Remove empty state if it exists
  const container = ctx.parentElement;
  const emptyState = container?.querySelector('.time-status-empty');
  if (emptyState) emptyState.remove();
  ctx.style.display = 'block';

  const labels = ['Saved', 'Applied', 'Screening', 'Interview'];
  const data = [
    timeInStatus.saved || 0,
    timeInStatus.applied || 0,
    timeInStatus.screening || 0,
    timeInStatus.interview || 0
  ];
  const textColor = getChartTextColor();

  // Status-specific colors
  const colors = [
    STATUS_COLORS.saved,
    STATUS_COLORS.applied,
    STATUS_COLORS.screening,
    STATUS_COLORS.interview
  ];

  if (timeStatusChart) timeStatusChart.destroy();

  timeStatusChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Days',
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Average Days',
            color: textColor
          },
          ticks: {
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return value !== null ? `${value} day${value !== 1 ? 's' : ''}` : 'No data';
            }
          }
        }
      }
    }
  });
}

// ==================== VIEW TOGGLE ====================

// Initialize view toggle
function initViewToggle() {
  updateViewToggleButtons();
  applyCurrentView();
}

// Update view toggle button states
function updateViewToggleButtons() {
  elements.viewCardsBtn.classList.toggle('active', currentView === 'cards');
  elements.viewTableBtn.classList.toggle('active', currentView === 'table');

  // Update aria-pressed for accessibility
  elements.viewCardsBtn.setAttribute('aria-pressed', currentView === 'cards');
  elements.viewTableBtn.setAttribute('aria-pressed', currentView === 'table');
}

// Apply current view (show/hide appropriate containers)
function applyCurrentView() {
  if (currentView === 'table') {
    elements.list.classList.add('hidden');
    elements.tableContainer.classList.remove('hidden');
  } else {
    elements.tableContainer.classList.add('hidden');
    elements.list.classList.remove('hidden');
  }
}

// Toggle between card and table view
async function toggleView(view) {
  currentView = view;
  updateViewToggleButtons();
  applyCurrentView();
  render();

  // Save to IndexedDB settings
  try {
    if (cachedSettings) {
      cachedSettings.ui = cachedSettings.ui || {};
      cachedSettings.ui.dashboardView = view;
      await chrome.runtime.sendMessage({
        type: MessageTypes.SAVE_SETTINGS,
        payload: cachedSettings
      });
    }
  } catch (error) {
    console.error('Error saving view preference:', error);
  }
}

// ==================== TABLE RENDERING ====================

// Render table view
function renderTable() {
  elements.tableBody.innerHTML = '';

  filteredApplications.forEach((app) => {
    const row = document.createElement('tr');
    row.dataset.id = escapeHtml(app.id);
    row.className = selectedAppId === app.id ? 'selected' : '';

    // Accessibility: make rows interactive
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-label', `${app.company || 'Unknown'} - ${app.position || 'Unknown'}, Status: ${capitalizeStatus(app.status)}`);

    const tableInitial = escapeHtml((app.company || 'U')[0].toUpperCase());
    const tableStatusClass = `status-${sanitizeStatus(app.status)}`;
    const tableDateStr = formatDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());

    row.innerHTML = `
      <td>
        <div class="table-company">
          <span class="table-icon">${tableInitial}</span>
          <span>${escapeHtml(app.company || 'Unknown')}</span>
        </div>
      </td>
      <td>${escapeHtml(app.position || 'Unknown')}</td>
      <td><span class="status-badge ${tableStatusClass}">${escapeHtml(capitalizeStatus(app.status))}</span></td>
      <td>${escapeHtml(tableDateStr)}</td>
      <td>${escapeHtml(app.location || '-')}</td>
      <td>${escapeHtml(app.salary || '-')}</td>
      <td class="table-actions">
        <button class="action-btn edit-btn" title="Edit" aria-label="Edit ${escapeHtml(app.company || 'application')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-btn delete-btn" title="Delete" aria-label="Delete ${escapeHtml(app.company || 'application')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;

    // Event listeners
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.action-btn')) {
        selectApp(app.id);
      }
    });

    // Keyboard support for table rows
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectApp(app.id);
      }
    });

    row.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(app);
    });

    row.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteApplication(app.id);
    });

    elements.tableBody.appendChild(row);
  });
}

// ==================== CSV EXPORT ====================

// Export applications to CSV
function exportToCSV() {
  const headers = [
    'Company', 'Position', 'Status', 'Date Applied',
    'Location', 'Salary', 'Job Type', 'Remote', 'URL', 'Job Description', 'Notes', 'Platform'
  ];

  const rows = filteredApplications.map(app => [
    app.company || '',
    app.position || '',
    app.status || '',
    app.dateApplied ? new Date(app.dateApplied).toLocaleDateString() : '',
    app.location || '',
    app.salary || '',
    app.jobType || '',
    app.remote || '',
    app.jobUrl || '',
    (app.jobDescription || '').replace(/[\n\r]+/g, ' '),
    (app.notes || '').replace(/[\n\r]+/g, ' '),
    app.platform || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jobtracker-export-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ==================== NAVIGATION ====================

// Setup sidebar navigation
function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view) {
        switchPage(view);
      }
    });
  });
}

// Switch between pages (applications vs stats)
function switchPage(page) {
  currentPage = page;

  // Update nav item active state and aria-current
  elements.navItems.forEach(item => {
    const isActive = item.dataset.view === page;
    item.classList.toggle('active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  // Switch views
  if (page === 'stats') {
    // Show expanded stats view
    elements.headerTitle.textContent = 'Statistics';
    elements.filtersSection.classList.add('hidden');
    elements.applicationsSection.classList.add('hidden');
    elements.statsSection.classList.add('stats-expanded');
    elements.detailsPanel.classList.add('hidden');

    // Hide view toggle and export buttons for stats page
    document.querySelector('.header-right .view-toggle')?.classList.add('hidden');
    document.getElementById('export-btn')?.classList.add('hidden');
    document.getElementById('add-btn')?.classList.add('hidden');
    elements.appCount?.classList.add('hidden');

    // Show date range filter
    elements.dateRangeFilter?.classList.remove('hidden');

    // Show charts and refresh them
    updateStats();

    // Load intelligence panel
    loadIntelligencePanel();
  } else {
    // Show applications view
    elements.headerTitle.textContent = 'Applications';
    elements.filtersSection.classList.remove('hidden');
    elements.applicationsSection.classList.remove('hidden');
    elements.statsSection.classList.remove('stats-expanded');

    // Show view toggle and export buttons for applications page
    document.querySelector('.header-right .view-toggle')?.classList.remove('hidden');
    document.getElementById('export-btn')?.classList.remove('hidden');
    document.getElementById('add-btn')?.classList.remove('hidden');
    elements.appCount?.classList.remove('hidden');

    // Hide date range filter, charts section, and intelligence panel
    elements.dateRangeFilter?.classList.add('hidden');
    document.getElementById('charts-section')?.classList.add('hidden');
    elements.intelligencePanel?.classList.add('hidden');
  }

  // Close mobile sidebar after navigation
  if (window.innerWidth < 900) {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.add('hidden');
  }
}

// Toggle job description expand/collapse in details panel
function toggleDetailsDescription(btn) {
  const content = btn.closest('.details-description').querySelector('.details-description-content');
  const isExpanded = content.dataset.expanded === 'true';
  content.dataset.expanded = !isExpanded;
  btn.classList.toggle('expanded', !isExpanded);
}

// Show overlay for details panel on mobile
function showDetailsOverlay() {
  let overlay = document.getElementById('details-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'details-overlay';
    overlay.className = 'details-overlay';
    overlay.addEventListener('click', closeDetailsPanel);
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
}

// Hide overlay for details panel
function hideDetailsOverlay() {
  const overlay = document.getElementById('details-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Close details panel
function closeDetailsPanel() {
  elements.detailsPanel?.classList.add('hidden');
  selectedAppId = null;
  document.querySelectorAll('.app-card').forEach(card => card.classList.remove('selected'));
  hideDetailsOverlay();
}

// ==================== PHASE 4: INTELLIGENCE PANEL ====================

// State for goal display
let currentGoalType = 'weekly'; // 'weekly' or 'monthly'

// Setup intelligence panel event listeners
function setupIntelligencePanel() {
  // Goal settings button
  elements.goalSettingsBtn?.addEventListener('click', openGoalModal);
  elements.goalSetupBtn?.addEventListener('click', openGoalModal);

  // Goal modal
  elements.closeGoalModal?.addEventListener('click', closeGoalModal);
  elements.cancelGoalBtn?.addEventListener('click', closeGoalModal);
  elements.goalModal?.addEventListener('click', (e) => {
    if (e.target === elements.goalModal) closeGoalModal();
  });
  elements.goalForm?.addEventListener('submit', handleGoalSubmit);

  // Toggle input rows based on checkbox state
  elements.weeklyGoalEnabled?.addEventListener('change', (e) => {
    elements.weeklyGoalInputRow?.classList.toggle('enabled', e.target.checked);
  });
  elements.monthlyGoalEnabled?.addEventListener('change', (e) => {
    elements.monthlyGoalInputRow?.classList.toggle('enabled', e.target.checked);
  });
}

// Load intelligence panel data
async function loadIntelligencePanel() {
  if (currentPage !== 'stats') return;

  try {
    const [insights, recommendations, goalProgress] = await Promise.all([
      chrome.runtime.sendMessage({ type: MessageTypes.GET_INSIGHTS, payload: { dateRange: currentDateRange } }),
      chrome.runtime.sendMessage({ type: MessageTypes.GET_RECOMMENDATIONS }),
      chrome.runtime.sendMessage({ type: MessageTypes.GET_GOAL_PROGRESS })
    ]);

    renderInsights(insights || []);
    renderRecommendations(recommendations || []);
    renderGoalProgress(goalProgress);

    // Show the panel
    elements.intelligencePanel?.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading intelligence panel:', error);
  }
}

// Render insights
function renderInsights(insights) {
  if (!elements.insightsList) return;

  if (!insights || insights.length === 0) {
    elements.insightsList.innerHTML = `
      <div class="insights-empty">
        <p>Add more applications to see insights</p>
      </div>
    `;
    return;
  }

  elements.insightsList.innerHTML = insights.map(insight => `
    <div class="insight-item insight-${insight.type}">
      <div class="insight-icon">
        ${getInsightIcon(insight.icon)}
      </div>
      <div class="insight-message">${escapeHtml(insight.message)}</div>
    </div>
  `).join('');
}

// Get SVG icon for insight type
function getInsightIcon(iconName) {
  const icons = {
    'trending-up': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
    'trending-down': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>',
    'calendar': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    'alert-circle': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    'clock': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  };
  return icons[iconName] || icons['alert-circle'];
}

// Render recommendations
function renderRecommendations(recommendations) {
  if (!elements.recommendationsList) return;

  if (!recommendations || recommendations.length === 0) {
    elements.recommendationsList.innerHTML = `
      <div class="recommendations-empty">
        <p>Great job! No recommendations at this time.</p>
      </div>
    `;
    return;
  }

  elements.recommendationsList.innerHTML = recommendations.map(rec => `
    <div class="recommendation-item rec-${rec.type}">
      <div class="recommendation-header">
        <div class="recommendation-icon">
          ${getRecommendationIcon(rec.icon)}
        </div>
        <div class="recommendation-content">
          <h5 class="recommendation-title">${escapeHtml(rec.title)}</h5>
          <p class="recommendation-message">${escapeHtml(rec.message)}</p>
        </div>
      </div>
      ${rec.action ? `
        <div class="recommendation-action">
          <button class="recommendation-action-btn" data-action="${escapeHtml(rec.action.type)}">
            ${escapeHtml(rec.action.label)}
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Add event listeners for action buttons
  elements.recommendationsList.querySelectorAll('.recommendation-action-btn').forEach(btn => {
    btn.addEventListener('click', () => handleRecommendationAction(btn.dataset.action));
  });
}

// Get SVG icon for recommendation type
function getRecommendationIcon(iconName) {
  const icons = {
    'plus-circle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
    'mail': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    'target': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
    'check-circle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    'award': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>'
  };
  return icons[iconName] || icons['target'];
}

// Handle recommendation action button click
function handleRecommendationAction(actionType) {
  switch (actionType) {
    case 'add_application':
      openModal();
      break;
    case 'filter_screening':
      // Switch to applications view and filter by screening
      switchPage('applications');
      elements.filterStatus.value = 'screening';
      applyFilters();
      break;
    default:
      console.log('Unknown action:', actionType);
  }
}

// Render goal progress
function renderGoalProgress(progress) {
  if (!elements.goalProgressContainer || !progress) return;

  const hasWeeklyGoal = progress.weekly.enabled && progress.weekly.target > 0;
  const hasMonthlyGoal = progress.monthly.enabled && progress.monthly.target > 0;

  if (!hasWeeklyGoal && !hasMonthlyGoal) {
    elements.goalProgressContainer.innerHTML = `
      <div class="goal-empty-state">
        <p>Set weekly or monthly goals to track your progress</p>
        <button class="btn-secondary btn-sm" id="goal-setup-btn-inner">Set Goals</button>
      </div>
    `;
    document.getElementById('goal-setup-btn-inner')?.addEventListener('click', openGoalModal);
    return;
  }

  // Determine which goal to show (prefer weekly if both enabled)
  const activeGoal = hasWeeklyGoal ? progress.weekly : progress.monthly;
  const goalLabel = hasWeeklyGoal ? 'This Week' : 'This Month';

  // Calculate circumference for SVG ring (radius = 42)
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (activeGoal.percentage / 100) * circumference;

  elements.goalProgressContainer.innerHTML = `
    ${(hasWeeklyGoal && hasMonthlyGoal) ? `
      <div class="goal-type-selector">
        <button class="goal-type-btn ${currentGoalType === 'weekly' ? 'active' : ''}" data-type="weekly">Weekly</button>
        <button class="goal-type-btn ${currentGoalType === 'monthly' ? 'active' : ''}" data-type="monthly">Monthly</button>
      </div>
    ` : ''}
    <div class="goal-progress-ring-container">
      <div class="goal-progress-ring">
        <svg viewBox="0 0 100 100">
          <circle class="ring-bg" cx="50" cy="50" r="42"></circle>
          <circle class="ring-progress ${activeGoal.completed ? 'completed' : ''}" cx="50" cy="50" r="42"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="goal-progress-center">
          <div class="goal-progress-value">${activeGoal.percentage}%</div>
          <div class="goal-progress-label">${goalLabel}</div>
        </div>
      </div>
      <div class="goal-stats">
        <div class="goal-stat-row">
          <span class="label">Current</span>
          <span class="value ${activeGoal.completed ? 'completed' : ''}">${activeGoal.current} apps</span>
        </div>
        <div class="goal-stat-row">
          <span class="label">Target</span>
          <span class="value">${activeGoal.target} apps</span>
        </div>
        <div class="goal-stat-row">
          <span class="label">Remaining</span>
          <span class="value">${Math.max(0, activeGoal.target - activeGoal.current)} apps</span>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for goal type toggle
  elements.goalProgressContainer.querySelectorAll('.goal-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentGoalType = btn.dataset.type;
      // Re-render with new goal type
      const newActiveGoal = currentGoalType === 'weekly' ? progress.weekly : progress.monthly;
      const newLabel = currentGoalType === 'weekly' ? 'This Week' : 'This Month';
      const newCircumference = 2 * Math.PI * 42;
      const newOffset = newCircumference - (newActiveGoal.percentage / 100) * newCircumference;

      // Update active button
      elements.goalProgressContainer.querySelectorAll('.goal-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === currentGoalType);
      });

      // Update ring
      const ringProgress = elements.goalProgressContainer.querySelector('.ring-progress');
      const progressValue = elements.goalProgressContainer.querySelector('.goal-progress-value');
      const progressLabel = elements.goalProgressContainer.querySelector('.goal-progress-label');
      const statsValues = elements.goalProgressContainer.querySelectorAll('.goal-stat-row .value');

      if (ringProgress) {
        ringProgress.style.strokeDashoffset = newOffset;
        ringProgress.classList.toggle('completed', newActiveGoal.completed);
      }
      if (progressValue) progressValue.textContent = `${newActiveGoal.percentage}%`;
      if (progressLabel) progressLabel.textContent = newLabel;
      if (statsValues[0]) {
        statsValues[0].textContent = `${newActiveGoal.current} apps`;
        statsValues[0].classList.toggle('completed', newActiveGoal.completed);
      }
      if (statsValues[1]) statsValues[1].textContent = `${newActiveGoal.target} apps`;
      if (statsValues[2]) statsValues[2].textContent = `${Math.max(0, newActiveGoal.target - newActiveGoal.current)} apps`;
    });
  });
}

// Open goal modal
async function openGoalModal() {
  try {
    const settings = await chrome.runtime.sendMessage({ type: MessageTypes.GET_SETTINGS });
    const goals = settings?.goals || { weekly: { target: 0, enabled: false }, monthly: { target: 0, enabled: false } };

    // Populate form
    elements.weeklyGoalEnabled.checked = goals.weekly.enabled;
    elements.weeklyGoal.value = goals.weekly.target || '';
    elements.weeklyGoalInputRow.classList.toggle('enabled', goals.weekly.enabled);

    elements.monthlyGoalEnabled.checked = goals.monthly.enabled;
    elements.monthlyGoal.value = goals.monthly.target || '';
    elements.monthlyGoalInputRow.classList.toggle('enabled', goals.monthly.enabled);

    elements.goalModal?.classList.remove('hidden');
    elements.weeklyGoal.focus();
  } catch (error) {
    console.error('Error opening goal modal:', error);
  }
}

// Close goal modal
function closeGoalModal() {
  elements.goalModal?.classList.add('hidden');
}

// Handle goal form submission
async function handleGoalSubmit(e) {
  e.preventDefault();

  const goals = {
    weekly: {
      enabled: elements.weeklyGoalEnabled.checked,
      target: parseInt(elements.weeklyGoal.value) || 0
    },
    monthly: {
      enabled: elements.monthlyGoalEnabled.checked,
      target: parseInt(elements.monthlyGoal.value) || 0
    }
  };

  try {
    await chrome.runtime.sendMessage({ type: MessageTypes.SAVE_GOALS, payload: goals });
    closeGoalModal();
    // Refresh intelligence panel
    await loadIntelligencePanel();
  } catch (error) {
    console.error('Error saving goals:', error);
    showNotification('Failed to save goals. Please try again.', 'error');
  }
}

// Make functions available globally for inline onclick handlers
window.openModal = openModal;
window.deleteApplication = deleteApplication;
window.toggleDetailsDescription = toggleDetailsDescription;
// Use getter so it always returns the current applications array
Object.defineProperty(window, 'applications', {
  get: function() { return applications; }
});
