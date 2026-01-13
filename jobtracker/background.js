/**
 * JobTracker Background Service Worker
 * Handles message passing, keyboard shortcuts, and background operations
 * Uses IndexedDB for data storage
 */

// Import the database module (ES module)
import { JobTrackerDB } from './lib/database.js';

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
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA'
};

// Alarm name for badge clear
const BADGE_CLEAR_ALARM = 'jobtracker-clear-badge';

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
      await JobTrackerDB.migrateFromChromeStorage();
    } catch (error) {
      console.log('JobTracker: Migration error', error);
    }
  }
});

// Run migration check on startup
(async () => {
  try {
    await JobTrackerDB.init();
    await JobTrackerDB.migrateFromChromeStorage();
  } catch (error) {
    console.log('JobTracker: Startup migration check failed', error);
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

  // Handle async operations
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
          response = await JobTrackerDB.addApplication(payload);
          break;
        }

        case MessageTypes.UPDATE_APPLICATION: {
          response = await JobTrackerDB.updateApplication(payload);
          break;
        }

        case MessageTypes.DELETE_APPLICATION: {
          response = await JobTrackerDB.deleteApplication(payload.id);
          break;
        }

        case MessageTypes.GET_APPLICATION_STATS: {
          response = await JobTrackerDB.getApplicationStats();
          break;
        }

        // Detection - application submitted
        case MessageTypes.SUBMISSION_DETECTED: {
          const settings = await JobTrackerDB.getSettings();
          if (settings.detection.autoTrackSubmissions) {
            const newApp = await JobTrackerDB.addApplication({
              ...payload,
              status: 'applied',
              autoDetected: true,
              dateApplied: new Date().toISOString()
            });
            response = { success: true, application: newApp };

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

        default:
          response = { error: 'Unknown message type' };
      }

      sendResponse(response);
    } catch (error) {
      console.log('JobTracker: Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

console.log('JobTracker: Background service worker loaded');
