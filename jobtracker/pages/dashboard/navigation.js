/**
 * Dashboard Navigation Module
 * Page switching, sidebar, and details panel
 */

import {
  elements, MessageTypes, state,
  getApplications, setSelectedAppId, getSelectedAppId,
  getCurrentPage, setCurrentPage
} from './state.js';
import {
  escapeHtml, safeText, decodeHtmlEntities, formatDate, capitalizeStatus, sanitizeStatus,
  isValidUrl, sanitizeUrl, formatJobDescription, showNotification
} from './utils.js';
import { getDeadlineBadge } from './views.js';

// References to external functions (set during initialization)
let openModalCallback = null;
let deleteApplicationCallback = null;
let updateStatsCallback = null;
let loadIntelligencePanelCallback = null;
let loadUpcomingInterviewsCallback = null;
let loadUpcomingTasksCallback = null;
let openInterviewModalCallback = null;
let openTaskModalCallback = null;
let completeTaskCallback = null;
let loadActivityTimelineCallback = null;
let renderActivityTimelineCallback = null;

export function setNavigationCallbacks(callbacks) {
  openModalCallback = callbacks.openModal;
  deleteApplicationCallback = callbacks.deleteApplication;
  updateStatsCallback = callbacks.updateStats;
  loadIntelligencePanelCallback = callbacks.loadIntelligencePanel;
  loadUpcomingInterviewsCallback = callbacks.loadUpcomingInterviews;
  loadUpcomingTasksCallback = callbacks.loadUpcomingTasks;
  openInterviewModalCallback = callbacks.openInterviewModal;
  openTaskModalCallback = callbacks.openTaskModal;
  completeTaskCallback = callbacks.completeTask;
  loadActivityTimelineCallback = callbacks.loadActivityTimeline;
  renderActivityTimelineCallback = callbacks.renderActivityTimeline;
}

// Setup sidebar navigation
// Note: Navigation now uses href links to separate pages (statistics.html, settings.html, etc.)
// This function is kept for backward compatibility but most navigation is handled by page links
export function setupNavigation() {
  // Mobile sidebar closing when clicking nav links
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Close mobile sidebar when navigating
      if (window.innerWidth < 900) {
        elements.sidebar?.classList.remove('open');
        elements.sidebarOverlay?.classList.add('hidden');
      }
    });
  });
}

// Initialize applications view (the default view for dashboard.html)
export function initializeApplicationsView() {
  setCurrentPage('applications');

  // Show applications view elements
  elements.headerTitle.textContent = 'Applications';
  elements.filtersSection?.classList.remove('hidden');
  elements.applicationsSection?.classList.remove('hidden');

  // Show view toggle and export buttons for applications page
  document.querySelector('.header-right .view-toggle')?.classList.remove('hidden');
  document.getElementById('export-btn')?.classList.remove('hidden');
  document.getElementById('add-btn')?.classList.remove('hidden');
  elements.appCount?.classList.remove('hidden');
}

// Switch page - kept for backward compatibility with index.js
// Statistics, supported-sites, and settings are now separate pages with href links
export function switchPage(page) {
  if (page === 'applications') {
    initializeApplicationsView();
  }
  // Other pages (stats, supported-sites, settings) are handled by href links
  // This function is called during initialization to set up the applications view
}

// Toggle mobile sidebar
export function toggleMobileSidebar() {
  const isOpen = elements.sidebar.classList.toggle('open');
  elements.sidebarOverlay.classList.toggle('hidden');

  // Update aria-expanded for accessibility
  elements.mobileMenuBtn.setAttribute('aria-expanded', isOpen);
}

// Check URL params to auto-select application
export function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    const applications = getApplications();
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

