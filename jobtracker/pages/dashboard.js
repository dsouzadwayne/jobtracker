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
  SAVE_SETTINGS: 'SAVE_SETTINGS'
};

// State
let applications = [];
let filteredApplications = [];
let selectedAppId = null;
let currentView = 'cards'; // Will be loaded from settings
let currentPage = 'applications'; // 'applications' or 'stats'
let cachedSettings = null; // Cache settings for view preference updates

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
    headerTitle: document.querySelector('.header-left h1')
  };

  await ThemeManager.init();
  await loadSettings();
  await loadApplications();
  await updateStats();
  setupEventListeners();
  setupKeyboardShortcuts();
  initViewToggle();
  setupNavigation();
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
    console.log('Error loading settings:', error);
  }
}

// Load applications
async function loadApplications() {
  try {
    applications = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATIONS }) || [];
    applyFilters();
  } catch (error) {
    console.log('Error loading applications:', error);
  }
}

// Update stats
async function updateStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATION_STATS });
    if (stats) {
      elements.statTotal.textContent = stats.total || 0;
      elements.statWeek.textContent = stats.thisWeek || 0;
      elements.statInterviews.textContent = stats.byStatus?.interview || 0;
      elements.statOffers.textContent = stats.byStatus?.offer || 0;
    }
  } catch (error) {
    console.log('Error loading stats:', error);
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
    ${app.jobUrl ? `<div class="details-field">
      <a href="${escapeHtml(app.jobUrl)}" target="_blank" rel="noopener noreferrer" class="job-link">
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
  elements.closeModal?.addEventListener('click', closeModal);
  elements.cancelBtn?.addEventListener('click', closeModal);
  elements.deleteBtn?.addEventListener('click', handleDelete);
  elements.appForm?.addEventListener('submit', handleSubmit);
  elements.modal?.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });

  // Details panel
  elements.closeDetails?.addEventListener('click', closeDetailsPanel);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.modal.classList.contains('hidden')) closeModal();
      if (!elements.detailsPanel.classList.contains('hidden')) closeDetailsPanel();
    }
  });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't handle if in input/textarea (except for Escape)
    if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;

    // Skip if modal is open (except for Escape which is handled elsewhere)
    if (!elements.modal.classList.contains('hidden') && e.key !== 'Escape') return;

    switch (e.key) {
      case 'n':
        // Require Ctrl/Cmd modifier to avoid conflicts with typing
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          openModal();
        }
        break;
      case 'j':
        e.preventDefault();
        navigateList(1);
        break;
      case 'k':
        e.preventDefault();
        navigateList(-1);
        break;
      case 'Enter':
        if (selectedAppId) {
          const app = applications.find(a => a.id === selectedAppId);
          if (app) openModal(app);
        }
        break;
      case '?':
        e.preventDefault();
        showKeyboardShortcutsHelp();
        break;
    }
  });
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
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const focusableArray = Array.from(focusableElements).filter(el => !el.disabled && el.offsetParent !== null);

  if (focusableArray.length === 0) return;

  const firstFocusable = focusableArray[0];
  const lastFocusable = focusableArray[focusableArray.length - 1];

  // Remove old handler if exists
  if (focusTrapHandler) {
    modal.removeEventListener('keydown', focusTrapHandler);
  }

  focusTrapHandler = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  modal.addEventListener('keydown', focusTrapHandler);
}

// Open modal
function openModal(app = null) {
  // Store the currently focused element for restoration
  previouslyFocusedElement = document.activeElement;

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

// Close modal
function closeModal() {
  elements.modal.classList.add('hidden');

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

    closeModal();
    await loadApplications();
    await updateStats();
  } catch (error) {
    console.log('Error saving application:', error);
    alert('Error saving application. Please try again.');
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
    }

    await loadApplications();
    await updateStats();
  } catch (error) {
    console.log('Error deleting application:', error);
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
    console.log('Error saving view preference:', error);
  }
}

// ==================== TABLE RENDERING ====================

// Render table view
function renderTable() {
  elements.tableBody.innerHTML = '';

  filteredApplications.forEach(app => {
    const row = document.createElement('tr');
    row.dataset.id = escapeHtml(app.id);
    row.className = selectedAppId === app.id ? 'selected' : '';

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
      <td><span class="status-badge ${tableStatusClass}" aria-label="Status: ${escapeHtml(capitalizeStatus(app.status))}">${escapeHtml(capitalizeStatus(app.status))}</span></td>
      <td>${escapeHtml(tableDateStr)}</td>
      <td>${escapeHtml(app.location || '-')}</td>
      <td>${escapeHtml(app.salary || '-')}</td>
      <td class="table-actions">
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
      </td>
    `;

    // Event listeners
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.action-btn')) {
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

// Make functions available globally for inline onclick handlers
window.openModal = openModal;
window.deleteApplication = deleteApplication;
window.toggleDetailsDescription = toggleDetailsDescription;
// Use getter so it always returns the current applications array
Object.defineProperty(window, 'applications', {
  get: function() { return applications; }
});
