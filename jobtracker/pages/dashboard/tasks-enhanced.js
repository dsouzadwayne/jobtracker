/**
 * Enhanced Task Management Module
 * Based on Planify's task architecture
 * Provides advanced task scheduling, reminders, and subtasks
 */

import {
  elements, MessageTypes, getApplications, getSelectedAppId
} from './state.js';
import {
  escapeHtml, formatDate, formatDateInput, formatDateTimeInput,
  formatTime, getTimeAgo, showNotification
} from './utils.js';

// Task subtypes for classification
export const TaskType = {
  FOLLOW_UP: 'follow_up',      // Follow-up with company
  INTERVIEW_PREP: 'interview_prep',
  APPLICATION: 'application',
  GENERAL: 'general'
};

// Priority levels (matching Planify: 1=highest, 4=lowest)
export const TaskPriority = {
  URGENT: 1,      // Red
  HIGH: 2,        // Orange
  NORMAL: 3,      // Blue
  LOW: 4          // None
};

// Reminder types
export const ReminderType = {
  ABSOLUTE: 'absolute',  // Specific date/time
  RELATIVE: 'relative'   // Minutes before due date
};

// Recurrence types for recurring tasks
export const RecurrenceType = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

/**
 * Enhanced Task Object
 * Extends the basic task with advanced features
 */
export class Task {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.title = data.title || '';
    this.description = data.description || '';
    this.applicationId = data.applicationId || null;
    this.completed = data.completed || false;
    this.completedAt = data.completedAt || null;
    this.dueDate = data.dueDate || null;
    this.priority = this._normalizePriority(data.priority);
    this.taskType = data.taskType || TaskType.GENERAL;
    this.parentTaskId = data.parentTaskId || null;  // For subtasks
    this.subtaskIds = data.subtaskIds || [];        // Child tasks
    this.tags = data.tags || [];
    this.reminders = [];                            // Array of Reminder objects (populated by loadTasks)
    this.recurrence = data.recurrence || {          // Recurrence configuration
      type: RecurrenceType.NONE,
      interval: 1,
      endDate: null,
      daysOfWeek: []
    };
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.isDeleted = data.isDeleted || false;
  }

  // Convert legacy text priorities to numeric
  _normalizePriority(priority) {
    if (typeof priority === 'number') {
      return priority >= 1 && priority <= 4 ? priority : TaskPriority.NORMAL;
    }
    // Legacy text priority conversion
    const textToNumeric = {
      'urgent': TaskPriority.URGENT,
      'high': TaskPriority.HIGH,
      'medium': TaskPriority.NORMAL,
      'normal': TaskPriority.NORMAL,
      'low': TaskPriority.LOW
    };
    return textToNumeric[String(priority).toLowerCase()] || TaskPriority.NORMAL;
  }

  // Get display priority as text
  getPriorityText() {
    const texts = {
      1: 'Urgent',
      2: 'High',
      3: 'Normal',
      4: 'Low'
    };
    return texts[this.priority] || 'Normal';
  }

  // Get priority color for UI
  getPriorityColor() {
    const colors = {
      1: '#ff7066',    // Red
      2: '#ff9914',    // Orange
      3: '#5297ff',    // Blue
      4: '#999999'     // Gray
    };
    return colors[this.priority] || '#999999';
  }

  // Check if task is overdue
  isOverdue() {
    if (!this.dueDate || this.completed) return false;
    return new Date(this.dueDate) < new Date();
  }

  // Check if task is due today
  isDueToday() {
    if (!this.dueDate) return false;
    const today = new Date();
    const due = new Date(this.dueDate);
    return today.toDateString() === due.toDateString();
  }

  // Check if task is due soon (within 3 days)
  isDueSoon() {
    if (!this.dueDate || this.completed) return false;
    const now = new Date();
    const due = new Date(this.dueDate);
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return days <= 3 && days > 0;
  }

  // Get time remaining until due date
  getTimeRemaining() {
    if (!this.dueDate) return null;
    const now = new Date();
    const due = new Date(this.dueDate);
    const diff = due - now;

    if (diff < 0) return 'Overdue';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  // Convert to JSON for storage
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      applicationId: this.applicationId,
      completed: this.completed,
      completedAt: this.completedAt,
      dueDate: this.dueDate,
      priority: this.priority,
      taskType: this.taskType,
      parentTaskId: this.parentTaskId,
      subtaskIds: this.subtaskIds,
      tags: this.tags,
      reminders: this.reminders.map(r => r.toJSON()),
      recurrence: this.recurrence,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isDeleted: this.isDeleted
    };
  }
}

/**
 * Reminder Object
 * Handles task reminders with absolute and relative types
 */
export class Reminder {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.taskId = data.taskId || '';
    this.type = data.type || ReminderType.ABSOLUTE;
    this.reminderDate = data.reminderDate || null;  // For ABSOLUTE reminders
    this.minuteOffset = data.minuteOffset || 0;     // For RELATIVE reminders (e.g., -15 for 15 min before)
    this.isTriggered = data.isTriggered || false;
  }

  // Calculate when the reminder should fire
  getFireDate(taskDueDate) {
    if (this.type === ReminderType.ABSOLUTE) {
      return new Date(this.reminderDate);
    } else {
      // RELATIVE: calculate from task due date
      const dueDate = new Date(taskDueDate);
      return new Date(dueDate.getTime() + this.minuteOffset * 60 * 1000);
    }
  }

  // Check if reminder should fire now
  shouldFire(taskDueDate) {
    if (this.isTriggered) return false;
    const fireDate = this.getFireDate(taskDueDate);
    return new Date() >= fireDate;
  }

  // Get human-readable reminder text
  getText(taskDueDate) {
    if (this.type === ReminderType.ABSOLUTE) {
      return `On ${formatDate(this.reminderDate)}`;
    } else {
      const absOffset = Math.abs(this.minuteOffset);
      if (absOffset === 0) return 'At due time';
      if (absOffset === 15) return '15 minutes before';
      if (absOffset === 30) return '30 minutes before';
      if (absOffset === 60) return '1 hour before';
      if (absOffset === 1440) return '1 day before';
      if (this.minuteOffset < 0) {
        return `${absOffset} minutes before`;
      } else {
        return `${absOffset} minutes after`;
      }
    }
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      type: this.type,
      reminderDate: this.reminderDate,
      minuteOffset: this.minuteOffset,
      isTriggered: this.isTriggered
    };
  }
}

