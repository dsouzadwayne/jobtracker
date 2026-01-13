/**
 * JobTracker IndexedDB Database Module
 * Provides a proper database for storing applications, profile, and settings
 */

const JobTrackerDB = {
  DB_NAME: 'JobTrackerDB',
  DB_VERSION: 1,
  db: null,

  // Object store names
  STORES: {
    APPLICATIONS: 'applications',
    PROFILE: 'profile',
    SETTINGS: 'settings',
    META: 'meta'
  },

  /**
   * Initialize the database
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.log('JobTracker: Failed to open database', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('JobTracker: Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Applications store with indexes
        if (!db.objectStoreNames.contains(this.STORES.APPLICATIONS)) {
          const appStore = db.createObjectStore(this.STORES.APPLICATIONS, { keyPath: 'id' });
          appStore.createIndex('company', 'company', { unique: false });
          appStore.createIndex('status', 'status', { unique: false });
          appStore.createIndex('dateApplied', 'dateApplied', { unique: false });
          appStore.createIndex('platform', 'platform', { unique: false });
        }

        // Profile store (single record)
        if (!db.objectStoreNames.contains(this.STORES.PROFILE)) {
          db.createObjectStore(this.STORES.PROFILE, { keyPath: 'id' });
        }

        // Settings store (single record)
        if (!db.objectStoreNames.contains(this.STORES.SETTINGS)) {
          db.createObjectStore(this.STORES.SETTINGS, { keyPath: 'id' });
        }

        // Meta store for migration flags etc.
        if (!db.objectStoreNames.contains(this.STORES.META)) {
          db.createObjectStore(this.STORES.META, { keyPath: 'id' });
        }

        console.log('JobTracker: Database schema created/upgraded');
      };
    });
  },

  /**
   * Generate UUID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // ==================== APPLICATIONS ====================

  /**
   * Get all applications
   */
  async getAllApplications() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by dateApplied descending (newest first)
        const apps = request.result.sort((a, b) => {
          const dateA = new Date(a.dateApplied || a.meta?.createdAt);
          const dateB = new Date(b.dateApplied || b.meta?.createdAt);
          return dateB - dateA;
        });
        resolve(apps);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get application by ID
   */
  async getApplication(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readonly');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Find duplicate application by URL or company+position
   */
  async findDuplicate(application) {
    const applications = await this.getAllApplications();

    // Normalize strings for comparison
    const normalize = (str) => (str || '').toLowerCase().trim();

    const newUrl = normalize(application.jobUrl);
    const newCompany = normalize(application.company);
    const newPosition = normalize(application.position);

    for (const app of applications) {
      // Check by job URL (most reliable)
      if (newUrl && normalize(app.jobUrl) === newUrl) {
        return app;
      }

      // Check by company + position combination
      if (newCompany && newPosition) {
        const existingCompany = normalize(app.company);
        const existingPosition = normalize(app.position);

        if (existingCompany === newCompany && existingPosition === newPosition) {
          return app;
        }
      }
    }

    return null;
  },

  /**
   * Add new application (with duplicate check)
   */
  async addApplication(application) {
    await this.init();

    // Check for duplicates first
    const duplicate = await this.findDuplicate(application);
    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        existing: duplicate,
        message: `This job already exists: ${duplicate.position} at ${duplicate.company}`
      };
    }

    const app = {
      ...application,
      id: application.id || this.generateId(),
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      },
      statusHistory: application.statusHistory || [{
        status: application.status || 'applied',
        date: new Date().toISOString(),
        notes: ''
      }]
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.add(app);

      request.onsuccess = () => resolve({ success: true, application: app });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Update existing application
   */
  async updateApplication(application) {
    await this.init();

    // Get existing app first
    const existing = await this.getApplication(application.id);
    if (!existing) {
      throw new Error('Application not found');
    }

    const oldStatus = existing.status;
    const updated = {
      ...existing,
      ...application,
      meta: {
        ...existing.meta,
        updatedAt: new Date().toISOString()
      }
    };

    // Track status change
    if (application.status && application.status !== oldStatus) {
      updated.statusHistory = updated.statusHistory || [];
      updated.statusHistory.push({
        status: application.status,
        date: new Date().toISOString(),
        notes: application.statusNote || ''
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.put(updated);

      request.onsuccess = () => resolve({ success: true, application: updated });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete application
   */
  async deleteApplication(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
      const store = transaction.objectStore(this.STORES.APPLICATIONS);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get application statistics
   */
  async getApplicationStats() {
    const applications = await this.getAllApplications();
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

    return stats;
  },

  // ==================== PROFILE ====================

  /**
   * Get profile
   */
  async getProfile() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.PROFILE], 'readonly');
      const store = transaction.objectStore(this.STORES.PROFILE);
      const request = store.get('main');

      request.onsuccess = () => resolve(request.result || this.getDefaultProfile());
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save profile
   */
  async saveProfile(profile) {
    await this.init();
    const data = {
      ...profile,
      id: 'main',
      meta: {
        ...profile.meta,
        updatedAt: new Date().toISOString()
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.PROFILE], 'readwrite');
      const store = transaction.objectStore(this.STORES.PROFILE);
      const request = store.put(data);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get default profile structure
   */
  getDefaultProfile() {
    return {
      id: 'main',
      personal: {
        firstName: '', middleName: '', lastName: '', email: '', phone: '',
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

  // ==================== SETTINGS ====================

  /**
   * Get settings
   */
  async getSettings() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(this.STORES.SETTINGS);
      const request = store.get('main');

      request.onsuccess = () => resolve({ ...this.getDefaultSettings(), ...request.result });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save settings
   */
  async saveSettings(settings) {
    await this.init();
    const data = {
      ...settings,
      id: 'main'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(this.STORES.SETTINGS);
      const request = store.put(data);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get default settings structure
   */
  getDefaultSettings() {
    return {
      id: 'main',
      autofill: { enabled: true, showFloatingButton: true, autoDetectForms: true, confirmBeforeFill: false, delay: 0 },
      detection: {
        autoTrackSubmissions: true, notifyOnDetection: true,
        enabledPlatforms: ['linkedin', 'indeed', 'glassdoor', 'workday', 'greenhouse', 'lever', 'icims', 'smartrecruiters', 'naukri'],
        enableGenericDetection: true
      },
      ui: { theme: 'system', floatingButtonPosition: 'bottom-right', dashboardView: 'cards' },
      data: { autoBackup: false, backupInterval: 7 },
      customFieldRules: []
    };
  },

  // ==================== MIGRATION ====================

  /**
   * Check if migration is needed and perform it
   */
  async migrateFromChromeStorage() {
    await this.init();

    // Check if already migrated
    const meta = await this.getMeta('migration');
    if (meta?.completed) {
      console.log('JobTracker: Migration already completed');
      return false;
    }

    // Check if Chrome storage has data
    const chromeData = await new Promise(resolve => {
      chrome.storage.local.get(['jobtracker_profile', 'jobtracker_applications', 'jobtracker_settings'], resolve);
    });

    const hasData = chromeData.jobtracker_profile ||
                    chromeData.jobtracker_applications?.length > 0 ||
                    chromeData.jobtracker_settings;

    if (!hasData) {
      console.log('JobTracker: No Chrome storage data to migrate');
      await this.setMeta('migration', { completed: true, date: new Date().toISOString(), hadData: false });
      return false;
    }

    console.log('JobTracker: Starting migration from Chrome storage...');

    try {
      // Migrate profile
      if (chromeData.jobtracker_profile) {
        await this.saveProfile(chromeData.jobtracker_profile);
        console.log('JobTracker: Profile migrated');
      }

      // Migrate applications
      if (chromeData.jobtracker_applications?.length > 0) {
        for (const app of chromeData.jobtracker_applications) {
          await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
            const store = transaction.objectStore(this.STORES.APPLICATIONS);
            const request = store.put(app);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
        console.log(`JobTracker: ${chromeData.jobtracker_applications.length} applications migrated`);
      }

      // Migrate settings
      if (chromeData.jobtracker_settings) {
        await this.saveSettings(chromeData.jobtracker_settings);
        console.log('JobTracker: Settings migrated');

        // Also migrate theme to the new UI prefs key (separate from settings to avoid conflicts)
        if (chromeData.jobtracker_settings.ui?.theme) {
          await new Promise(resolve => {
            chrome.storage.local.set({
              'jobtracker_ui_prefs': { theme: chromeData.jobtracker_settings.ui.theme }
            }, resolve);
          });
          console.log('JobTracker: Theme preference migrated to jobtracker_ui_prefs');
        }
      }

      // Mark migration as complete
      await this.setMeta('migration', {
        completed: true,
        date: new Date().toISOString(),
        hadData: true,
        applicationCount: chromeData.jobtracker_applications?.length || 0
      });

      // Clear Chrome storage after successful migration (but keep jobtracker_ui_prefs)
      await new Promise(resolve => {
        chrome.storage.local.remove(['jobtracker_profile', 'jobtracker_applications', 'jobtracker_settings'], resolve);
      });

      console.log('JobTracker: Migration completed successfully');
      return true;
    } catch (error) {
      console.log('JobTracker: Migration failed', error);
      throw error;
    }
  },

  /**
   * Get meta value
   */
  async getMeta(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.META], 'readonly');
      const store = transaction.objectStore(this.STORES.META);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Set meta value
   */
  async setMeta(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.META], 'readwrite');
      const store = transaction.objectStore(this.STORES.META);
      const request = store.put({ id: key, ...value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== EXPORT/IMPORT ====================

  /**
   * Export all data
   */
  async exportAllData() {
    const [profile, applications, settings] = await Promise.all([
      this.getProfile(),
      this.getAllApplications(),
      this.getSettings()
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      applications,
      settings
    };
  },

  /**
   * Import data
   */
  async importData(data, merge = false) {
    if (merge) {
      // Merge logic
      if (data.applications) {
        const existingApps = await this.getAllApplications();
        const existingIds = new Set(existingApps.map(a => a.id));

        for (const app of data.applications) {
          if (!existingIds.has(app.id)) {
            await new Promise((resolve, reject) => {
              const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
              const store = transaction.objectStore(this.STORES.APPLICATIONS);
              const request = store.add(app);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          }
        }
      }

      if (data.profile) {
        const existingProfile = await this.getProfile();
        await this.saveProfile({ ...existingProfile, ...data.profile });
      }
    } else {
      // Replace all data
      if (data.profile) {
        await this.saveProfile(data.profile);
      }

      if (data.applications) {
        // Clear existing applications
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
          const store = transaction.objectStore(this.STORES.APPLICATIONS);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Add new applications
        for (const app of data.applications) {
          await new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
            const store = transaction.objectStore(this.STORES.APPLICATIONS);
            const request = store.add(app);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      }

      if (data.settings) {
        await this.saveSettings(data.settings);
      }
    }

    return { success: true };
  },

  /**
   * Clear all data (for debugging/reset)
   */
  async clearAllData() {
    await this.init();

    const stores = [this.STORES.APPLICATIONS, this.STORES.PROFILE, this.STORES.SETTINGS, this.STORES.META];

    for (const storeName of stores) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    return { success: true };
  }
};

// Export for ES modules
export { JobTrackerDB };
