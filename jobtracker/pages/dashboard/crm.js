/**
 * Dashboard CRM Module
 * Interviews, tasks, activities, and tags
 */

import {
  elements, MessageTypes,
  getApplications, getAllTags, setAllTags,
  getSelectedTags, setSelectedTags,
  getUpcomingInterviews, setUpcomingInterviews,
  getUpcomingTasks, setUpcomingTasks,
  getSelectedAppId
} from './state.js';
import {
  escapeHtml, formatDate, formatDateInput, formatDateTimeInput,
  formatTime, getTimeAgo, showNotification
} from './utils.js';

// References to external functions (set during initialization)
let applyFiltersCallback = null;
let showDetailsPanelCallback = null;

export function setCRMCallbacks(callbacks) {
  applyFiltersCallback = callbacks.applyFilters;
  showDetailsPanelCallback = callbacks.showDetailsPanel;
}

// ==================== TAGS ====================

// Load all unique tags
export async function loadTags() {
  try {
    const tags = await chrome.runtime.sendMessage({ type: MessageTypes.GET_ALL_TAGS }) || [];
    setAllTags(tags);
    renderTagFilter();
  } catch (error) {
    console.log('Error loading tags:', error);
    setAllTags([]);
  }
}

// Render tag filter chips
export function renderTagFilter() {
  if (!elements.tagFilterContainer) return;

  const allTags = getAllTags();
  const selectedTags = getSelectedTags();

  if (allTags.length === 0) {
    elements.tagFilterContainer.classList.add('hidden');
    return;
  }

  elements.tagFilterContainer.classList.remove('hidden');
  elements.tagFilterContainer.innerHTML = `
    <div class="tag-filter-label">Tags:</div>
    <div class="tag-filter-chips">
      ${allTags.map(tag => `
        <button class="tag-chip ${selectedTags.includes(tag) ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
          ${escapeHtml(tag)}
        </button>
      `).join('')}
    </div>
  `;

  // Add click listeners
  elements.tagFilterContainer.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      let currentSelectedTags = getSelectedTags();
      if (currentSelectedTags.includes(tag)) {
        currentSelectedTags = currentSelectedTags.filter(t => t !== tag);
        chip.classList.remove('active');
      } else {
        currentSelectedTags.push(tag);
        chip.classList.add('active');
      }
      setSelectedTags(currentSelectedTags);
      applyFiltersCallback?.();
    });
  });
}

// ==================== INTERVIEWS ====================

// Setup interview modal
export function setupInterviewModal() {
  elements.closeInterviewModal?.addEventListener('click', closeInterviewModal);
  elements.cancelInterviewBtn?.addEventListener('click', closeInterviewModal);
  elements.interviewModal?.addEventListener('click', (e) => {
    if (e.target === elements.interviewModal) closeInterviewModal();
  });
  elements.interviewForm?.addEventListener('submit', handleInterviewSubmit);
}

// Load upcoming interviews
export async function loadUpcomingInterviews() {
  try {
    const interviews = await chrome.runtime.sendMessage({
      type: MessageTypes.GET_UPCOMING_INTERVIEWS,
      payload: { limit: 5 }
    }) || [];
    setUpcomingInterviews(interviews);
    renderUpcomingInterviews();
  } catch (error) {
    console.log('Error loading upcoming interviews:', error);
    setUpcomingInterviews([]);
  }
}

