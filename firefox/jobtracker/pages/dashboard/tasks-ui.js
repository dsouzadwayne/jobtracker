/**
 * Enhanced Task UI Module
 * Provides UI components for advanced task management
 */

import {
  TaskPriority, TaskType, ReminderType, RecurrenceType, taskManager
} from './tasks-enhanced.js';
import { escapeHtml, formatDate, showNotification } from './utils.js';

/**
 * Render an enhanced task item with all features
 */
export function renderEnhancedTaskItem(task) {
  const priorityColor = task.getPriorityColor();
  const timeRemaining = task.getTimeRemaining();
  const isOverdue = task.isOverdue();
  const isDueToday = task.isDueToday();
  const isDueSoon = task.isDueSoon();

  let statusClass = '';
  if (isOverdue) statusClass = 'task-overdue';
  else if (isDueToday) statusClass = 'task-due-today';
  else if (isDueSoon) statusClass = 'task-due-soon';

  let priorityIcon = '';
  if (task.priority === TaskPriority.URGENT) {
    priorityIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7L2 12C2 16.5915 6.26 20.2662 11.54 21.9C11.6915 21.9381 11.8437 21.9381 11.9952 21.9C17.274 20.2662 21.54 16.5915 21.54 12V7L12 2Z" style="color: ' + priorityColor + '"/></svg>';
  }

  const remindersHtml = task.reminders.length > 0 ? `
    <div class="task-reminders-summary">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span class="task-reminder-count">${task.reminders.length}</span>
    </div>
  ` : '';

  const subtasksHtml = task.subtaskIds.length > 0 ? `
    <div class="task-subtasks-summary">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span class="task-subtask-count">${task.subtaskIds.length}</span>
    </div>
  ` : '';

  return `
    <div class="task-item-enhanced ${statusClass}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-header">
        <div class="task-check-priority">
          <input type="checkbox" class="task-checkbox-enhanced" ${task.completed ? 'checked' : ''}>
          ${priorityIcon}
        </div>

        <div class="task-main-content">
          <div class="task-title ${task.completed ? 'task-completed' : ''}">${escapeHtml(task.title)}</div>
          ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        </div>

        <div class="task-meta">
          ${remindersHtml}
          ${subtasksHtml}
          ${task.dueDate ? `
            <div class="task-due-info ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : isDueSoon ? 'due-soon' : ''}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
              </svg>
              <span class="task-time-remaining">${escapeHtml(timeRemaining)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="task-actions-enhanced">
        <button class="task-action-btn task-edit-btn" title="Edit task">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="task-action-btn task-reminder-btn" title="Add reminder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>
        <button class="task-action-btn task-delete-btn" title="Delete task">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Create enhanced task form/modal
 */
export function createEnhancedTaskForm(task = null) {
  const isEdit = !!task;

  return `
    <form class="task-form-enhanced" ${task ? `data-task-id="${escapeHtml(task.id)}"` : ''}>
      <!-- Title -->
      <div class="form-group">
        <label for="task-title">Task Title *</label>
        <input
          type="text"
          id="task-title"
          name="title"
          class="form-input"
          placeholder="Enter task title"
          value="${task ? escapeHtml(task.title) : ''}"
          required
        >
      </div>

      <!-- Description -->
      <div class="form-group">
        <label for="task-description">Description</label>
        <textarea
          id="task-description"
          name="description"
          class="form-input form-textarea"
          placeholder="Enter task description"
          rows="3"
        >${task ? escapeHtml(task.description) : ''}</textarea>
      </div>

      <!-- Task Type -->
      <div class="form-group">
        <label for="task-type">Task Type</label>
        <select id="task-type" name="taskType" class="form-input">
          <option value="${TaskType.GENERAL}" ${task?.taskType === TaskType.GENERAL ? 'selected' : ''}>General</option>
          <option value="${TaskType.FOLLOW_UP}" ${task?.taskType === TaskType.FOLLOW_UP ? 'selected' : ''}>Follow-up</option>
          <option value="${TaskType.INTERVIEW_PREP}" ${task?.taskType === TaskType.INTERVIEW_PREP ? 'selected' : ''}>Interview Prep</option>
          <option value="${TaskType.APPLICATION}" ${task?.taskType === TaskType.APPLICATION ? 'selected' : ''}>Application</option>
        </select>
      </div>

      <!-- Priority -->
      <div class="form-group">
        <label for="task-priority">Priority</label>
        <select id="task-priority" name="priority" class="form-input">
          <option value="${TaskPriority.URGENT}" ${task?.priority === TaskPriority.URGENT ? 'selected' : ''}>🔴 Urgent</option>
          <option value="${TaskPriority.HIGH}" ${task?.priority === TaskPriority.HIGH ? 'selected' : ''}>🟠 High</option>
          <option value="${TaskPriority.NORMAL}" ${task?.priority === TaskPriority.NORMAL ? 'selected' : ''}>🔵 Normal</option>
          <option value="${TaskPriority.LOW}" ${task?.priority === TaskPriority.LOW ? 'selected' : ''}>⚫ Low</option>
        </select>
      </div>

      <!-- Due Date -->
      <div class="form-group">
        <label for="task-due-date">Due Date</label>
        <input
          type="datetime-local"
          id="task-due-date"
          name="dueDate"
          class="form-input"
          value="${task && task.dueDate ? task.dueDate.slice(0, 16) : ''}"
        >
      </div>

      <!-- Recurrence -->
      <div class="form-group">
        <label for="task-recurrence">Recurrence</label>
        <select id="task-recurrence" name="recurrenceType" class="form-input">
          <option value="${RecurrenceType.NONE}" ${task?.recurrence?.type === RecurrenceType.NONE ? 'selected' : ''}>None</option>
          <option value="${RecurrenceType.DAILY}" ${task?.recurrence?.type === RecurrenceType.DAILY ? 'selected' : ''}>Daily</option>
          <option value="${RecurrenceType.WEEKLY}" ${task?.recurrence?.type === RecurrenceType.WEEKLY ? 'selected' : ''}>Weekly</option>
          <option value="${RecurrenceType.MONTHLY}" ${task?.recurrence?.type === RecurrenceType.MONTHLY ? 'selected' : ''}>Monthly</option>
        </select>
      </div>

      <!-- Reminders Section -->
      <div class="form-group task-reminders-section">
        <label>Reminders</label>
        <div class="reminders-list" id="task-reminders-list">
          ${task && task.reminders.length > 0 ? task.reminders.map((reminder, idx) => `
            <div class="reminder-item" data-reminder-id="${escapeHtml(reminder.id)}">
              <span class="reminder-text">${escapeHtml(reminder.getText(task.dueDate))}</span>
              <button type="button" class="btn-sm btn-danger remove-reminder-btn" data-index="${idx}">Remove</button>
            </div>
          `).join('') : '<p class="text-muted">No reminders set</p>'}
        </div>
        <button type="button" class="btn-sm btn-secondary add-reminder-btn">+ Add Reminder</button>
      </div>

      <!-- Tags -->
      <div class="form-group">
        <label for="task-tags">Tags</label>
        <input
          type="text"
          id="task-tags"
          name="tags"
          class="form-input"
          placeholder="Enter tags separated by commas"
          value="${task ? task.tags.join(', ') : ''}"
        >
      </div>

      <!-- Subtasks Count (info only for now) -->
      ${task && task.subtaskIds.length > 0 ? `
        <div class="form-info">
          <p>This task has ${task.subtaskIds.length} subtask(s)</p>
        </div>
      ` : ''}

      <!-- Form Actions -->
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">
          ${isEdit ? 'Update Task' : 'Create Task'}
        </button>
        <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
        ${isEdit ? `<button type="button" class="btn btn-danger delete-task-btn">Delete Task</button>` : ''}
      </div>
    </form>
  `;
}

/**
 * Create reminder configuration panel
 */
export function createReminderPanel() {
  return `
    <div class="reminder-config-panel">
      <div class="form-group">
        <label>Reminder Type</label>
        <select id="reminder-type" class="form-input">
          <option value="${ReminderType.ABSOLUTE}">Specific Date/Time</option>
          <option value="${ReminderType.RELATIVE}" selected>Before Due Date</option>
        </select>
      </div>

      <!-- Absolute Reminder -->
      <div class="reminder-absolute-config" style="display: none;">
        <label>Reminder Date & Time</label>
        <input type="datetime-local" id="reminder-absolute-date" class="form-input">
      </div>

      <!-- Relative Reminder -->
      <div class="reminder-relative-config">
        <label>Minutes Before Due Date</label>
        <select id="reminder-relative-offset" class="form-input">
          <option value="0">At due time</option>
          <option value="-15">15 minutes before</option>
          <option value="-30">30 minutes before</option>
          <option value="-60">1 hour before</option>
          <option value="-1440">1 day before</option>
          <option value="custom">Custom</option>
        </select>
        <input
          type="number"
          id="reminder-custom-offset"
          class="form-input"
          placeholder="Enter minutes (negative = before)"
          style="display: none;"
        >
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-primary confirm-reminder-btn">Add Reminder</button>
        <button type="button" class="btn btn-secondary cancel-reminder-btn">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Render task statistics dashboard
 */
export function renderTaskStatistics() {
  const overdue = taskManager.getOverdueTasks();
  const today = taskManager.getDueToday();
  const soon = taskManager.getDueSoon();

  return `
    <div class="tasks-statistics">
      <div class="stat-card stat-overdue">
        <div class="stat-number">${overdue.length}</div>
        <div class="stat-label">Overdue</div>
      </div>
      <div class="stat-card stat-due-today">
        <div class="stat-number">${today.length}</div>
        <div class="stat-label">Due Today</div>
      </div>
      <div class="stat-card stat-due-soon">
        <div class="stat-number">${soon.length}</div>
        <div class="stat-label">Due Soon</div>
      </div>
      <div class="stat-card stat-total">
        <div class="stat-number">${taskManager.tasks.size}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
    </div>
  `;
}