// Generate unique IDs
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Task Manager Service
 * Handles task operations and reminders
 */
export class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.reminders = new Map();
    this.reminderCheckInterval = null;
  }

  // Initialize task manager and start reminder checking
  async init() {
    await this.loadTasks();
    this.startReminderCheck();
  }

  // Load all tasks from IndexedDB
  async loadTasks() {
    try {
      const allTasks = await chrome.runtime.sendMessage({
        type: MessageTypes.GET_TASKS
      }) || [];

      allTasks.forEach(taskData => {
        const task = new Task(taskData);
        this.tasks.set(task.id, task);

        // Load reminders for this task
        if (taskData.reminders && Array.isArray(taskData.reminders)) {
          taskData.reminders.forEach(reminderData => {
            const reminder = new Reminder({ ...reminderData, taskId: task.id });
            this.reminders.set(reminder.id, reminder);
            task.reminders.push(reminder);
          });
        } else if (taskData.reminderDate) {
          // Legacy support: convert single reminderDate to Reminder object
          const reminder = new Reminder({
            taskId: task.id,
            type: ReminderType.ABSOLUTE,
            reminderDate: taskData.reminderDate
          });
          this.reminders.set(reminder.id, reminder);
          task.reminders.push(reminder);
        }
      });

      console.log(`Loaded ${this.tasks.size} tasks and ${this.reminders.size} reminders`);
    } catch (error) {
      console.log('Error loading tasks:', error);
    }
  }

  // Get tasks for an application
  getTasksForApplication(appId) {
    return Array.from(this.tasks.values())
      .filter(task => task.applicationId === appId && !task.isDeleted)
      .sort((a, b) => {
        // Sort by: priority, then by due date, then by created date
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  // Get overdue tasks
  getOverdueTasks() {
    return Array.from(this.tasks.values())
      .filter(task => task.isOverdue() && !task.completed && !task.isDeleted);
  }

  // Get tasks due today
  getDueToday() {
    return Array.from(this.tasks.values())
      .filter(task => task.isDueToday() && !task.completed && !task.isDeleted);
  }

  // Get tasks due soon
  getDueSoon() {
    return Array.from(this.tasks.values())
      .filter(task => task.isDueSoon() && !task.completed && !task.isDeleted);
  }

  // Create a new task
  async createTask(taskData) {
    const task = new Task(taskData);
    this.tasks.set(task.id, task);

    try {
      await chrome.runtime.sendMessage({
        type: MessageTypes.ADD_TASK,
        payload: task.toJSON()
      });
      return task;
    } catch (error) {
      console.log('Error creating task:', error);
      this.tasks.delete(task.id);
      throw error;
    }
  }

  // Update a task
  async updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    Object.assign(task, updates);
    task.updatedAt = new Date().toISOString();

    try {
      await chrome.runtime.sendMessage({
        type: MessageTypes.UPDATE_TASK,
        payload: task.toJSON()
      });
      return task;
    } catch (error) {
      console.log('Error updating task:', error);
      throw error;
    }
  }

  // Complete a task
  async completeTask(taskId) {
    return this.updateTask(taskId, {
      completed: true,
      completedAt: new Date().toISOString()
    });
  }

  // Add a reminder to a task
  async addReminder(taskId, reminderData) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    const reminder = new Reminder({ ...reminderData, taskId });
    this.reminders.set(reminder.id, reminder);
    task.reminders.push(reminder);

    return this.updateTask(taskId, { reminders: task.reminders });
  }

  // Remove a reminder
  async removeReminder(taskId, reminderId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    this.reminders.delete(reminderId);
    task.reminders = task.reminders.filter(r => r.id !== reminderId);

    return this.updateTask(taskId, { reminders: task.reminders });
  }

  // Start checking for reminders every minute
  startReminderCheck() {
    this.reminderCheckInterval = setInterval(() => {
      this.checkAndFireReminders();
    }, 60 * 1000); // Check every minute
  }

  // Stop reminder checking
  stopReminderCheck() {
    if (this.reminderCheckInterval) {
      clearInterval(this.reminderCheckInterval);
      this.reminderCheckInterval = null;
    }
  }

  // Check and fire reminders
  async checkAndFireReminders() {
    for (const [taskId, task] of this.tasks) {
      if (task.completed || task.isDeleted) continue;

      for (const reminder of task.reminders) {
        if (reminder.shouldFire(task.dueDate)) {
          await this.fireReminder(reminder, task);
        }
      }
    }
  }

  // Fire a reminder (show notification)
  async fireReminder(reminder, task) {
    const app = Array.from(getApplications() || [])
      .find(a => a.id === task.applicationId);

    const title = `Task Reminder: ${task.title}`;
    const message = `Follow up needed for ${app?.company || 'application'}`;

    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        tag: `task-reminder-${reminder.id}`,
        requireInteraction: true,
        badge: '/images/icon-32.png'
      });
    } else {
      showNotification(message);
    }

    reminder.isTriggered = true;
  }

  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }
}

// Create singleton instance
export const taskManager = new TaskManager();