// Render upcoming interviews widget
export function renderUpcomingInterviews() {
  if (!elements.upcomingInterviewsList) return;

  const upcomingInterviews = getUpcomingInterviews();
  const applications = getApplications();

  if (upcomingInterviews.length === 0) {
    elements.upcomingInterviewsList.innerHTML = `
      <div class="widget-empty">
        <p>No upcoming interviews scheduled</p>
      </div>
    `;
    return;
  }

  elements.upcomingInterviewsList.innerHTML = upcomingInterviews.map(interview => {
    const app = applications.find(a => a.id === interview.applicationId);
    const dateStr = formatDate(interview.scheduledDate);
    const timeStr = formatTime(interview.scheduledDate);

    return `
      <div class="interview-item" data-id="${escapeHtml(interview.id)}">
        <div class="interview-time">
          <span class="interview-date">${escapeHtml(dateStr)}</span>
          <span class="interview-hour">${escapeHtml(timeStr)}</span>
        </div>
        <div class="interview-details">
          <div class="interview-type">${escapeHtml(interview.type || 'Interview')}</div>
          <div class="interview-company">${escapeHtml(app?.company || 'Unknown')}</div>
        </div>
        <span class="interview-round">Round ${interview.round || 1}</span>
      </div>
    `;
  }).join('');
}

// Open interview modal
export function openInterviewModal(applicationId, interview = null) {
  if (!elements.interviewModal) return;

  const modalTitle = elements.interviewModal.querySelector('#interview-modal-title');
  if (modalTitle) {
    modalTitle.textContent = interview ? 'Edit Interview' : 'Schedule Interview';
  }

  elements.interviewForm?.reset();

  const interviewIdEl = document.getElementById('interview-id');
  const interviewAppIdEl = document.getElementById('interview-app-id');
  const interviewRoundEl = document.getElementById('interview-round');
  const interviewTypeEl = document.getElementById('interview-type');
  const interviewDateEl = document.getElementById('interview-date');
  const interviewDurationEl = document.getElementById('interview-duration');
  const interviewLocationEl = document.getElementById('interview-location');
  const interviewNotesEl = document.getElementById('interview-notes');
  const interviewOutcomeEl = document.getElementById('interview-outcome');

  if (interview) {
    if (interviewIdEl) interviewIdEl.value = interview.id;
    if (interviewAppIdEl) interviewAppIdEl.value = interview.applicationId;
    if (interviewRoundEl) interviewRoundEl.value = interview.round || 1;
    if (interviewTypeEl) interviewTypeEl.value = interview.type || '';
    if (interviewDateEl) interviewDateEl.value = formatDateTimeInput(interview.scheduledDate);
    if (interviewDurationEl) interviewDurationEl.value = interview.duration || 60;
    if (interviewLocationEl) interviewLocationEl.value = interview.location || '';
    if (interviewNotesEl) interviewNotesEl.value = interview.notes || '';
    if (interviewOutcomeEl) interviewOutcomeEl.value = interview.outcome || 'Pending';
  } else {
    if (interviewIdEl) interviewIdEl.value = '';
    if (interviewAppIdEl) interviewAppIdEl.value = applicationId;
    if (interviewRoundEl) interviewRoundEl.value = 1;
    if (interviewOutcomeEl) interviewOutcomeEl.value = 'Pending';
  }

  elements.interviewModal.classList.remove('hidden');
}

// Close interview modal
export function closeInterviewModal() {
  elements.interviewModal?.classList.add('hidden');
}

// Handle interview form submit
async function handleInterviewSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('interview-id').value;
  const interviewData = {
    applicationId: document.getElementById('interview-app-id').value,
    round: parseInt(document.getElementById('interview-round').value) || 1,
    type: document.getElementById('interview-type').value,
    scheduledDate: document.getElementById('interview-date').value,
    duration: parseInt(document.getElementById('interview-duration').value) || 60,
    location: document.getElementById('interview-location').value.trim(),
    notes: document.getElementById('interview-notes').value.trim(),
    outcome: document.getElementById('interview-outcome').value
  };

  try {
    if (id) {
      await chrome.runtime.sendMessage({
        type: MessageTypes.UPDATE_INTERVIEW,
        payload: { id, ...interviewData }
      });
    } else {
      await chrome.runtime.sendMessage({
        type: MessageTypes.ADD_INTERVIEW,
        payload: interviewData
      });
    }

    closeInterviewModal();
    await loadUpcomingInterviews();

    // Refresh details panel if viewing the same app
    const selectedAppId = getSelectedAppId();
    if (selectedAppId === interviewData.applicationId) {
      const applications = getApplications();
      const app = applications.find(a => a.id === selectedAppId);
      if (app) showDetailsPanelCallback?.(app);
    }
  } catch (error) {
    console.log('Error saving interview:', error);
    showNotification('Failed to save interview. Please try again.', 'error');
  }
}

