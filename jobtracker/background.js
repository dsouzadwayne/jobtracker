/**
 * JobTracker Background Service Worker
 * Handles message passing, keyboard shortcuts, and background operations
 * Uses IndexedDB for data storage
 */

// Import the database module (ES module)
import { JobTrackerDB } from './lib/database.js';
import { JobTrackerIntelligence } from './lib/intelligence/index.js';
import { aiService } from './lib/ai-service.js';

// BroadcastChannel for cross-page communication
const applicationChannel = new BroadcastChannel('jobtracker-applications');

// Message types
const MessageTypes = {
  // Profile
  GET_PROFILE: 'GET_PROFILE',
  SAVE_PROFILE: 'SAVE_PROFILE',

  // Applications
  GET_APPLICATIONS: 'GET_APPLICATIONS',
  ADD_APPLICATION: 'ADD_APPLICATION',
  UPDATE_APPLICATION: 'UPDATE_APPLICATION',
  DELETE_APPLICATION: 'DELETE_APPLICATION',
  GET_APPLICATION_STATS: 'GET_APPLICATION_STATS',
  CHECK_DUPLICATE: 'CHECK_DUPLICATE',

  // Autofill
  TRIGGER_AUTOFILL: 'TRIGGER_AUTOFILL',
  GET_PROFILE_FOR_FILL: 'GET_PROFILE_FOR_FILL',

  // Detection
  FORM_DETECTED: 'FORM_DETECTED',
  SUBMISSION_DETECTED: 'SUBMISSION_DETECTED',

  // Settings
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',

  // Data
  EXPORT_DATA: 'EXPORT_DATA',
  IMPORT_DATA: 'IMPORT_DATA',
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA',

  // Intelligence (Phase 4)
  GET_INSIGHTS: 'GET_INSIGHTS',
  GET_RECOMMENDATIONS: 'GET_RECOMMENDATIONS',
  GET_GOAL_PROGRESS: 'GET_GOAL_PROGRESS',
  SAVE_GOALS: 'SAVE_GOALS',

  // CRM Enhancement - Interviews (Phase B)
  GET_INTERVIEWS: 'GET_INTERVIEWS',
  GET_INTERVIEWS_BY_APP: 'GET_INTERVIEWS_BY_APP',
  GET_UPCOMING_INTERVIEWS: 'GET_UPCOMING_INTERVIEWS',
  ADD_INTERVIEW: 'ADD_INTERVIEW',
  UPDATE_INTERVIEW: 'UPDATE_INTERVIEW',
  DELETE_INTERVIEW: 'DELETE_INTERVIEW',

  // CRM Enhancement - Tasks (Phase C)
  GET_TASKS: 'GET_TASKS',
  GET_TASKS_BY_APP: 'GET_TASKS_BY_APP',
  GET_UPCOMING_TASKS: 'GET_UPCOMING_TASKS',
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',

  // CRM Enhancement - Activities (Phase C)
  GET_ACTIVITIES: 'GET_ACTIVITIES',
  GET_ACTIVITIES_BY_APP: 'GET_ACTIVITIES_BY_APP',
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',

  // CRM Enhancement - Tags & Deadlines (Phase A)
  GET_ALL_TAGS: 'GET_ALL_TAGS',
  GET_EXPIRING_APPLICATIONS: 'GET_EXPIRING_APPLICATIONS',

  // AI Features
  AI_EXTRACT_JOB: 'AI_EXTRACT_JOB',
  AI_PARSE_RESUME: 'AI_PARSE_RESUME',

  // Data Management (Model Downloads & Storage)
  CLEAR_MODELS_METADATA: 'CLEAR_MODELS_METADATA',
  CLEAR_PROFILE: 'CLEAR_PROFILE',
  CLEAR_APPLICATIONS: 'CLEAR_APPLICATIONS',
  GET_APPLICATIONS_SIZE: 'GET_APPLICATIONS_SIZE',
  GET_PROFILE_SIZE: 'GET_PROFILE_SIZE',
  GET_APPLICATIONS_COUNT: 'GET_APPLICATIONS_COUNT',
  GET_MODELS_STATUS: 'GET_MODELS_STATUS',
  SET_MODEL_METADATA: 'SET_MODEL_METADATA',

  // Extraction Feedback (Correction Tracking)
  TRACK_EXTRACTION_CORRECTION: 'TRACK_EXTRACTION_CORRECTION',
  GET_EXTRACTION_FEEDBACK: 'GET_EXTRACTION_FEEDBACK',
  GET_EXTRACTION_FEEDBACK_STATS: 'GET_EXTRACTION_FEEDBACK_STATS',

  // LLM Extraction
  LLM_EXTRACT_JOB: 'LLM_EXTRACT_JOB'
};

// Alarm name for badge clear
const BADGE_CLEAR_ALARM = 'jobtracker-clear-badge';

// Valid message types set for quick lookup
const VALID_MESSAGE_TYPES = new Set(Object.values(MessageTypes));