// Select application
export function selectApp(id) {
  setSelectedAppId(id);
  const applications = getApplications();
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

// Show overlay for details panel on mobile
export function showDetailsOverlay() {
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
export function hideDetailsOverlay() {
  const overlay = document.getElementById('details-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Close details panel
export function closeDetailsPanel() {
  elements.detailsPanel?.classList.add('hidden');
  setSelectedAppId(null);
  document.querySelectorAll('.app-card').forEach(card => card.classList.remove('selected'));
  hideDetailsOverlay();
}

// Toggle job description expand/collapse in details panel
export function toggleDetailsDescription(btn) {
  const content = btn.closest('.details-description').querySelector('.details-description-content');
  const isExpanded = content.dataset.expanded === 'true';
  content.dataset.expanded = !isExpanded;
  btn.classList.toggle('expanded', !isExpanded);
}

// Show details panel
export async function showDetailsPanel(app) {
  // Show overlay on smaller screens
  if (window.innerWidth < 1200) {
    showDetailsOverlay();
  }

  elements.detailsPosition.textContent = decodeHtmlEntities(app.position || 'Unknown Position');

  const detailsInitial = escapeHtml(decodeHtmlEntities((app.company || 'U')[0].toUpperCase()));
  const detailsStatusClass = `status-${sanitizeStatus(app.status)}`;
  const detailsDateStr = formatDate(app.dateApplied || app.meta?.createdAt || new Date().toISOString());

  // CRM Enhancement: Load interviews, tasks, and activities
  const [interviews, tasks, activities] = await Promise.all([
    chrome.runtime.sendMessage({ type: MessageTypes.GET_INTERVIEWS_BY_APP, payload: { applicationId: app.id } }).catch(() => []),
    chrome.runtime.sendMessage({ type: MessageTypes.GET_TASKS_BY_APP, payload: { applicationId: app.id } }).catch(() => []),
    loadActivityTimelineCallback?.(app.id) || []
  ]);

  // CRM Enhancement: Tags display
  const tagsHtml = app.tags && app.tags.length > 0 ? `
    <div class="details-tags">
      ${app.tags.map(tag => `<span class="tag-chip-detail">${escapeHtml(tag)}</span>`).join('')}
    </div>
  ` : '';

  // CRM Enhancement: Deadline display
  const deadlineHtml = app.deadline ? `
    <div class="details-field">
      <strong>Deadline:</strong> ${escapeHtml(formatDate(app.deadline))}
      ${getDeadlineBadge(app)}
    </div>
  ` : '';

  // CRM Enhancement: Interviews section
  const interviewsHtml = `
    <div class="details-section">
      <div class="details-section-header">
        <h4>Interviews (${interviews.length})</h4>
        <button class="btn-sm btn-secondary add-interview-btn" data-app-id="${escapeHtml(app.id)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add
        </button>
      </div>
      <div class="details-interviews-list">
        ${interviews.length === 0 ? '<div class="section-empty">No interviews scheduled</div>' :
          interviews.map(i => `
            <div class="interview-row">
              <div class="interview-info">
                <span class="interview-type-badge">${escapeHtml(i.type || 'Interview')}</span>
                <span class="interview-date-small">${escapeHtml(formatDate(i.scheduledDate))}</span>
              </div>
              <span class="interview-outcome outcome-${(i.outcome || 'pending').toLowerCase()}">${escapeHtml(i.outcome || 'Pending')}</span>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  // CRM Enhancement: Tasks section
  const pendingTasks = tasks.filter(t => !t.completed);
  const tasksHtml = `
    <div class="details-section">
      <div class="details-section-header">
        <h4>Tasks (${pendingTasks.length} pending)</h4>
        <button class="btn-sm btn-secondary add-task-detail-btn" data-app-id="${escapeHtml(app.id)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add
        </button>
      </div>
      <div class="details-tasks-list">
        ${pendingTasks.length === 0 ? '<div class="section-empty">No pending tasks</div>' :
          pendingTasks.slice(0, 5).map(t => `
            <div class="task-row ${t.priority ? 'priority-' + t.priority : ''}" data-task-id="${escapeHtml(t.id)}">
              <button class="task-checkbox-detail" data-task-id="${escapeHtml(t.id)}" title="Mark complete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              </button>
              <span class="task-title-small">${escapeHtml(t.title)}</span>
              ${t.dueDate ? `<span class="task-due-small">${escapeHtml(formatDate(t.dueDate))}</span>` : ''}
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  // CRM Enhancement: Activity timeline
  const activityHtml = `
    <div class="details-section">
      <div class="details-section-header">
        <h4>Activity</h4>
      </div>
      <div class="details-activity-timeline">
        ${renderActivityTimelineCallback?.(activities) || '<div class="activity-empty">No activity yet</div>'}
      </div>
    </div>
  `;

  elements.detailsContent.innerHTML = `
    <div class="details-company">
      <span class="company-initial">${detailsInitial}</span>
      <div>
        <div class="company-name">${safeText(app.company || 'Unknown Company')}</div>
        ${app.location ? `<div class="company-location">${safeText(app.location)}</div>` : ''}
      </div>
    </div>

    <div class="details-status">
      <span class="status-badge ${detailsStatusClass}" aria-label="Status: ${escapeHtml(capitalizeStatus(app.status))}">${escapeHtml(capitalizeStatus(app.status))}</span>
      <span class="details-date">${escapeHtml(detailsDateStr)}</span>
    </div>

    ${tagsHtml}
    ${deadlineHtml}
    ${app.salary ? `<div class="details-field"><strong>Salary:</strong> ${safeText(app.salary)}</div>` : ''}
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

    ${app.resume && app.resume.type ? `
      <div class="details-field">
        <span class="field-label">Resume Used</span>
        <div class="details-resume-link" data-resume-type="${escapeHtml(app.resume.type)}" data-resume-id="${escapeHtml(app.resume.id)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="resume-name">${escapeHtml(app.resume.name)}</span>
          <span class="resume-type-badge">${app.resume.type === 'generated' ? 'Generated' : 'Uploaded'}</span>
          <div class="resume-actions">
            <button class="resume-action-btn view-resume-btn" title="View Resume">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            ${app.resume.type === 'generated' ? `
              <button class="resume-action-btn edit-resume-btn" title="Edit Resume">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    ` : ''}

    ${interviewsHtml}
    ${tasksHtml}

    ${app.jobDescription ? `
      <div class="details-description">
        <div class="details-description-header">
          <strong>Job Description</strong>
          <button class="description-toggle-btn" title="Toggle description">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        <div class="details-description-content" data-expanded="false">${formatJobDescription(app.jobDescription)}</div>
      </div>
    ` : ''}
    ${app.notes ? `<div class="details-notes"><strong>Notes:</strong><p>${escapeHtml(app.notes)}</p></div>` : ''}

    ${activityHtml}

    <div class="details-actions">
      <button class="btn-secondary details-edit-btn">Edit</button>
      <button class="btn-danger details-delete-btn">Delete</button>
    </div>
  `;

  // Add event listeners for details panel buttons
  elements.detailsContent.querySelector('.details-edit-btn').addEventListener('click', () => openModalCallback?.(app));
  elements.detailsContent.querySelector('.details-delete-btn').addEventListener('click', () => deleteApplicationCallback?.(app.id));

  // CRM Enhancement: Add event listeners for CRM buttons
  const addInterviewBtn = elements.detailsContent.querySelector('.add-interview-btn');
  if (addInterviewBtn) {
    addInterviewBtn.addEventListener('click', () => {
      const appId = addInterviewBtn.dataset.appId;
      openInterviewModalCallback?.(appId);
    });
  }

  const addTaskBtn = elements.detailsContent.querySelector('.add-task-detail-btn');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
      const appId = addTaskBtn.dataset.appId;
      openTaskModalCallback?.(appId);
    });
  }

  // Task completion checkboxes in details panel
  elements.detailsContent.querySelectorAll('.task-checkbox-detail').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      await completeTaskCallback?.(taskId);
      // Refresh details panel to show updated task list
      showDetailsPanel(app);
    });
  });

  // Description toggle button
  const descToggleBtn = elements.detailsContent.querySelector('.description-toggle-btn');
  if (descToggleBtn) {
    descToggleBtn.addEventListener('click', () => {
      const content = descToggleBtn.closest('.details-description').querySelector('.details-description-content');
      const isExpanded = content.dataset.expanded === 'true';
      content.dataset.expanded = !isExpanded;
      descToggleBtn.classList.toggle('expanded', !isExpanded);
    });
  }

  // Resume action buttons
  const viewResumeBtn = elements.detailsContent.querySelector('.view-resume-btn');
  if (viewResumeBtn) {
    viewResumeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const resumeLink = viewResumeBtn.closest('.details-resume-link');
      const resumeType = resumeLink.dataset.resumeType;
      const resumeId = resumeLink.dataset.resumeId;
      await viewResume(resumeType, resumeId);
    });
  }

  const editResumeBtn = elements.detailsContent.querySelector('.edit-resume-btn');
  if (editResumeBtn) {
    editResumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const resumeLink = editResumeBtn.closest('.details-resume-link');
      const resumeId = resumeLink.dataset.resumeId;
      editGeneratedResume(resumeId);
    });
  }

  elements.detailsPanel.classList.remove('hidden');
}

/**
 * View a resume (opens in new tab)
 * @param {string} type - 'generated' or 'uploaded'
 * @param {string} id - Resume ID
 */
async function viewResume(type, id) {
  try {
    if (type === 'uploaded') {
      const resume = await chrome.runtime.sendMessage({
        type: MessageTypes.GET_UPLOADED_RESUME,
        payload: { id }
      });

      if (resume && resume.data) {
        // Convert base64 string back to blob
        const byteCharacters = atob(resume.data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: resume.type || 'application/pdf' });

        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Clean up the object URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // Show user-facing error
        showNotification('Could not load resume. It may have been deleted.', 'error');
      }
    } else if (type === 'generated') {
      // Open resume maker in view mode
      const resumeMakerUrl = chrome.runtime.getURL(`resume-maker/index.html?view=${encodeURIComponent(id)}`);
      window.open(resumeMakerUrl, '_blank');
    }
  } catch (error) {
    console.error('Failed to view resume:', error);
    showNotification('Failed to open resume', 'error');
  }
}

/**
 * Edit a generated resume (opens resume maker)
 * @param {string} id - Resume ID
 */
function editGeneratedResume(id) {
  const resumeMakerUrl = chrome.runtime.getURL(`resume-maker/index.html?edit=${encodeURIComponent(id)}`);
  window.open(resumeMakerUrl, '_blank');
}
