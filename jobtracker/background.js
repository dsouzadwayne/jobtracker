/**
 * JobTracker Background Service Worker
 * Handles message passing, keyboard shortcuts, and background operations
 */

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
  IMPORT_DATA: 'IMPORT_DATA'
};

// Storage helper (inline since we can't import in service worker without bundling)
const Storage = {
  KEYS: {
    PROFILE: 'jobtracker_profile',
    APPLICATIONS: 'jobtracker_applications',
    SETTINGS: 'jobtracker_settings'
  },

  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  getDefaultProfile() {
    return {
      personal: {
        firstName: '', lastName: '', email: '', phone: '',
        address: { street: '', city: '', state: '', zipCode: '', country: '' },
        linkedIn: '', github: '', portfolio: '', website: ''
      },
      workHistory: [],
      education: [],
      skills: { languages: [], frameworks: [], tools: [], soft: [], other: [] },
      certifications: [],
      links: [],
      customQA: [],
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 }
    };
  },

  getDefaultSettings() {
    return {
      autofill: { enabled: true, showFloatingButton: true, autoDetectForms: true, confirmBeforeFill: false },
      detection: {
        autoTrackSubmissions: true, notifyOnDetection: true,
        enabledPlatforms: ['linkedin', 'indeed', 'glassdoor', 'workday', 'greenhouse', 'lever', 'icims', 'smartrecruiters']
      },
      ui: { theme: 'system', floatingButtonPosition: 'bottom-right' },
      data: { autoBackup: false, backupInterval: 7 }
    };
  },

  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }
};

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('JobTracker: Extension installed');
    // Initialize default data
    const profile = await Storage.get(Storage.KEYS.PROFILE);
    if (!profile) {
      await Storage.set(Storage.KEYS.PROFILE, Storage.getDefaultProfile());
    }
    const settings = await Storage.get(Storage.KEYS.SETTINGS);
    if (!settings) {
      await Storage.set(Storage.KEYS.SETTINGS, Storage.getDefaultSettings());
    }
  } else if (details.reason === 'update') {
    console.log('JobTracker: Extension updated to version', chrome.runtime.getManifest().version);
  }
});

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
          const profile = await Storage.get(Storage.KEYS.PROFILE);
          response = profile || Storage.getDefaultProfile();
          break;
        }

        case MessageTypes.SAVE_PROFILE: {
          payload.meta = payload.meta || {};
          payload.meta.updatedAt = new Date().toISOString();
          await Storage.set(Storage.KEYS.PROFILE, payload);
          response = { success: true };
          break;
        }

        case MessageTypes.GET_PROFILE_FOR_FILL: {
          const profile = await Storage.get(Storage.KEYS.PROFILE);
          response = profile || Storage.getDefaultProfile();
          break;
        }

        // Application operations
        case MessageTypes.GET_APPLICATIONS: {
          const applications = await Storage.get(Storage.KEYS.APPLICATIONS);
          response = applications || [];
          break;
        }

        case MessageTypes.ADD_APPLICATION: {
          const applications = await Storage.get(Storage.KEYS.APPLICATIONS) || [];
          const newApp = {
            ...payload,
            id: payload.id || Storage.generateId(),
            meta: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1
            },
            statusHistory: payload.statusHistory || [{
              status: payload.status || 'applied',
              date: new Date().toISOString(),
              notes: ''
            }]
          };
          applications.unshift(newApp);
          await Storage.set(Storage.KEYS.APPLICATIONS, applications);
          response = newApp;
          break;
        }

        case MessageTypes.UPDATE_APPLICATION: {
          const applications = await Storage.get(Storage.KEYS.APPLICATIONS) || [];
          const index = applications.findIndex(a => a.id === payload.id);
          if (index !== -1) {
            const oldStatus = applications[index].status;
            applications[index] = {
              ...applications[index],
              ...payload,
              meta: {
                ...applications[index].meta,
                updatedAt: new Date().toISOString()
              }
            };
            // Track status change
            if (payload.status && payload.status !== oldStatus) {
              applications[index].statusHistory = applications[index].statusHistory || [];
              applications[index].statusHistory.push({
                status: payload.status,
                date: new Date().toISOString(),
                notes: payload.statusNote || ''
              });
            }
            await Storage.set(Storage.KEYS.APPLICATIONS, applications);
            response = { success: true, application: applications[index] };
          } else {
            response = { success: false, error: 'Application not found' };
          }
          break;
        }

        case MessageTypes.DELETE_APPLICATION: {
          const applications = await Storage.get(Storage.KEYS.APPLICATIONS) || [];
          const filtered = applications.filter(a => a.id !== payload.id);
          await Storage.set(Storage.KEYS.APPLICATIONS, filtered);
          response = { success: true };
          break;
        }

        case MessageTypes.GET_APPLICATION_STATS: {
          const applications = await Storage.get(Storage.KEYS.APPLICATIONS) || [];
          const stats = {
            total: applications.length,
            byStatus: {},
            thisWeek: 0,
            thisMonth: 0
          };
          const now = new Date();
          const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
          const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

          applications.forEach(app => {
            stats.byStatus[app.status] = (stats.byStatus[app.status] || 0) + 1;
            const appliedDate = new Date(app.dateApplied || app.meta?.createdAt);
            if (appliedDate >= weekAgo) stats.thisWeek++;
            if (appliedDate >= monthAgo) stats.thisMonth++;
          });
          response = stats;
          break;
        }

        // Detection - application submitted
        case MessageTypes.SUBMISSION_DETECTED: {
          const settings = await Storage.get(Storage.KEYS.SETTINGS) || Storage.getDefaultSettings();
          if (settings.detection.autoTrackSubmissions) {
            const applications = await Storage.get(Storage.KEYS.APPLICATIONS) || [];
            const newApp = {
              ...payload,
              id: Storage.generateId(),
              status: 'applied',
              autoDetected: true,
              dateApplied: new Date().toISOString(),
              meta: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
              },
              statusHistory: [{
                status: 'applied',
                date: new Date().toISOString(),
                notes: 'Auto-detected submission'
              }]
            };
            applications.unshift(newApp);
            await Storage.set(Storage.KEYS.APPLICATIONS, applications);
            response = { success: true, application: newApp };

            // Notify user if enabled
            if (settings.detection.notifyOnDetection) {
              chrome.action.setBadgeText({ text: '!' });
              chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
              setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
            }
          }
          break;
        }

        // Settings operations
        case MessageTypes.GET_SETTINGS: {
          const settings = await Storage.get(Storage.KEYS.SETTINGS);
          response = { ...Storage.getDefaultSettings(), ...settings };
          break;
        }

        case MessageTypes.SAVE_SETTINGS: {
          await Storage.set(Storage.KEYS.SETTINGS, payload);
          response = { success: true };
          break;
        }

        // Export/Import
        case MessageTypes.EXPORT_DATA: {
          const [profile, applications, settings] = await Promise.all([
            Storage.get(Storage.KEYS.PROFILE),
            Storage.get(Storage.KEYS.APPLICATIONS),
            Storage.get(Storage.KEYS.SETTINGS)
          ]);
          response = {
            version: 1,
            exportedAt: new Date().toISOString(),
            profile: profile || Storage.getDefaultProfile(),
            applications: applications || [],
            settings: settings || Storage.getDefaultSettings()
          };
          break;
        }

        case MessageTypes.IMPORT_DATA: {
          const { data, merge } = payload;
          if (merge) {
            // Merge logic
            const existingApps = await Storage.get(Storage.KEYS.APPLICATIONS) || [];
            const existingProfile = await Storage.get(Storage.KEYS.PROFILE) || Storage.getDefaultProfile();

            if (data.applications) {
              const existingIds = new Set(existingApps.map(a => a.id));
              const newApps = data.applications.filter(a => !existingIds.has(a.id));
              await Storage.set(Storage.KEYS.APPLICATIONS, [...existingApps, ...newApps]);
            }
            if (data.profile) {
              await Storage.set(Storage.KEYS.PROFILE, { ...existingProfile, ...data.profile });
            }
          } else {
            // Replace
            if (data.profile) await Storage.set(Storage.KEYS.PROFILE, data.profile);
            if (data.applications) await Storage.set(Storage.KEYS.APPLICATIONS, data.applications);
            if (data.settings) await Storage.set(Storage.KEYS.SETTINGS, data.settings);
          }
          response = { success: true };
          break;
        }

        default:
          response = { error: 'Unknown message type' };
      }

      sendResponse(response);
    } catch (error) {
      console.error('JobTracker: Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

console.log('JobTracker: Background service worker loaded');