// Validation constants (mirrors validation.js schemas)
const APPLICATION_STATUSES = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];
const PLATFORMS = ['linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', 'workday', 'icims', 'smartrecruiters', 'naukri', 'other'];
const INTERVIEW_OUTCOMES = ['pending', 'passed', 'failed', 'cancelled'];
// Task priorities - separated for type safety and validation
const TASK_PRIORITIES_STRING = ['low', 'medium', 'high'];
const TASK_PRIORITIES_NUMERIC = [1, 2, 3, 4]; // Planify-style numeric priorities
const TASK_PRIORITIES = [...TASK_PRIORITIES_STRING, ...TASK_PRIORITIES_NUMERIC]; // Combined for backwards compatibility

// Helper to validate URL format
function isValidUrl(string) {
  if (!string) return true; // Empty is allowed
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

// Helper to validate ISO date string
function isValidISODate(string) {
  if (!string) return true; // Empty is allowed
  const date = new Date(string);
  return !isNaN(date.getTime());
}

// Helper to sanitize a string (XSS prevention)
// SECURITY FIX: Don't decode HTML entities first - this allows bypass attacks
// like &#x6a;avascript: becoming javascript: after decode
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return str;

  // HTML encode FIRST to neutralize all special characters
  // This must happen before any pattern removal to prevent bypass attacks
  let sanitized = str
    .replace(/&/g, '&amp;')      // Must come first
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Now remove dangerous URI schemes from the encoded string
  // These patterns match the encoded versions of dangerous schemes
  sanitized = sanitized
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return sanitized;
}

// Allowed URL protocols (strict whitelist)
const ALLOWED_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'];

// Safe characters for relative URLs (path and fragment)
// Only allows alphanumeric, path separators, query strings, and common URL characters
const SAFE_RELATIVE_URL_PATTERN = /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;

// Helper to HTML-encode a URL for safe use in HTML attributes
// NOTE: This should ONLY be used at render time in the UI, NOT when storing URLs
// Storing HTML-encoded URLs breaks URL parsing and navigation
function htmlEncodeUrl(url) {
  return url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper to sanitize a URL
// Returns a validated URL safe for storage. HTML-encoding should be done at render time, not storage time.
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  // Normalize and trim the URL
  const trimmed = url.trim();

  // Use URL constructor for proper validation (handles Unicode escapes, etc.)
  try {
    const parsed = new URL(trimmed);

    // Strict protocol whitelist check
    if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol.toLowerCase())) {
      console.warn('JobTracker: Blocked URL with disallowed protocol:', parsed.protocol);
      return '';
    }

    // Return the validated URL as-is for storage
    // HTML-encoding should only happen at render time in the UI, not at storage time
    return trimmed;
  } catch (error) {
    // If it's not a valid URL, check for relative URLs
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
      // Validate relative URL contains only safe characters
      if (!SAFE_RELATIVE_URL_PATTERN.test(trimmed)) {
        console.warn('JobTracker: Blocked relative URL with unsafe characters');
        return '';
      }
      // Return validated relative URL as-is
      return trimmed;
    }

    // Additional safety check for protocol-like patterns (handles Unicode bypass attempts)
    const protocolMatch = trimmed.match(/^([a-z0-9+.-]+):/i);
    if (protocolMatch && !ALLOWED_URL_PROTOCOLS.includes(protocolMatch[0].toLowerCase())) {
      console.warn('JobTracker: Blocked potentially malicious URL pattern');
      return '';
    }

    // For other invalid URLs, return empty to be safe
    console.warn('JobTracker: Invalid URL format:', trimmed.substring(0, 50));
    return '';
  }
}