// ==================== TASKS ====================

// Setup task modal
export function setupTaskModal() {
  elements.closeTaskModal?.addEventListener('click', closeTaskModal);
  elements.cancelTaskBtn?.addEventListener('click', closeTaskModal);
  elements.taskModal?.addEventListener('click', (e) => {
    if (e.target === elements.taskModal) closeTaskModal();
  });
  elements.taskForm?.addEventListener('submit', handleTaskSubmit);
  elements.addTaskBtn?.addEventListener('click', () => openTaskModal());

  // Enhanced: Toggle custom reminder field visibility
  const reminderTypeSelect = document.getElementById('task-reminder-type');
  const customReminderGroup = document.getElementById('task-custom-reminder-group');
  reminderTypeSelect?.addEventListener('change', () => {
    if (reminderTypeSelect.value === 'custom') {
      customReminderGroup?.classList.remove('hidden');
    } else {
      customReminderGroup?.classList.add('hidden');
    }
  });
}

// Load upcoming tasks
export async function loadUpcomingTasks() {
  try {
    const tasks = await chrome.runtime.sendMessage({
      type: MessageTypes.GET_UPCOMING_TASKS,
      payload: { limit: 5 }
    }) || [];
    setUpcomingTasks(tasks);
    renderUpcomingTasks();
  } catch (error) {
    console.log('Error loading upcoming tasks:', error);
    setUpcomingTasks([]);
  }
}

// Priority colors (matches Planify)
const PRIORITY_COLORS = {
  1: '#ff7066',  // Urgent - Red
  2: '#ff9914',  // High - Orange
  3: '#5297ff',  // Normal - Blue
  4: '#999999'   // Low - Gray
};

// Task type labels
const TASK_TYPE_LABELS = {
  'follow_up': 'Follow-up',
  'interview_prep': 'Prep',
  'application': 'Apply',
  'general': ''
};

