/**
 * Dashboard Views Module
 * Card view, table view rendering, and view switching
 */

import {
  state, elements, MessageTypes,
  getCurrentView, setCurrentView, getCachedSettings, setCachedSettings,
  getFilteredApplications, getSelectedAppId
} from './state.js';
import { escapeHtml, formatDate, capitalizeStatus, sanitizeStatus } from './utils.js';

// References to external functions (set during initialization)
let selectAppCallback = null;
let openModalCallback = null;
let deleteApplicationCallback = null;

export function setViewCallbacks(callbacks) {
  selectAppCallback = callbacks.selectApp;
  openModalCallback = callbacks.openModal;
  deleteApplicationCallback = callbacks.deleteApplication;
}

// Initialize view toggle
export function initViewToggle() {
  updateViewToggleButtons();
  applyCurrentView();
}

// Update view toggle button states
export function updateViewToggleButtons() {
  const currentView = getCurrentView();
  elements.viewCardsBtn?.classList.toggle('active', currentView === 'cards');
  elements.viewTableBtn?.classList.toggle('active', currentView === 'table');

  // Update aria-pressed for accessibility
  elements.viewCardsBtn?.setAttribute('aria-pressed', currentView === 'cards');
  elements.viewTableBtn?.setAttribute('aria-pressed', currentView === 'table');
}

// Apply current view (show/hide appropriate containers)
export function applyCurrentView() {
  const currentView = getCurrentView();
  if (currentView === 'table') {
    elements.list?.classList.add('hidden');
    elements.tableContainer?.classList.remove('hidden');
  } else {
    elements.tableContainer?.classList.add('hidden');
    elements.list?.classList.remove('hidden');
  }
}

// Toggle between card and table view
export async function toggleView(view) {
  setCurrentView(view);
  updateViewToggleButtons();
  applyCurrentView();
  render();

  // Save to IndexedDB settings
  try {
    const cachedSettings = getCachedSettings();
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

// Render applications based on current view
export function render() {
  const filteredApplications = getFilteredApplications();

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

    if (hasActiveFilters && state.applications.length > 0) {
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
  if (getCurrentView() === 'table') {
    renderTable();
  } else {
    elements.list.innerHTML = '';
    filteredApplications.forEach(app => {
      elements.list.appendChild(createAppCard(app));
    });
  }
}

// Get deadline badge HTML
export function getDeadlineBadge(app) {
  if (!app.deadline) return '';

  const now = new Date();
  const deadline = new Date(app.deadline);
  const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return `<span class="deadline-badge deadline-expired" title="Deadline passed">Expired</span>`;
  } else if (daysUntil <= 3) {
    return `<span class="deadline-badge deadline-urgent" title="Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}">${daysUntil}d left</span>`;
  } else if (daysUntil <= 7) {
    return `<span class="deadline-badge deadline-soon" title="Due in ${daysUntil} days">${daysUntil}d left</span>`;
  }
  return '';
}

// Render tag chips for an application
export function renderTagChips(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.slice(0, 3).map(tag =>
    `<span class="tag-chip-small">${escapeHtml(tag)}</span>`
  ).join('') + (tags.length > 3 ? `<span class="tag-chip-more">+${tags.length - 3}</span>` : '');
}

// Create application card
export function createAppCard(app) {
  const card = document.createElement('div');
  const selectedAppId = getSelectedAppId();
  card.className = `app-card ${selectedAppId === app.id ? 'selected' : ''}`;
  card.dataset.id = escapeHtml(app.id);

  const initial = escapeHtml((app.company || 'U')[0].toUpperCase());
  const dateStr = formatDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());
  const statusClass = `status-${sanitizeStatus(app.status)}`;

  // CRM Enhancement: Deadline badge
  const deadlineBadge = getDeadlineBadge(app);

  // CRM Enhancement: Tags
  const tagsHtml = renderTagChips(app.tags);

  card.innerHTML = `
    <div class="app-card-header">
      <div class="app-icon">${initial}</div>
      <div class="app-info">
        <div class="app-company">${escapeHtml(app.company || 'Unknown Company')}</div>
        <div class="app-position">${escapeHtml(app.position || 'Unknown Position')}</div>
      </div>
      <span class="status-badge ${statusClass}" aria-label="Status: ${escapeHtml(capitalizeStatus(app.status))}">${escapeHtml(capitalizeStatus(app.status))}</span>
    </div>
    ${tagsHtml ? `<div class="app-card-tags">${tagsHtml}</div>` : ''}
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
      ${deadlineBadge}
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
      selectAppCallback?.(app.id);
    }
  });

  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openModalCallback?.(app);
  });

  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteApplicationCallback?.(app.id);
  });

  return card;
}

// Render table view
export function renderTable() {
  elements.tableBody.innerHTML = '';
  const filteredApplications = getFilteredApplications();
  const selectedAppId = getSelectedAppId();

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
        selectAppCallback?.(app.id);
      }
    });

    // Keyboard support for table rows
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectAppCallback?.(app.id);
      }
    });

    row.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModalCallback?.(app);
    });

    row.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteApplicationCallback?.(app.id);
    });

    elements.tableBody.appendChild(row);
  });
}

// Export applications to CSV
export function exportToCSV() {
  const filteredApplications = getFilteredApplications();

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
