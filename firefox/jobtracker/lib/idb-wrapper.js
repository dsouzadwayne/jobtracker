/**
 * JobTracker IDB Wrapper
 * Promise-based wrapper around IndexedDB using idb library
 * Provides cleaner async/await syntax for database operations
 */

// Check if idb is available (loaded from vendor/idb.min.js)
const idbAvailable = typeof idb !== 'undefined';

/**
 * Database configuration
 */
const DB_CONFIG = {
  name: 'JobTrackerDB',
  version: 3,
  stores: {
    applications: 'applications',
    profile: 'profile',
    settings: 'settings',
    meta: 'meta',
    interviews: 'interviews',
    tasks: 'tasks',
    activities: 'activities',
    models_metadata: 'models_metadata'
  }
};

/**
 * IDB Database wrapper class
 */
class IDBWrapper {
  constructor() {
    this.db = null;
    this.dbPromise = null;
  }

  /**
   * Open/get the database connection
   * @returns {Promise<IDBDatabase>}
   */
  async getDB() {
    if (this.db) return this.db;

    if (!idbAvailable) {
      throw new Error('idb library not available');
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = idb.openDB(DB_CONFIG.name, DB_CONFIG.version, {
      upgrade(db, oldVersion) {
        // Applications store
        if (!db.objectStoreNames.contains('applications')) {
          const appStore = db.createObjectStore('applications', { keyPath: 'id' });
          appStore.createIndex('company', 'company', { unique: false });
          appStore.createIndex('status', 'status', { unique: false });
          appStore.createIndex('dateApplied', 'dateApplied', { unique: false });
          appStore.createIndex('platform', 'platform', { unique: false });
          appStore.createIndex('deadline', 'deadline', { unique: false });
        } else if (oldVersion < 2) {
          // Migration handled by main database.js
        }

        // Profile store
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        // Meta store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' });
        }

        // Interviews store
        if (!db.objectStoreNames.contains('interviews')) {
          const interviewStore = db.createObjectStore('interviews', { keyPath: 'id' });
          interviewStore.createIndex('applicationId', 'applicationId', { unique: false });
          interviewStore.createIndex('scheduledDate', 'scheduledDate', { unique: false });
          interviewStore.createIndex('outcome', 'outcome', { unique: false });
        }

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('applicationId', 'applicationId', { unique: false });
          taskStore.createIndex('dueDate', 'dueDate', { unique: false });
          taskStore.createIndex('completed', 'completed', { unique: false });
          taskStore.createIndex('reminderDate', 'reminderDate', { unique: false });
        }

        // Activities store
        if (!db.objectStoreNames.contains('activities')) {
          const activityStore = db.createObjectStore('activities', { keyPath: 'id' });
          activityStore.createIndex('applicationId', 'applicationId', { unique: false });
          activityStore.createIndex('type', 'type', { unique: false });
          activityStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Models metadata store
        if (!db.objectStoreNames.contains('models_metadata')) {
          const modelsStore = db.createObjectStore('models_metadata', { keyPath: 'modelId' });
          modelsStore.createIndex('downloadStatus', 'downloadStatus', { unique: false });
          modelsStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }
      }
    });

    this.db = await this.dbPromise;
    return this.db;
  }

  // ==================== GENERIC OPERATIONS ====================

  /**
   * Get all records from a store
   * @param {string} storeName - Object store name
   * @returns {Promise<Array>}
   */
  async getAll(storeName) {
    const db = await this.getDB();
    return db.getAll(storeName);
  }

  /**
   * Get a record by key
   * @param {string} storeName - Object store name
   * @param {string} key - Record key
   * @returns {Promise<any>}
   */
  async get(storeName, key) {
    const db = await this.getDB();
    return db.get(storeName, key);
  }

  /**
   * Put (add/update) a record
   * @param {string} storeName - Object store name
   * @param {any} value - Record to store
   * @returns {Promise<string>} Key of the stored record
   */
  async put(storeName, value) {
    const db = await this.getDB();
    return db.put(storeName, value);
  }

  /**
   * Delete a record
   * @param {string} storeName - Object store name
   * @param {string} key - Record key
   * @returns {Promise<void>}
   */
  async delete(storeName, key) {
    const db = await this.getDB();
    return db.delete(storeName, key);
  }

  /**
   * Clear all records from a store
   * @param {string} storeName - Object store name
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    const db = await this.getDB();
    return db.clear(storeName);
  }

  /**
   * Get all records from an index
   * @param {string} storeName - Object store name
   * @param {string} indexName - Index name
   * @param {any} query - Optional query value
   * @returns {Promise<Array>}
   */
  async getAllFromIndex(storeName, indexName, query) {
    const db = await this.getDB();
    return db.getAllFromIndex(storeName, indexName, query);
  }