// Render upcoming tasks widget
export function renderUpcomingTasks() {
  if (!elements.tasksList) return;

  const upcomingTasks = getUpcomingTasks();
  const applications = getApplications();

  if (upcomingTasks.length === 0) {
    elements.tasksList.innerHTML = `
      <div class="widget-empty">
        <p>No pending tasks</p>
      </div>
    `;
    return;
  }

  const now = new Date();
  elements.tasksList.innerHTML = upcomingTasks.map(task => {
    const app = applications.find(a => a.id === task.applicationId);
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < now;

    // Enhanced: Use numeric priority for styling
    const priority = normalizePriorityToNumeric(task.priority);
    const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS[3];
    const taskTypeLabel = TASK_TYPE_LABELS[task.taskType] || '';

    return `
      <div class="task-item ${isOverdue ? 'task-overdue' : ''}" data-id="${escapeHtml(task.id)}" style="--priority-color: ${priorityColor}">
        <button class="task-checkbox" data-task-id="${escapeHtml(task.id)}" title="Mark complete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </button>
        <div class="task-priority-indicator" style="background-color: ${priorityColor}"></div>
        <div class="task-details">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta-row">
            ${app ? `<span class="task-app">${escapeHtml(app.company)}</span>` : ''}
            ${taskTypeLabel ? `<span class="task-type-badge">${escapeHtml(taskTypeLabel)}</span>` : ''}
          </div>
        </div>
        ${dueDate ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${formatDate(task.dueDate)}</span>` : ''}
      </div>
    `;
  }).join('');

  // Add complete handlers
  elements.tasksList.querySelectorAll('.task-checkbox').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      await completeTask(taskId);
    });
  });
}

// Complete a task
export async function completeTask(taskId) {
  try {
    await chrome.runtime.sendMessage({
      type: MessageTypes.UPDATE_TASK,
      payload: { id: taskId, completed: true }
    });
    await loadUpcomingTasks();
    showNotification('Task completed!', 'success');
  } catch (error) {
    console.log('Error completing task:', error);
    showNotification('Failed to complete task.', 'error');
  }
}

// Open task modal
export function openTaskModal(applicationId = null, task = null) {
  if (!elements.taskModal) return;

  const modalTitle = elements.taskModal.querySelector('#task-modal-title');
  if (modalTitle) {
    modalTitle.textContent = task ? 'Edit Task' : 'Add Task';
  }

  elements.taskForm?.reset();

  // Reset custom reminder visibility
  const customReminderGroup = document.getElementById('task-custom-reminder-group');
  customReminderGroup?.classList.add('hidden');

  if (task) {
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-app-id').value = task.applicationId || '';
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-description').value = task.description || '';

    // Enhanced: Handle task type
    const taskTypeEl = document.getElementById('task-type');
    if (taskTypeEl) {
      taskTypeEl.value = task.taskType || 'general';
    }

    // Enhanced: Handle numeric priority (with legacy text support)
    const priorityEl = document.getElementById('task-priority');
    if (priorityEl) {
      const priority = normalizePriorityToNumeric(task.priority);
      priorityEl.value = String(priority);
    }

    // Enhanced: Handle due date and time separately
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      document.getElementById('task-due-date').value = formatDateInput(task.dueDate);
      const dueTimeEl = document.getElementById('task-due-time');
      if (dueTimeEl && !isNaN(dueDate.getTime())) {
        const hours = String(dueDate.getHours()).padStart(2, '0');
        const minutes = String(dueDate.getMinutes()).padStart(2, '0');
        dueTimeEl.value = `${hours}:${minutes}`;
      }
    }

    // Enhanced: Handle reminder type
    const reminderTypeEl = document.getElementById('task-reminder-type');
    if (reminderTypeEl) {
      if (task.reminderDate) {
        // Legacy: single reminder date - show as custom
        reminderTypeEl.value = 'custom';
        customReminderGroup?.classList.remove('hidden');
        document.getElementById('task-reminder-date').value = formatDateTimeInput(task.reminderDate);
      } else if (task.reminders && task.reminders.length > 0) {
        // Enhanced: check first reminder
        const reminder = task.reminders[0];
        if (reminder.type === 'relative') {
          reminderTypeEl.value = String(reminder.minuteOffset);
        } else {
          reminderTypeEl.value = 'custom';
          customReminderGroup?.classList.remove('hidden');
          document.getElementById('task-reminder-date').value = formatDateTimeInput(reminder.reminderDate);
        }
      } else {
        reminderTypeEl.value = '';
      }
    }
  } else {
    document.getElementById('task-id').value = '';
    document.getElementById('task-app-id').value = applicationId || '';
    document.getElementById('task-type').value = 'general';
    document.getElementById('task-priority').value = '3'; // Normal
    document.getElementById('task-reminder-type').value = '';
  }

  elements.taskModal.classList.remove('hidden');
}

// Helper: Convert legacy text priority to numeric
function normalizePriorityToNumeric(priority) {
  if (typeof priority === 'number') {
    return priority >= 1 && priority <= 4 ? priority : 3;
  }
  const textToNumeric = {
    'urgent': 1,
    'high': 2,
    'medium': 3,
    'normal': 3,
    'low': 4
  };
  return textToNumeric[String(priority).toLowerCase()] || 3;
}

// Close task modal
export function closeTaskModal() {
  elements.taskModal?.classList.add('hidden');
}

// Handle task form submit
async function handleTaskSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('task-id').value;

  // Build due date from date + time
  const dueDateValue = document.getElementById('task-due-date').value;
  const dueTimeValue = document.getElementById('task-due-time')?.value || '09:00';
  let dueDate = null;
  if (dueDateValue) {
    dueDate = `${dueDateValue}T${dueTimeValue}:00`;
  }

  // Build reminder based on type
  const reminderType = document.getElementById('task-reminder-type')?.value;
  let reminderDate = null;
  let reminders = [];

  if (reminderType === 'custom') {
    // Absolute reminder
    reminderDate = document.getElementById('task-reminder-date').value || null;
    if (reminderDate) {
      reminders.push({
        type: 'absolute',
        reminderDate: reminderDate
      });
    }
  } else if (reminderType && reminderType !== '') {
    // Relative reminder (offset in minutes)
    const minuteOffset = parseInt(reminderType, 10);
    reminders.push({
      type: 'relative',
      minuteOffset: minuteOffset
    });
    // Also set legacy reminderDate for backward compatibility
    if (dueDate && !isNaN(minuteOffset)) {
      const dueDateObj = new Date(dueDate);
      reminderDate = new Date(dueDateObj.getTime() + minuteOffset * 60 * 1000).toISOString();
    }
  }

  const taskData = {
    applicationId: document.getElementById('task-app-id').value || null,
    title: document.getElementById('task-title').value.trim(),
    description: document.getElementById('task-description').value.trim(),
    taskType: document.getElementById('task-type')?.value || 'general',
    priority: parseInt(document.getElementById('task-priority').value, 10) || 3,
    dueDate: dueDate,
    reminderDate: reminderDate, // Legacy field for backward compatibility
    reminders: reminders        // Enhanced reminders array
  };

  if (!taskData.title) {
    showNotification('Task title is required', 'error');
    return;
  }

  try {
    if (id) {
      await chrome.runtime.sendMessage({
        type: MessageTypes.UPDATE_TASK,
        payload: { id, ...taskData }
      });
    } else {
      await chrome.runtime.sendMessage({
        type: MessageTypes.ADD_TASK,
        payload: taskData
      });
    }

    closeTaskModal();
    await loadUpcomingTasks();
    showNotification(id ? 'Task updated!' : 'Task created!', 'success');

    // Refresh details panel if viewing the same app
    const selectedAppId = getSelectedAppId();
    if (taskData.applicationId && selectedAppId === taskData.applicationId) {
      const applications = getApplications();
      const app = applications.find(a => a.id === selectedAppId);
      if (app) showDetailsPanelCallback?.(app);
    }
  } catch (error) {
    console.log('Error saving task:', error);
    showNotification('Failed to save task. Please try again.', 'error');
  }
}

// ==================== ACTIVITY TIMELINE ====================

// Load and render activity timeline for an application
export async function loadActivityTimeline(applicationId) {
  try {
    const activities = await chrome.runtime.sendMessage({
      type: MessageTypes.GET_ACTIVITIES_BY_APP,
      payload: { applicationId }
    }) || [];
    return activities;
  } catch (error) {
    console.log('Error loading activities:', error);
    return [];
  }
}

// Render activity timeline HTML
export function renderActivityTimeline(activities) {
  if (!activities || activities.length === 0) {
    return `<div class="activity-empty">No activity yet</div>`;
  }

  return activities.slice(0, 10).map(activity => {
    const icon = getActivityIcon(activity.type);
    const timeAgo = getTimeAgo(activity.timestamp);

    return `
      <div class="activity-item activity-${activity.type}">
        <div class="activity-icon">${icon}</div>
        <div class="activity-content">
          <div class="activity-title">${escapeHtml(activity.title)}</div>
          ${activity.description ? `<div class="activity-desc">${escapeHtml(activity.description)}</div>` : ''}
          <div class="activity-time">${escapeHtml(timeAgo)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Get icon for activity type
function getActivityIcon(type) {
  const icons = {
    'application_created': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    'status_change': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
    'interview_scheduled': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    'interview_outcome': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
    'task_created': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    'task_completed': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    'note_added': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>'
  };
  return icons[type] || icons['note_added'];
}

// Setup CRM features
export function setupCRMFeatures() {
  setupInterviewModal();
  setupTaskModal();
  loadUpcomingInterviews();
  loadUpcomingTasks();
}