// Sanitize application data before storing (deep sanitization)
function sanitizeApplicationData(app) {
  if (!app || typeof app !== 'object') return app;
  const sanitized = { ...app };

  // Sanitize text fields
  const textFields = ['company', 'position', 'location', 'salary', 'notes', 'jobDescription'];
  for (const field of textFields) {
    if (sanitized[field]) {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  }

  // Sanitize URL
  if (sanitized.jobUrl) {
    sanitized.jobUrl = sanitizeUrl(sanitized.jobUrl);
  }

  // Sanitize tags array
  if (Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags.map(tag => sanitizeString(tag));
  }

  // Sanitize nested meta object
  if (sanitized.meta && typeof sanitized.meta === 'object') {
    sanitized.meta = sanitizeObject(sanitized.meta);
  }

  // Sanitize custom fields if present
  if (sanitized.customFields && typeof sanitized.customFields === 'object') {
    sanitized.customFields = sanitizeObject(sanitized.customFields);
  }

  // Sanitize contacts array if present
  if (Array.isArray(sanitized.contacts)) {
    sanitized.contacts = sanitized.contacts.map(contact => {
      if (typeof contact === 'object') {
        return sanitizeObject(contact);
      }
      return sanitizeString(String(contact));
    });
  }

  return sanitized;
}

// Recursively sanitize an object's string values
function sanitizeObject(obj, visited = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return obj;
  if (visited.has(obj)) return obj; // Prevent infinite recursion on circular refs
  visited.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') return sanitizeString(item);
      if (typeof item === 'object') return sanitizeObject(item, visited);
      return item;
    });
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, visited);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Validate message payload based on type
function validatePayload(type, payload) {
  switch (type) {
    case MessageTypes.SAVE_PROFILE:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Profile payload must be an object' };
      }
      break;

    case MessageTypes.ADD_APPLICATION:
    case MessageTypes.UPDATE_APPLICATION:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Application payload must be an object' };
      }
      // Validate required fields for add
      if (type === MessageTypes.ADD_APPLICATION) {
        if (!payload.company && !payload.position) {
          return { valid: false, error: 'Application must have company or position' };
        }
      }
      // Validate required fields for update
      if (type === MessageTypes.UPDATE_APPLICATION && !payload.id) {
        return { valid: false, error: 'Application update requires id' };
      }
      // Validate status if provided
      if (payload.status && !APPLICATION_STATUSES.includes(payload.status)) {
        return { valid: false, error: `Invalid status. Must be one of: ${APPLICATION_STATUSES.join(', ')}` };
      }
      // Validate platform if provided
      if (payload.platform && !PLATFORMS.includes(payload.platform)) {
        return { valid: false, error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` };
      }
      // Validate URL format if provided
      if (payload.jobUrl && !isValidUrl(payload.jobUrl)) {
        return { valid: false, error: 'Invalid job URL format' };
      }
      // Validate date format if provided
      if (payload.dateApplied && !isValidISODate(payload.dateApplied)) {
        return { valid: false, error: 'Invalid dateApplied format' };
      }
      // Validate tags is an array if provided
      if (payload.tags !== undefined && !Array.isArray(payload.tags)) {
        return { valid: false, error: 'Tags must be an array' };
      }
      // Validate string length limits to prevent DoS
      const stringFields = ['company', 'position', 'location', 'salary', 'notes', 'jobDescription'];
      for (const field of stringFields) {
        if (payload[field] && typeof payload[field] === 'string' && payload[field].length > 50000) {
          return { valid: false, error: `${field} exceeds maximum length of 50000 characters` };
        }
      }
      // Validate tags content
      if (Array.isArray(payload.tags)) {
        for (const tag of payload.tags) {
          if (typeof tag !== 'string') {
            return { valid: false, error: 'Each tag must be a string' };
          }
          if (tag.length > 100) {
            return { valid: false, error: 'Tag exceeds maximum length of 100 characters' };
          }
        }
      }
      break;

    case MessageTypes.DELETE_APPLICATION:
      if (!payload || !payload.id) {
        return { valid: false, error: 'Delete requires application id' };
      }
      break;

    case MessageTypes.CHECK_DUPLICATE:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Check duplicate requires payload object' };
      }
      break;

    case MessageTypes.IMPORT_DATA:
      if (!payload || !payload.data || typeof payload.data !== 'object') {
        return { valid: false, error: 'Import requires valid data object' };
      }
      break;

    case MessageTypes.SAVE_SETTINGS:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Settings payload must be an object' };
      }
      break;

    case MessageTypes.SAVE_GOALS:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Goals payload must be an object' };
      }
      break;

    // CRM Enhancement validations
    case MessageTypes.ADD_INTERVIEW:
    case MessageTypes.UPDATE_INTERVIEW:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Interview payload must be an object' };
      }
      if (type === MessageTypes.ADD_INTERVIEW && !payload.applicationId) {
        return { valid: false, error: 'Interview must have applicationId' };
      }
      if (type === MessageTypes.UPDATE_INTERVIEW && !payload.id) {
        return { valid: false, error: 'Interview update requires id' };
      }
      // Validate outcome if provided (normalize to lowercase for backwards compatibility)
      if (payload.outcome) {
        if (typeof payload.outcome !== 'string') {
          return { valid: false, error: 'Outcome must be a string' };
        }
        const normalizedOutcome = payload.outcome.toLowerCase();
        if (!INTERVIEW_OUTCOMES.includes(normalizedOutcome)) {
          return { valid: false, error: `Invalid outcome. Must be one of: ${INTERVIEW_OUTCOMES.join(', ')}` };
        }
        // Normalize the outcome to lowercase
        payload.outcome = normalizedOutcome;
      }
      // Validate scheduled date format if provided
      if (payload.scheduledDate && !isValidISODate(payload.scheduledDate)) {
        return { valid: false, error: 'Invalid scheduledDate format' };
      }
      break;

    case MessageTypes.DELETE_INTERVIEW:
      if (!payload || !payload.id) {
        return { valid: false, error: 'Delete requires interview id' };
      }
      break;

    case MessageTypes.ADD_TASK:
    case MessageTypes.UPDATE_TASK:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Task payload must be an object' };
      }
      if (type === MessageTypes.ADD_TASK && !payload.title) {
        return { valid: false, error: 'Task must have a title' };
      }
      if (type === MessageTypes.UPDATE_TASK && !payload.id) {
        return { valid: false, error: 'Task update requires id' };
      }
      // Validate priority if provided
      if (payload.priority && !TASK_PRIORITIES.includes(payload.priority)) {
        return { valid: false, error: `Invalid priority. Must be one of: ${TASK_PRIORITIES.join(', ')}` };
      }
      // Validate date formats if provided
      if (payload.dueDate && !isValidISODate(payload.dueDate)) {
        return { valid: false, error: 'Invalid dueDate format' };
      }
      if (payload.reminderDate && !isValidISODate(payload.reminderDate)) {
        return { valid: false, error: 'Invalid reminderDate format' };
      }
      break;

    case MessageTypes.DELETE_TASK:
      if (!payload || !payload.id) {
        return { valid: false, error: 'Delete requires task id' };
      }
      break;

    case MessageTypes.ADD_ACTIVITY:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Activity payload must be an object' };
      }
      if (!payload.applicationId || !payload.type) {
        return { valid: false, error: 'Activity must have applicationId and type' };
      }
      break;

    case MessageTypes.DELETE_ACTIVITY:
      if (!payload || !payload.id) {
        return { valid: false, error: 'Delete requires activity id' };
      }
      break;

    // Read-only operations don't need payload validation
    case MessageTypes.GET_PROFILE:
    case MessageTypes.GET_PROFILE_FOR_FILL:
    case MessageTypes.GET_APPLICATIONS:
    case MessageTypes.GET_APPLICATION_STATS:
    case MessageTypes.GET_SETTINGS:
    case MessageTypes.EXPORT_DATA:
    case MessageTypes.CLEAR_ALL_DATA:
    case MessageTypes.TRIGGER_AUTOFILL:
    case MessageTypes.FORM_DETECTED:
    case MessageTypes.SUBMISSION_DETECTED:
    case MessageTypes.GET_INSIGHTS:
    case MessageTypes.GET_RECOMMENDATIONS:
    case MessageTypes.GET_GOAL_PROGRESS:
    case MessageTypes.GET_INTERVIEWS:
    case MessageTypes.GET_INTERVIEWS_BY_APP:
    case MessageTypes.GET_UPCOMING_INTERVIEWS:
    case MessageTypes.GET_TASKS:
    case MessageTypes.GET_TASKS_BY_APP:
    case MessageTypes.GET_UPCOMING_TASKS:
    case MessageTypes.GET_ACTIVITIES:
    case MessageTypes.GET_ACTIVITIES_BY_APP:
    case MessageTypes.GET_ALL_TAGS:
    case MessageTypes.GET_EXPIRING_APPLICATIONS:
    case MessageTypes.CLEAR_MODELS_METADATA:
    case MessageTypes.CLEAR_PROFILE:
    case MessageTypes.CLEAR_APPLICATIONS:
    case MessageTypes.GET_APPLICATIONS_SIZE:
    case MessageTypes.GET_PROFILE_SIZE:
    case MessageTypes.GET_APPLICATIONS_COUNT:
    case MessageTypes.GET_MODELS_STATUS:
    case MessageTypes.SET_MODEL_METADATA:
    case MessageTypes.GET_EXTRACTION_FEEDBACK:
    case MessageTypes.GET_EXTRACTION_FEEDBACK_STATS:
    case MessageTypes.LLM_EXTRACT_JOB:
      break;

    case MessageTypes.TRACK_EXTRACTION_CORRECTION:
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Correction payload must be an object' };
      }
      if (!payload.url) {
        return { valid: false, error: 'Correction requires URL' };
      }
      break;

    default:
      return { valid: false, error: 'Unknown message type' };
  }
  return { valid: true };
}

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_CLEAR_ALARM) {
    chrome.action.setBadgeText({ text: '' });
  }
});

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('JobTracker: Extension installed');
    // Initialize database and set defaults
    await JobTrackerDB.init();
    const profile = await JobTrackerDB.getProfile();
    if (!profile || !profile.personal) {
      await JobTrackerDB.saveProfile(JobTrackerDB.getDefaultProfile());
    }
    const settings = await JobTrackerDB.getSettings();
    if (!settings.id) {
      await JobTrackerDB.saveSettings(JobTrackerDB.getDefaultSettings());
    }
  } else if (details.reason === 'update') {
    console.log('JobTracker: Extension updated to version', chrome.runtime.getManifest().version);
    // Run migration from Chrome storage to IndexedDB
    try {
      const migrationResult = await JobTrackerDB.migrateFromChromeStorage();
      if (migrationResult?.migrated) {
        console.log('JobTracker: Migration completed successfully');
      }
    } catch (error) {
      console.error('JobTracker: Migration failed!', error);
      // Store migration error for user notification
      await chrome.storage.local.set({
        'jobtracker_migration_error': {
          message: error.message || 'Unknown migration error',
          timestamp: new Date().toISOString(),
          version: chrome.runtime.getManifest().version
        }
      });
      // Show badge to alert user
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // Red color for error
      chrome.action.setTitle({
        title: 'JobTracker: Migration error occurred. Click to see details.'
      });
    }
  }
});

// Run migration check on startup
(async () => {
  try {
    await JobTrackerDB.init();
    const migrationResult = await JobTrackerDB.migrateFromChromeStorage();
    if (migrationResult?.migrated) {
      console.log('JobTracker: Startup migration completed successfully');
    }
  } catch (error) {
    console.error('JobTracker: Startup migration check failed', error);
    // Store error for user notification without blocking extension startup
    try {
      await chrome.storage.local.set({
        'jobtracker_migration_error': {
          message: error.message || 'Unknown migration error',
          timestamp: new Date().toISOString(),
          context: 'startup'
        }
      });
    } catch (storageError) {
      console.error('JobTracker: Failed to store migration error', storageError);
    }
  }
})();

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-autofill') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: MessageTypes.TRIGGER_AUTOFILL });
    }
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  // Validate message type
  if (!type || !VALID_MESSAGE_TYPES.has(type)) {
    sendResponse({ error: 'Invalid message type' });
    return true;
  }

  // Validate payload
  const validation = validatePayload(type, payload);
  if (!validation.valid) {
    console.warn('JobTracker: Message validation failed:', validation.error);
    sendResponse({ error: validation.error });
    return true;
  }

  // Handle async operations
  let responseSent = false;
  (async () => {
    try {
      let response;

      switch (type) {
        // Profile operations
        case MessageTypes.GET_PROFILE: {
          response = await JobTrackerDB.getProfile();
          break;
        }

        case MessageTypes.SAVE_PROFILE: {
          await JobTrackerDB.saveProfile(payload);
          response = { success: true };
          break;
        }

        case MessageTypes.GET_PROFILE_FOR_FILL: {
          response = await JobTrackerDB.getProfile();
          break;
        }

        // Application operations
        case MessageTypes.GET_APPLICATIONS: {
          response = await JobTrackerDB.getAllApplications();
          break;
        }

        case MessageTypes.ADD_APPLICATION: {
          // Sanitize application data before storing
          const sanitizedPayload = sanitizeApplicationData(payload);
          response = await JobTrackerDB.addApplication(sanitizedPayload);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'add' });
          break;
        }

        case MessageTypes.UPDATE_APPLICATION: {
          // Sanitize application data before storing
          const sanitizedUpdatePayload = sanitizeApplicationData(payload);
          response = await JobTrackerDB.updateApplication(sanitizedUpdatePayload);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'update' });
          break;
        }

        case MessageTypes.DELETE_APPLICATION: {
          response = await JobTrackerDB.deleteApplication(payload.id);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'delete' });
          break;
        }

        case MessageTypes.GET_APPLICATION_STATS: {
          // Phase 3: Support date range filtering
          const options = payload || {};
          response = await JobTrackerDB.getApplicationStats(options);
          break;
        }

        case MessageTypes.CHECK_DUPLICATE: {
          const { jobUrl, company, position } = payload;
          const duplicate = await JobTrackerDB.findDuplicate({ jobUrl, company, position });
          response = { exists: !!duplicate, application: duplicate };
          break;
        }

        // Detection - application submitted
        case MessageTypes.SUBMISSION_DETECTED: {
          const settings = await JobTrackerDB.getSettings();
          if (settings?.detection?.autoTrackSubmissions) {
            const newApp = await JobTrackerDB.addApplication({
              ...payload,
              status: 'applied',
              autoDetected: true,
              dateApplied: new Date().toISOString()
            });
            response = { success: true, application: newApp };
            applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'add' });

            // Notify user if enabled
            if (settings.detection.notifyOnDetection) {
              chrome.action.setBadgeText({ text: '!' });
              chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
              // Use chrome.alarms instead of setTimeout for service worker compatibility
              chrome.alarms.create(BADGE_CLEAR_ALARM, { delayInMinutes: 5 / 60 }); // 5 seconds
            }
          }
          break;
        }

        // Settings operations
        case MessageTypes.GET_SETTINGS: {
          response = await JobTrackerDB.getSettings();
          break;
        }

        case MessageTypes.SAVE_SETTINGS: {
          await JobTrackerDB.saveSettings(payload);
          response = { success: true };
          break;
        }

        // Export/Import
        case MessageTypes.EXPORT_DATA: {
          response = await JobTrackerDB.exportAllData();
          break;
        }

        case MessageTypes.IMPORT_DATA: {
          const { data, merge } = payload;
          response = await JobTrackerDB.importData(data, merge);
          break;
        }

        case MessageTypes.CLEAR_ALL_DATA: {
          await JobTrackerDB.clearAllData();
          response = { success: true };
          break;
        }

        // Autofill - forward to active tab
        case MessageTypes.TRIGGER_AUTOFILL: {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: MessageTypes.TRIGGER_AUTOFILL });
            response = { success: true };
          } else {
            response = { error: 'No active tab found' };
          }
          break;
        }

        // Intelligence operations (Phase 4)
        case MessageTypes.GET_INSIGHTS: {
          const apps = await JobTrackerDB.getAllApplications();
          const options = payload || {};
          response = JobTrackerIntelligence.generateInsights(apps, options);
          break;
        }

        case MessageTypes.GET_RECOMMENDATIONS: {
          const apps = await JobTrackerDB.getAllApplications();
          const goals = await JobTrackerDB.getGoals();
          const goalProgress = await JobTrackerDB.getGoalProgress();
          response = JobTrackerIntelligence.getRecommendations(apps, goals, goalProgress);
          break;
        }

        case MessageTypes.GET_GOAL_PROGRESS: {
          response = await JobTrackerDB.getGoalProgress();
          break;
        }

        case MessageTypes.SAVE_GOALS: {
          response = await JobTrackerDB.saveGoals(payload);
          break;
        }

        // ==================== CRM ENHANCEMENT: Interviews ====================
        case MessageTypes.GET_INTERVIEWS: {
          response = await JobTrackerDB.getAllInterviews();
          break;
        }

        case MessageTypes.GET_INTERVIEWS_BY_APP: {
          response = await JobTrackerDB.getInterviewsByApplication(payload.applicationId);
          break;
        }

        case MessageTypes.GET_UPCOMING_INTERVIEWS: {
          const limit = payload?.limit || 10;
          response = await JobTrackerDB.getUpcomingInterviews(limit);
          break;
        }

        case MessageTypes.ADD_INTERVIEW: {
          response = await JobTrackerDB.addInterview(payload);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'interview_add' });
          break;
        }

        case MessageTypes.UPDATE_INTERVIEW: {
          response = await JobTrackerDB.updateInterview(payload);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'interview_update' });
          break;
        }

        case MessageTypes.DELETE_INTERVIEW: {
          response = await JobTrackerDB.deleteInterview(payload.id);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'interview_delete' });
          break;
        }

        // ==================== CRM ENHANCEMENT: Tasks ====================
        case MessageTypes.GET_TASKS: {
          response = await JobTrackerDB.getAllTasks();
          break;
        }

        case MessageTypes.GET_TASKS_BY_APP: {
          response = await JobTrackerDB.getTasksByApplication(payload.applicationId);
          break;
        }

        case MessageTypes.GET_UPCOMING_TASKS: {
          const limit = payload?.limit || 10;
          response = await JobTrackerDB.getUpcomingTasks(limit);
          break;
        }

        case MessageTypes.ADD_TASK: {
          response = await JobTrackerDB.addTask(payload);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'task_add' });
          break;
        }

        case MessageTypes.UPDATE_TASK: {
          response = await JobTrackerDB.updateTask(payload);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'task_update' });
          break;
        }

        case MessageTypes.DELETE_TASK: {
          response = await JobTrackerDB.deleteTask(payload.id);
          applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'task_delete' });
          break;
        }

        // ==================== CRM ENHANCEMENT: Activities ====================
        case MessageTypes.GET_ACTIVITIES: {
          response = await JobTrackerDB.getAllActivities();
          break;
        }

        case MessageTypes.GET_ACTIVITIES_BY_APP: {
          response = await JobTrackerDB.getActivitiesByApplication(payload.applicationId);
          break;
        }

        case MessageTypes.ADD_ACTIVITY: {
          response = await JobTrackerDB.addActivity(payload);
          break;
        }

        case MessageTypes.DELETE_ACTIVITY: {
          response = await JobTrackerDB.deleteActivity(payload.id);
          break;
        }

        // ==================== CRM ENHANCEMENT: Tags & Deadlines ====================
        case MessageTypes.GET_ALL_TAGS: {
          response = await JobTrackerDB.getAllTags();
          break;
        }

        case MessageTypes.GET_EXPIRING_APPLICATIONS: {
          const days = payload?.days || 3;
          response = await JobTrackerDB.getExpiringApplications(days);
          break;
        }

        // ==================== DATA MANAGEMENT ====================
        case MessageTypes.CLEAR_MODELS_METADATA: {
          try {
            await JobTrackerDB.clearModelsMetadata();
            response = { success: true };
          } catch (error) {
            response = { success: false, error: error.message };
          }
          break;
        }

        case MessageTypes.CLEAR_PROFILE: {
          try {
            await JobTrackerDB.deleteProfile();
            response = { success: true };
          } catch (error) {
            response = { success: false, error: error.message };
          }
          break;
        }

        case MessageTypes.CLEAR_APPLICATIONS: {
          try {
            await JobTrackerDB.clearAllApplications();
            await JobTrackerDB.clearAllInterviews();
            await JobTrackerDB.clearAllTasks();
            await JobTrackerDB.clearAllActivities();
            applicationChannel.postMessage({ type: 'DATA_CHANGED', action: 'clear' });
            response = { success: true };
          } catch (error) {
            response = { success: false, error: error.message };
          }
          break;
        }

        case MessageTypes.GET_APPLICATIONS_SIZE: {
          try {
            const apps = await JobTrackerDB.getAllApplications();
            const size = JSON.stringify(apps).length;
            response = { size };
          } catch (error) {
            response = { size: 0 };
          }
          break;
        }

        case MessageTypes.GET_PROFILE_SIZE: {
          try {
            const profile = await JobTrackerDB.getProfile();
            const size = JSON.stringify(profile).length;
            response = { size };
          } catch (error) {
            response = { size: 0 };
          }
          break;
        }

        case MessageTypes.GET_APPLICATIONS_COUNT: {
          try {
            const apps = await JobTrackerDB.getAllApplications();
            response = { count: apps.length };
          } catch (error) {
            response = { count: 0 };
          }
          break;
        }

        case MessageTypes.GET_MODELS_STATUS: {
          try {
            response = await JobTrackerDB.getModelsDownloadStatus();
          } catch (error) {
            response = {
              embeddings: { downloadStatus: 'not_started' },
              ner: { downloadStatus: 'not_started' }
            };
          }
          break;
        }

        case MessageTypes.SET_MODEL_METADATA: {
          try {
            const { modelId, ...metadata } = payload;
            await JobTrackerDB.setModelMetadata(modelId, metadata);
            response = { success: true };
          } catch (error) {
            response = { success: false, error: error.message };
          }
          break;
        }

        // AI Features - ML extraction for job tracking
        case MessageTypes.AI_EXTRACT_JOB: {
          // Extract job info using ML - always enabled for tracking unsupported sites
          const text = payload?.text || '';
          if (!text) {
            response = { success: false, error: 'No text provided' };
            break;
          }

          try {
            // First try fast regex-based extraction
            const extracted = extractJobInfoFromText(text);

            // If company or position is missing, use ML model (NER)
            if (!extracted.company || !extracted.position) {
              console.log('JobTracker: Regex extraction incomplete, using ML model...');

              try {
                // Parse job posting with ML (init handled internally via singleton)
                const mlResult = await aiService.parseJobPosting(text, true);

                // Fill in missing fields from ML extraction
                if (!extracted.company && mlResult.company) {
                  extracted.company = mlResult.company;
                  console.log('JobTracker: ML extracted company:', extracted.company);
                }

                if (!extracted.location && mlResult.location) {
                  extracted.location = mlResult.location;
                }

                // Try to get position from skills/entities context if still missing
                if (!extracted.position && mlResult.suggestedTags?.length > 0) {
                  // Use tags as hints for position type
                  extracted.suggestedTags = mlResult.suggestedTags;
                }

                // Add any skills found
                if (mlResult.skills) {
                  extracted.skills = mlResult.skills;
                }

              } catch (mlError) {
                console.log('JobTracker: ML extraction failed, using regex only:', mlError.message);
              }
            }

            response = { success: true, data: extracted };
          } catch (error) {
            console.error('JobTracker: Extraction error:', error);
            response = { success: false, error: error.message };
          }
          break;
        }

        // AI Resume Parsing (for NLP pipeline)
        case MessageTypes.AI_PARSE_RESUME: {
          try {
            const { text } = payload;
            await aiService.init();
            const result = await aiService.parseResume(text, true);
            response = { success: true, data: result };
          } catch (error) {
            console.error('JobTracker: Resume parsing error:', error);
            response = { success: false, error: error.message };
          }
          break;
        }

        // ==================== EXTRACTION FEEDBACK ====================
        case MessageTypes.TRACK_EXTRACTION_CORRECTION: {
          try {
            const { extracted, corrected, url, domain, applicationId } = payload;

            // Calculate which fields were corrected
            const corrections = {};
            const fields = ['position', 'company', 'location', 'salary'];

            for (const field of fields) {
              const extractedValue = extracted?.[field] || '';
              const correctedValue = corrected?.[field] || '';

              if (extractedValue !== correctedValue && correctedValue) {
                corrections[field] = {
                  from: extractedValue,
                  to: correctedValue
                };
              }
            }

            // Only store if there were actual corrections
            if (Object.keys(corrections).length > 0) {
              const feedbackData = {
                applicationId,
                url,
                domain: domain || (() => {
                  try { return new URL(url).hostname; }
                  catch { return 'unknown'; }
                })(),
                extracted,
                corrected,
                corrections,
                timestamp: new Date().toISOString()
              };

              response = await JobTrackerDB.addExtractionFeedback(feedbackData);
              console.log('JobTracker: Tracked extraction correction:', corrections);
            } else {
              response = { success: true, noChanges: true };
            }
          } catch (error) {
            console.error('JobTracker: Correction tracking error:', error);
            response = { success: false, error: error.message };
          }
          break;
        }

        case MessageTypes.GET_EXTRACTION_FEEDBACK: {
          try {
            const domain = payload?.domain;
            if (domain) {
              response = await JobTrackerDB.getExtractionFeedbackByDomain(domain);
            } else {
              response = await JobTrackerDB.getAllExtractionFeedback();
            }
          } catch (error) {
            console.error('JobTracker: Get feedback error:', error);
            response = { success: false, error: error.message };
          }
          break;
        }

        case MessageTypes.GET_EXTRACTION_FEEDBACK_STATS: {
          try {
            response = await JobTrackerDB.getExtractionFeedbackStats();
          } catch (error) {
            console.error('JobTracker: Get feedback stats error:', error);
            response = { success: false, error: error.message };
          }
          break;
        }

        // ==================== LLM EXTRACTION ====================
        case MessageTypes.LLM_EXTRACT_JOB: {
          try {
            const settings = await JobTrackerDB.getSettings();

            // Check if LLM is enabled
            if (!settings?.ai?.llmEnabled) {
              response = { success: false, error: 'LLM extraction not enabled' };
              break;
            }

            const { text, currentResults, url } = payload;
            if (!text) {
              response = { success: false, error: 'No text provided' };
              break;
            }

            // Check cache (24 hour TTL)
            const cacheKey = `llm_extract_${url || hashString(text.substring(0, 500))}`;
            const cached = await getCachedLLMResult(cacheKey);
            if (cached) {
              response = { success: true, data: cached, cached: true };
              break;
            }

            // Call AI service for LLM extraction
            const llmResult = await aiService.extractJobWithLLM(text, currentResults);

            if (llmResult) {
              // Cache the result
              await cacheLLMResult(cacheKey, llmResult);
              response = { success: true, data: llmResult };
            } else {
              response = { success: false, error: 'LLM extraction returned no results' };
            }
          } catch (error) {
            console.error('JobTracker: LLM extraction error:', error);
            response = { success: false, error: error.message };
          }
          break;
        }

        default:
          response = { error: 'Unknown message type' };
      }

      if (!responseSent) {
        sendResponse(response);
        responseSent = true;
      }
    } catch (error) {
      console.error('JobTracker: Error handling message:', error);
      if (!responseSent) {
        sendResponse({ error: error?.message || String(error) || 'An unknown error occurred' });
        responseSent = true;
      }
    }
  })().catch((error) => {
    console.error('JobTracker: Unhandled async error:', error);
    if (!responseSent) {
      sendResponse({ error: 'An unexpected error occurred' });
    }
  });

  return true; // Keep message channel open for async response
});

/**
 * Extract job info from text using regex patterns
 * Used for AI-assisted job extraction on unsupported sites
 */
function extractJobInfoFromText(text) {
  const result = {
    company: '',
    position: '',
    location: '',
    salary: '',
    jobType: '',
    remote: ''
  };

  // Salary patterns
  const salaryPatterns = [
    /\$[\d,]+(?:k|K)?(?:\s*[-–to]+\s*\$?[\d,]+(?:k|K)?)?(?:\s*(?:per\s+)?(?:year|yr|annually|annual|pa|p\.a\.))?/gi,
    /(?:salary|compensation|pay|package)[:\s]*\$?[\d,]+\s*[-–to]+\s*\$?[\d,]+/gi,
    /£[\d,]+(?:k|K)?(?:\s*[-–to]+\s*£?[\d,]+(?:k|K)?)?/gi,
    /€[\d,]+(?:k|K)?(?:\s*[-–to]+\s*€?[\d,]+(?:k|K)?)?/gi,
    /(?:USD|EUR|GBP|INR)\s*[\d,]+(?:\s*[-–to]+\s*[\d,]+)?/gi
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      result.salary = match[0].trim();
      break;
    }
  }

  // Job type patterns
  const jobTypeMatch = text.match(/\b(full[- ]?time|part[- ]?time|contract|freelance|internship|temporary|permanent)\b/i);
  if (jobTypeMatch?.[1]) {
    result.jobType = jobTypeMatch[1].toLowerCase().replace(/[- ]/g, '-');
  }

  // Remote patterns
  const remotePatterns = [
    /\b(fully\s+remote|100%\s+remote|remote\s+only)\b/i,
    /\b(hybrid|remote|on[- ]?site|in[- ]?office|work\s+from\s+home|wfh)\b/i
  ];

  for (const pattern of remotePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].toLowerCase();
      if (value.includes('remote') || value.includes('wfh') || value.includes('work from home')) {
        result.remote = 'remote';
      } else if (value.includes('hybrid')) {
        result.remote = 'hybrid';
      } else if (value.includes('site') || value.includes('office')) {
        result.remote = 'onsite';
      }
      break;
    }
  }

  // Location patterns - look for common location formats
  const locationPatterns = [
    /(?:location|based in|located in|office)[:\s]+([A-Z][a-zA-Z\s,]+(?:,\s*[A-Z]{2})?)/i,
    /([A-Z][a-z]+(?:,\s*[A-Z]{2})?)\s*(?:\||-|–)\s*(?:remote|hybrid|on-?site)/i
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      result.location = match[1].trim();
      break;
    }
  }

  // Try to extract company name - look for common patterns
  const companyPatterns = [
    /(?:company|employer|organization|about\s+us)[:\s]+([A-Z][A-Za-z0-9\s&.,]+?)(?:\s+is|\s+was|\.|,|\n)/i,
    /(?:join|work(?:ing)?\s+(?:at|for|with))\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s+as|\s+and|,|\.|\!)/i,
    /([A-Z][A-Za-z0-9\s&.]+?)\s+is\s+(?:hiring|looking|seeking|recruiting)/i
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match?.[1] && match[1].length < 50) {
      result.company = match[1].trim();
      break;
    }
  }

  // Try to extract position/title
  const positionPatterns = [
    /(?:position|role|title|job)[:\s]+([A-Z][A-Za-z0-9\s\-\/&]+?)(?:\s+at|\s+in|,|\.|\n)/i,
    /(?:hiring|seeking|looking\s+for)\s+(?:a|an)?\s*([A-Z][A-Za-z0-9\s\-\/&]+?)(?:\s+to|\s+who|,|\.)/i,
    /^([A-Z][A-Za-z0-9\s\-\/&]+?)\s+(?:position|role|opportunity|opening)/im
  ];

  for (const pattern of positionPatterns) {
    const match = text.match(pattern);
    if (match?.[1] && match[1].length < 80) {
      result.position = match[1].trim();
      break;
    }
  }

  return result;
}

// ==================== LLM CACHING HELPERS ====================

/**
 * Simple string hash for cache keys
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached LLM result
 * @param {string} cacheKey - Cache key
 * @returns {Promise<Object|null>} Cached result or null
 */
async function getCachedLLMResult(cacheKey) {
  try {
    const cached = await JobTrackerDB.getMeta(cacheKey);
    if (cached && cached.data) {
      // Check TTL (24 hours)
      const age = Date.now() - new Date(cached.timestamp).getTime();
      const TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
      if (age < TTL) {
        return cached.data;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Cache LLM result
 * @param {string} cacheKey - Cache key
 * @param {Object} data - Data to cache
 */
async function cacheLLMResult(cacheKey, data) {
  try {
    await JobTrackerDB.setMeta(cacheKey, {
      data,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.warn('JobTracker: Failed to cache LLM result:', e.message);
  }
}

console.log('JobTracker: Background service worker loaded');