  /**
   * Count records in a store
   * @param {string} storeName - Object store name
   * @returns {Promise<number>}
   */
  async count(storeName) {
    const db = await this.getDB();
    return db.count(storeName);
  }

  // ==================== APPLICATIONS ====================

  /**
   * Get all applications sorted by date
   * @returns {Promise<Array>}
   */
  async getAllApplications() {
    const apps = await this.getAll('applications');
    return apps.sort((a, b) => {
      const dateA = new Date(a.dateApplied || a.meta?.createdAt);
      const dateB = new Date(b.dateApplied || b.meta?.createdAt);
      return dateB - dateA;
    });
  }

  /**
   * Get application by ID
   * @param {string} id
   * @returns {Promise<any>}
   */
  async getApplication(id) {
    return this.get('applications', id);
  }

  /**
   * Get applications by status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getApplicationsByStatus(status) {
    return this.getAllFromIndex('applications', 'status', status);
  }

  /**
   * Save application
   * @param {any} application
   * @returns {Promise<string>}
   */
  async saveApplication(application) {
    return this.put('applications', application);
  }

  /**
   * Delete application
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteApplication(id) {
    return this.delete('applications', id);
  }

  // ==================== PROFILE ====================

  /**
   * Get profile
   * @returns {Promise<any>}
   */
  async getProfile() {
    return this.get('profile', 'userProfile');
  }

  /**
   * Save profile
   * @param {any} profile
   * @returns {Promise<string>}
   */
  async saveProfile(profile) {
    return this.put('profile', { ...profile, id: 'userProfile' });
  }

  // ==================== SETTINGS ====================

  /**
   * Get settings
   * @returns {Promise<any>}
   */
  async getSettings() {
    return this.get('settings', 'userSettings');
  }

  /**
   * Save settings
   * @param {any} settings
   * @returns {Promise<string>}
   */
  async saveSettings(settings) {
    return this.put('settings', { ...settings, id: 'userSettings' });
  }

  // ==================== INTERVIEWS ====================

  /**
   * Get all interviews
   * @returns {Promise<Array>}
   */
  async getAllInterviews() {
    return this.getAll('interviews');
  }

  /**
   * Get interviews by application ID
   * @param {string} applicationId
   * @returns {Promise<Array>}
   */
  async getInterviewsByApplication(applicationId) {
    return this.getAllFromIndex('interviews', 'applicationId', applicationId);
  }

  /**
   * Save interview
   * @param {any} interview
   * @returns {Promise<string>}
   */
  async saveInterview(interview) {
    return this.put('interviews', interview);
  }

  /**
   * Delete interview
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteInterview(id) {
    return this.delete('interviews', id);
  }

  // ==================== TASKS ====================

  /**
   * Get all tasks
   * @returns {Promise<Array>}
   */
  async getAllTasks() {
    return this.getAll('tasks');
  }

  /**
   * Get tasks by application ID
   * @param {string} applicationId
   * @returns {Promise<Array>}
   */
  async getTasksByApplication(applicationId) {
    return this.getAllFromIndex('tasks', 'applicationId', applicationId);
  }

  /**
   * Save task
   * @param {any} task
   * @returns {Promise<string>}
   */
  async saveTask(task) {
    return this.put('tasks', task);
  }

  /**
   * Delete task
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteTask(id) {
    return this.delete('tasks', id);
  }

  // ==================== ACTIVITIES ====================

  /**
   * Get all activities
   * @returns {Promise<Array>}
   */
  async getAllActivities() {
    return this.getAll('activities');
  }

  /**
   * Get activities by application ID
   * @param {string} applicationId
   * @returns {Promise<Array>}
   */
  async getActivitiesByApplication(applicationId) {
    return this.getAllFromIndex('activities', 'applicationId', applicationId);
  }

  /**
   * Save activity
   * @param {any} activity
   * @returns {Promise<string>}
   */
  async saveActivity(activity) {
    return this.put('activities', activity);
  }

  // ==================== UTILITY ====================

  /**
   * Check if idb is available
   * @returns {boolean}
   */
  static isAvailable() {
    return idbAvailable;
  }

  /**
   * Generate cryptographically secure UUID v4
   * @returns {string}
   */
  static generateId() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    // Set version to 4 (0100xxxx)
    arr[6] = (arr[6] & 0x0f) | 0x40;
    // Set variant to RFC 4122 (10xxxxxx)
    arr[8] = (arr[8] & 0x3f) | 0x80;
    return [...arr].map((b, i) =>
      (i === 4 || i === 6 || i === 8 || i === 10 ? '-' : '') +
      b.toString(16).padStart(2, '0')
    ).join('');
  }
}

// Create singleton instance
const idbWrapper = new IDBWrapper();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IDBWrapper, idbWrapper, DB_CONFIG };
}

// Make available globally
if (typeof window !== 'undefined') {
  window.IDBWrapper = IDBWrapper;
  window.idbWrapper = idbWrapper;
}
