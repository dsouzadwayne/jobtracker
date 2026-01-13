/**
 * JobTracker Applications Page Script
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
  },

  setupListeners() {
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
  DELETE_APPLICATION: 'DELETE_APPLICATION'
};

// State
let applications = [];
let filteredApplications = [];
let expandedCardId = null;

// DOM Elements
const elements = {
  list: document.getElementById('applications-list'),
  emptyState: document.getElementById('empty-state'),
  appCount: document.getElementById('app-count'),
  searchInput: document.getElementById('search-input'),
  filterStatus: document.getElementById('filter-status'),
  filterSort: document.getElementById('filter-sort'),
  addBtn: document.getElementById('add-btn'),
  emptyAddBtn: document.getElementById('empty-add-btn'),
  modal: document.getElementById('app-modal'),
  modalTitle: document.getElementById('modal-title'),
  closeModal: document.getElementById('close-modal'),
  cancelBtn: document.getElementById('cancel-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  appForm: document.getElementById('app-form'),
  statusModal: document.getElementById('status-modal'),
  closeStatusModal: document.getElementById('close-status-modal'),
  cancelStatusBtn: document.getElementById('cancel-status-btn'),
  statusForm: document.getElementById('status-form')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await ThemeManager.init();
  await loadApplications();
  setupEventListeners();
  checkUrlParams();
  setupBackNavigation();
});

// Setup context-aware back navigation
function setupBackNavigation() {
  const backBtn = document.getElementById('back-btn');
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get('from');

  if (from === 'dashboard') {
    backBtn.href = 'dashboard.html';
  } else {
    // From popup context or direct navigation
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Try to use browser history if available
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // Fallback to popup
        window.location.href = 'popup.html';
      }
    });
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
    elements.emptyState.classList.remove('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.list.innerHTML = '';

  filteredApplications.forEach(app => {
    elements.list.appendChild(createAppCard(app));
  });
}

// Create application card
function createAppCard(app) {
  const card = document.createElement('div');
  card.className = 'app-card';
  card.dataset.id = escapeHtml(app.id);

  const initial = escapeHtml((app.company || 'U')[0].toUpperCase());
  const dateStr = formatDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());
  const statusClass = `status-${sanitizeStatus(app.status)}`;
  const isExpanded = expandedCardId === app.id;

  card.innerHTML = `
    <div class="app-card-header">
      <div class="app-card-main">
        <div class="app-icon">${initial}</div>
        <div class="app-info">
          <div class="app-company">${escapeHtml(app.company || 'Unknown Company')}</div>
          <div class="app-position">${escapeHtml(app.position || 'Unknown Position')}</div>
          <div class="app-meta">
            ${app.location ? `<span class="app-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              ${escapeHtml(app.location)}
            </span>` : ''}
            <span class="app-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${escapeHtml(dateStr)}
            </span>
            ${app.platform && app.platform !== 'other' ? `<span class="app-meta-item">${escapeHtml(capitalizeStatus(app.platform))}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="app-card-actions">
        <span class="status-badge ${statusClass}" data-action="status">${escapeHtml(capitalizeStatus(app.status))}</span>
        <div class="app-actions-menu">
          ${app.jobUrl ? `<button class="open-url" title="Open Job URL" data-url="${escapeHtml(app.jobUrl)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>` : ''}
          <button class="edit" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="delete" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
    ${isExpanded ? createExpandedDetails(app) : ''}
  `;

  // Event listeners
  card.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.status-badge')) return;
    toggleExpand(app.id);
  });

  const statusBadge = card.querySelector('[data-action="status"]');
  statusBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    openStatusModal(app);
  });

  const editBtn = card.querySelector('.edit');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(app);
  });

  const deleteBtn = card.querySelector('.delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteApplication(app.id);
  });

  const openUrlBtn = card.querySelector('.open-url');
  if (openUrlBtn) {
    openUrlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(openUrlBtn.dataset.url, '_blank');
    });
  }

  return card;
}

// Create expanded details view
function createExpandedDetails(app) {
  return `
    <div class="app-card-details">
      <div class="app-details-grid">
        ${app.salary ? `<div class="app-detail-item">
          <div class="app-detail-label">Salary</div>
          <div class="app-detail-value">${escapeHtml(app.salary)}</div>
        </div>` : ''}
        ${app.jobType ? `<div class="app-detail-item">
          <div class="app-detail-label">Job Type</div>
          <div class="app-detail-value">${escapeHtml(capitalizeStatus(app.jobType))}</div>
        </div>` : ''}
        ${app.remote ? `<div class="app-detail-item">
          <div class="app-detail-label">Remote</div>
          <div class="app-detail-value">${escapeHtml(capitalizeStatus(app.remote))}</div>
        </div>` : ''}
        ${app.autoDetected ? `<div class="app-detail-item">
          <div class="app-detail-label">Source</div>
          <div class="app-detail-value">Auto-detected</div>
        </div>` : ''}
      </div>
      ${app.notes ? `<div class="app-notes">
        <div class="app-notes-label">Notes</div>
        ${escapeHtml(app.notes)}
      </div>` : ''}
      ${app.statusHistory && app.statusHistory.length > 1 ? `
        <div class="status-history">
          <div class="status-history-title">Status History</div>
          <div class="status-timeline">
            ${app.statusHistory.slice().reverse().map(entry => `
              <div class="status-timeline-item">
                <strong>${escapeHtml(capitalizeStatus(entry.status))}</strong>
                <div class="status-timeline-date">${escapeHtml(formatDate(entry.date || new Date().toISOString()))}</div>
                ${entry.notes ? `<div class="status-timeline-note">${escapeHtml(entry.notes)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Toggle card expansion
function toggleExpand(id) {
  expandedCardId = expandedCardId === id ? null : id;
  render();
}

// Setup event listeners
function setupEventListeners() {
  // Filters
  elements.searchInput.addEventListener('input', debounce(applyFilters, 300));
  elements.filterStatus.addEventListener('change', applyFilters);
  elements.filterSort.addEventListener('change', applyFilters);

  // Add buttons
  elements.addBtn.addEventListener('click', () => openModal());
  elements.emptyAddBtn.addEventListener('click', () => openModal());

  // Modal
  elements.closeModal.addEventListener('click', closeModal);
  elements.cancelBtn.addEventListener('click', closeModal);
  elements.deleteBtn.addEventListener('click', handleDelete);
  elements.appForm.addEventListener('submit', handleSubmit);
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });

  // Status Modal
  elements.closeStatusModal.addEventListener('click', closeStatusModal);
  elements.cancelStatusBtn.addEventListener('click', closeStatusModal);
  elements.statusForm.addEventListener('submit', handleStatusSubmit);
  elements.statusModal.addEventListener('click', (e) => {
    if (e.target === elements.statusModal) closeStatusModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.modal.classList.contains('hidden')) closeModal();
      if (!elements.statusModal.classList.contains('hidden')) closeStatusModal();
    }
  });
}

// Check URL params
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    const app = applications.find(a => a.id === id);
    if (app) {
      expandedCardId = id;
      render();
      // Scroll to card
      setTimeout(() => {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
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
  } catch (error) {
    console.log('Error saving application:', error);
    alert('Error saving application. Please try again.');
  }
}

// Handle delete
async function handleDelete() {
  const id = document.getElementById('app-id').value;
  if (!id) return;

  if (!confirm('Are you sure you want to delete this application?')) return;

  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.DELETE_APPLICATION,
      payload: { id }
    });

    closeModal();
    await loadApplications();
  } catch (error) {
    console.log('Error deleting application:', error);
    alert('Error deleting application. Please try again.');
  }
}

// Delete application directly
async function deleteApplication(id) {
  if (!confirm('Are you sure you want to delete this application?')) return;

  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.DELETE_APPLICATION,
      payload: { id }
    });

    await loadApplications();
  } catch (error) {
    console.log('Error deleting application:', error);
  }
}

// Open status modal
function openStatusModal(app) {
  document.getElementById('status-app-id').value = app.id;
  document.getElementById('new-status').value = app.status || 'applied';
  document.getElementById('status-note').value = '';
  elements.statusModal.classList.remove('hidden');
}

// Close status modal
function closeStatusModal() {
  elements.statusModal.classList.add('hidden');
}

// Handle status update
async function handleStatusSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('status-app-id').value;
  const status = document.getElementById('new-status').value;
  const statusNote = document.getElementById('status-note').value.trim();

  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.UPDATE_APPLICATION,
      payload: { id, status, statusNote }
    });

    closeStatusModal();
    await loadApplications();
  } catch (error) {
    console.log('Error updating status:', error);
    alert('Error updating status. Please try again.');
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
    'lever': /lever\.co/i,
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
