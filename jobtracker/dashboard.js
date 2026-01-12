/**
 * JobTracker Dashboard Script
 * Standalone web app for managing job applications
 */

// Theme Management (uses localStorage for quick UI preference)
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_theme',

  init() {
    const theme = this.getTheme();
    this.applyTheme(theme);
    this.setupListeners();
  },

  getTheme() {
    return localStorage.getItem(this.STORAGE_KEY) || 'system';
  },

  setTheme(theme) {
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme(theme);
  },

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = current === 'dark' || (current === null && prefersDark);
    this.setTheme(isDark ? 'light' : 'dark');
  },

  setupListeners() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const theme = this.getTheme();
      if (theme === 'system') {
        this.applyTheme('system');
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
  GET_APPLICATION_STATS: 'GET_APPLICATION_STATS'
};

// State
let applications = [];
let filteredApplications = [];
let selectedAppId = null;
let currentView = localStorage.getItem('dashboardView') || 'cards';
let currentPage = 'applications'; // 'applications' or 'stats'

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

  ThemeManager.init();
  await loadApplications();
  await updateStats();
  setupEventListeners();
  setupKeyboardShortcuts();
  initViewToggle();
  setupNavigation();
});

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
    const stats = await chrome.runtime.sendMessage({ type: MessageTypes.GET_APPLICATION_STATS });
    if (stats) {
      elements.statTotal.textContent = stats.total || 0;
      elements.statWeek.textContent = stats.thisWeek || 0;
      elements.statInterviews.textContent = stats.byStatus?.interview || 0;
      elements.statOffers.textContent = stats.byStatus?.offer || 0;
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
  card.dataset.id = app.id;

  const initial = (app.company || 'U')[0].toUpperCase();
  const dateStr = formatDate(app.dateApplied || app.meta?.createdAt);
  const statusClass = `status-${app.status || 'applied'}`;

  card.innerHTML = `
    <div class="app-card-header">
      <div class="app-icon">${initial}</div>
      <div class="app-info">
        <div class="app-company">${escapeHtml(app.company || 'Unknown Company')}</div>
        <div class="app-position">${escapeHtml(app.position || 'Unknown Position')}</div>
      </div>
      <span class="status-badge ${statusClass}">${capitalizeStatus(app.status)}</span>
    </div>
    <div class="app-card-footer">
      <span class="app-date">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        ${dateStr}
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

  // Show details panel on larger screens
  if (app && window.innerWidth >= 1200) {
    showDetailsPanel(app);
  } else if (app) {
    openModal(app);
  }
}

// Show details panel
function showDetailsPanel(app) {
  elements.detailsPosition.textContent = app.position || 'Unknown Position';

  elements.detailsContent.innerHTML = `
    <div class="details-company">
      <span class="company-initial">${(app.company || 'U')[0].toUpperCase()}</span>
      <div>
        <div class="company-name">${escapeHtml(app.company || 'Unknown Company')}</div>
        ${app.location ? `<div class="company-location">${escapeHtml(app.location)}</div>` : ''}
      </div>
    </div>

    <div class="details-status">
      <span class="status-badge status-${app.status}">${capitalizeStatus(app.status)}</span>
      <span class="details-date">${formatDate(app.dateApplied || app.meta?.createdAt)}</span>
    </div>

    ${app.salary ? `<div class="details-field"><strong>Salary:</strong> ${escapeHtml(app.salary)}</div>` : ''}
    ${app.jobType ? `<div class="details-field"><strong>Type:</strong> ${capitalizeStatus(app.jobType)}</div>` : ''}
    ${app.remote ? `<div class="details-field"><strong>Remote:</strong> ${capitalizeStatus(app.remote)}</div>` : ''}
    ${app.jobUrl ? `<div class="details-field"><a href="${escapeHtml(app.jobUrl)}" target="_blank" class="job-link">View Job Posting</a></div>` : ''}
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
  elements.themeToggle?.addEventListener('click', () => ThemeManager.toggleTheme());

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
  elements.closeDetails?.addEventListener('click', () => {
    elements.detailsPanel?.classList.add('hidden');
    selectedAppId = null;
    document.querySelectorAll('.app-card').forEach(card => card.classList.remove('selected'));
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.modal.classList.contains('hidden')) closeModal();
      if (!elements.detailsPanel.classList.contains('hidden')) {
        elements.detailsPanel.classList.add('hidden');
        selectedAppId = null;
      }
    }
  });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't handle if in input/textarea
    if (e.target.matches('input, textarea, select')) return;

    switch (e.key) {
      case 'n':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          openModal();
        }
        break;
      case 'j':
        navigateList(1);
        break;
      case 'k':
        navigateList(-1);
        break;
      case 'Enter':
        if (selectedAppId) {
          const app = applications.find(a => a.id === selectedAppId);
          if (app) openModal(app);
        }
        break;
    }
  });
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
  elements.sidebar.classList.toggle('open');
  elements.sidebarOverlay.classList.toggle('hidden');
}

// Open modal
function openModal(app = null) {
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
    document.getElementById('app-notes').value = app.notes || '';
  } else {
    document.getElementById('app-id').value = '';
    document.getElementById('app-date').value = new Date().toISOString().split('T')[0];
  }

  elements.modal.classList.remove('hidden');
  document.getElementById('app-company').focus();
}

// Close modal
function closeModal() {
  elements.modal.classList.add('hidden');
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
    console.error('Error saving application:', error);
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
    console.error('Error deleting application:', error);
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
function toggleView(view) {
  currentView = view;
  localStorage.setItem('dashboardView', view);
  updateViewToggleButtons();
  applyCurrentView();
  render();
}

// ==================== TABLE RENDERING ====================

// Render table view
function renderTable() {
  elements.tableBody.innerHTML = '';

  filteredApplications.forEach(app => {
    const row = document.createElement('tr');
    row.dataset.id = app.id;
    row.className = selectedAppId === app.id ? 'selected' : '';

    row.innerHTML = `
      <td>
        <div class="table-company">
          <span class="table-icon">${(app.company || 'U')[0].toUpperCase()}</span>
          <span>${escapeHtml(app.company || 'Unknown')}</span>
        </div>
      </td>
      <td>${escapeHtml(app.position || 'Unknown')}</td>
      <td><span class="status-badge status-${app.status || 'applied'}">${capitalizeStatus(app.status)}</span></td>
      <td>${formatDate(app.dateApplied || app.meta?.createdAt)}</td>
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
    'Location', 'Salary', 'Job Type', 'Remote', 'URL', 'Notes', 'Platform'
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

  // Update nav item active state
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === page);
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

// Make functions available globally for inline onclick handlers
window.openModal = openModal;
window.deleteApplication = deleteApplication;
// Use getter so it always returns the current applications array
Object.defineProperty(window, 'applications', {
  get: function() { return applications; }
});
