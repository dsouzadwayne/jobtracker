/**
 * JobTracker Storage Module
 * Handles all chrome.storage.local operations for profile and applications data
 */

const JobTrackerStorage = {
  // Storage keys
  KEYS: {
    PROFILE: 'jobtracker_profile',
    APPLICATIONS: 'jobtracker_applications',
    SETTINGS: 'jobtracker_settings'
  },

  // Default profile structure
  getDefaultProfile() {
    return {
      personal: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: ''
        },
        linkedIn: '',
        github: '',
        portfolio: '',
        website: ''
      },
      workHistory: [],
      education: [],
      skills: {
        languages: [],
        frameworks: [],
        tools: [],
        soft: [],
        other: []
      },
      certifications: [],
      links: [],
      customQA: [],
      meta: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }
    };
  },

  // Default settings
  getDefaultSettings() {
    return {
      autofill: {
        enabled: true,
        showFloatingButton: true,
        autoDetectForms: true,
        confirmBeforeFill: false
      },
      detection: {
        autoTrackSubmissions: true,
        notifyOnDetection: true,
        enabledPlatforms: [
          'linkedin', 'indeed', 'glassdoor', 'workday',
          'greenhouse', 'lever', 'icims', 'smartrecruiters'
        ]
      },
      ui: {
        theme: 'system',
        floatingButtonPosition: 'bottom-right'
      },
      data: {
        autoBackup: false,
        backupInterval: 7
      }
    };
  },

  // Generate cryptographically secure UUID v4
  generateId() {
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
  },

  // ==================== PROFILE OPERATIONS ====================

  async getProfile() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.PROFILE);
      return result[this.KEYS.PROFILE] || this.getDefaultProfile();
    } catch (error) {
      // Log error with more context to help diagnose storage issues
      console.error('JobTracker: Error getting profile from storage:', error);
      console.error('JobTracker: Storage error details - this may indicate quota exceeded or corrupted storage');
      // Still return default profile to prevent UI crashes, but the error is now clearly logged
      return this.getDefaultProfile();
    }
  },

  async saveProfile(profile) {
    try {
      profile.meta = profile.meta || {};
      profile.meta.updatedAt = new Date().toISOString();
      await chrome.storage.local.set({ [this.KEYS.PROFILE]: profile });
      return true;
    } catch (error) {
      console.log('JobTracker: Error saving profile:', error);
      return false;
    }
  },

  async updateProfileField(path, value) {
    try {
      const profile = await this.getProfile();
      const keys = path.split('.');
      let obj = profile;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return await this.saveProfile(profile);
    } catch (error) {
      console.log('JobTracker: Error updating profile field:', error);
      return false;
    }
  },

  // Work History
  async addWorkHistory(entry) {
    const profile = await this.getProfile();
    entry.id = entry.id || this.generateId();
    profile.workHistory.push(entry);
    return await this.saveProfile(profile);
  },

  async updateWorkHistory(id, entry) {
    const profile = await this.getProfile();
    const index = profile.workHistory.findIndex(w => w.id === id);
    if (index !== -1) {
      profile.workHistory[index] = { ...profile.workHistory[index], ...entry };
      return await this.saveProfile(profile);
    }
    return false;
  },

  async removeWorkHistory(id) {
    const profile = await this.getProfile();
    profile.workHistory = profile.workHistory.filter(w => w.id !== id);
    return await this.saveProfile(profile);
  },

  // Education
  async addEducation(entry) {
    const profile = await this.getProfile();
    entry.id = entry.id || this.generateId();
    profile.education.push(entry);
    return await this.saveProfile(profile);
  },

  async updateEducation(id, entry) {
    const profile = await this.getProfile();
    const index = profile.education.findIndex(e => e.id === id);
    if (index !== -1) {
      profile.education[index] = { ...profile.education[index], ...entry };
      return await this.saveProfile(profile);
    }
    return false;
  },

  async removeEducation(id) {
    const profile = await this.getProfile();
    profile.education = profile.education.filter(e => e.id !== id);
    return await this.saveProfile(profile);
  },

  // Certifications
  async addCertification(entry) {
    const profile = await this.getProfile();
    entry.id = entry.id || this.generateId();
    profile.certifications.push(entry);
    return await this.saveProfile(profile);
  },

  async updateCertification(id, entry) {
    const profile = await this.getProfile();
    const index = profile.certifications.findIndex(c => c.id === id);
    if (index !== -1) {
      profile.certifications[index] = { ...profile.certifications[index], ...entry };
      return await this.saveProfile(profile);
    }
    return false;
  },

  async removeCertification(id) {
    const profile = await this.getProfile();
    profile.certifications = profile.certifications.filter(c => c.id !== id);
    return await this.saveProfile(profile);
  },

  // Custom Q&A
  async addCustomQA(entry) {
    const profile = await this.getProfile();
    entry.id = entry.id || this.generateId();
    profile.customQA.push(entry);
    return await this.saveProfile(profile);
  },

  async updateCustomQA(id, entry) {
    const profile = await this.getProfile();
    const index = profile.customQA.findIndex(q => q.id === id);
    if (index !== -1) {
      profile.customQA[index] = { ...profile.customQA[index], ...entry };
      return await this.saveProfile(profile);
    }
    return false;
  },

  async removeCustomQA(id) {
    const profile = await this.getProfile();
    profile.customQA = profile.customQA.filter(q => q.id !== id);
    return await this.saveProfile(profile);
  },

  // ==================== APPLICATIONS OPERATIONS ====================

  async getApplications() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.APPLICATIONS);
      return result[this.KEYS.APPLICATIONS] || [];
    } catch (error) {
      console.log('JobTracker: Error getting applications:', error);
      return [];
    }
  },

  async saveApplications(applications) {
    try {
      await chrome.storage.local.set({ [this.KEYS.APPLICATIONS]: applications });
      return true;
    } catch (error) {
      console.log('JobTracker: Error saving applications:', error);
      return false;
    }
  },

  async addApplication(application) {
    try {
      const applications = await this.getApplications();
      application.id = application.id || this.generateId();
      application.meta = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };
      application.statusHistory = application.statusHistory || [{
        status: application.status || 'applied',
        date: new Date().toISOString(),
        notes: ''
      }];
      applications.unshift(application); // Add to beginning
      return await this.saveApplications(applications) ? application : null;
    } catch (error) {
      console.log('JobTracker: Error adding application:', error);
      return null;
    }
  },

  async updateApplication(id, updates) {
    try {
      const applications = await this.getApplications();
      const index = applications.findIndex(a => a.id === id);
      if (index !== -1) {
        const oldStatus = applications[index].status;
        applications[index] = {
          ...applications[index],
          ...updates,
          meta: {
            ...applications[index].meta,
            updatedAt: new Date().toISOString()
          }
        };

        // Track status change in history
        if (updates.status && updates.status !== oldStatus) {
          applications[index].statusHistory = applications[index].statusHistory || [];
          applications[index].statusHistory.push({
            status: updates.status,
            date: new Date().toISOString(),
            notes: updates.statusNote || ''
          });
        }

        return await this.saveApplications(applications);
      }
      return false;
    } catch (error) {
      console.log('JobTracker: Error updating application:', error);
      return false;
    }
  },

  async deleteApplication(id) {
    try {
      const applications = await this.getApplications();
      const filtered = applications.filter(a => a.id !== id);
      return await this.saveApplications(filtered);
    } catch (error) {
      console.log('JobTracker: Error deleting application:', error);
      return false;
    }
  },

  async getApplicationById(id) {
    const applications = await this.getApplications();
    return applications.find(a => a.id === id) || null;
  },

  async getApplicationsByStatus(status) {
    const applications = await this.getApplications();
    return applications.filter(a => a.status === status);
  },

  async getApplicationStats() {
    const applications = await this.getApplications();
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
      // Count by status
      stats.byStatus[app.status] = (stats.byStatus[app.status] || 0) + 1;

      // Count recent applications
      const appliedDate = new Date(app.dateApplied || app.meta?.createdAt);
      if (appliedDate >= weekAgo) stats.thisWeek++;
      if (appliedDate >= monthAgo) stats.thisMonth++;
    });

    return stats;
  },

  // ==================== SETTINGS OPERATIONS ====================

  async getSettings() {
    try {
      const result = await chrome.storage.local.get(this.KEYS.SETTINGS);
      return { ...this.getDefaultSettings(), ...result[this.KEYS.SETTINGS] };
    } catch (error) {
      console.log('JobTracker: Error getting settings:', error);
      return this.getDefaultSettings();
    }
  },

  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({ [this.KEYS.SETTINGS]: settings });
      return true;
    } catch (error) {
      console.log('JobTracker: Error saving settings:', error);
      return false;
    }
  },

  async updateSetting(path, value) {
    try {
      const settings = await this.getSettings();
      const keys = path.split('.');
      let obj = settings;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return await this.saveSettings(settings);
    } catch (error) {
      console.log('JobTracker: Error updating setting:', error);
      return false;
    }
  },

  // ==================== EXPORT/IMPORT ====================

  async exportData() {
    try {
      const [profile, applications, settings] = await Promise.all([
        this.getProfile(),
        this.getApplications(),
        this.getSettings()
      ]);

      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile,
        applications,
        settings
      };
    } catch (error) {
      console.log('JobTracker: Error exporting data:', error);
      return null;
    }
  },

  // Validate imported data structure
  validateImportData(data) {
    const errors = [];

    // Check basic structure
    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format: expected an object');
      return { valid: false, errors };
    }

    if (!data.version) {
      errors.push('Missing version field');
    }

    // Validate profile if present
    if (data.profile) {
      if (typeof data.profile !== 'object') {
        errors.push('Profile must be an object');
      } else {
        // Validate personal info
        if (data.profile.personal && typeof data.profile.personal !== 'object') {
          errors.push('Profile personal info must be an object');
        }

        // Validate arrays
        ['workHistory', 'education', 'certifications', 'customQA'].forEach(key => {
          if (data.profile[key] && !Array.isArray(data.profile[key])) {
            errors.push(`Profile ${key} must be an array`);
          }
        });

        // Validate skills structure
        if (data.profile.skills && typeof data.profile.skills !== 'object') {
          errors.push('Profile skills must be an object');
        }
      }
    }

    // Validate applications if present
    if (data.applications) {
      if (!Array.isArray(data.applications)) {
        errors.push('Applications must be an array');
      } else {
        // Validate each application has required fields
        data.applications.forEach((app, i) => {
          if (!app || typeof app !== 'object') {
            errors.push(`Application at index ${i} is not a valid object`);
          } else if (!app.id) {
            errors.push(`Application at index ${i} is missing id field`);
          }
        });
      }
    }

    // Validate settings if present
    if (data.settings && typeof data.settings !== 'object') {
      errors.push('Settings must be an object');
    }

    return { valid: errors.length === 0, errors };
  },

  // Sanitize imported profile data
  sanitizeProfile(profile) {
    const sanitized = { ...this.getDefaultProfile() };

    if (profile.personal && typeof profile.personal === 'object') {
      // Only copy allowed fields
      const allowedPersonal = ['firstName', 'lastName', 'email', 'phone', 'address', 'linkedIn', 'github', 'portfolio', 'website'];
      allowedPersonal.forEach(key => {
        if (profile.personal[key] !== undefined) {
          sanitized.personal[key] = profile.personal[key];
        }
      });
    }

    // Sanitize arrays - ensure each item has an id
    ['workHistory', 'education', 'certifications', 'customQA'].forEach(key => {
      if (Array.isArray(profile[key])) {
        sanitized[key] = profile[key]
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            ...item,
            id: item.id || this.generateId()
          }));
      }
    });

    // Sanitize skills
    if (profile.skills && typeof profile.skills === 'object') {
      ['languages', 'frameworks', 'tools', 'soft', 'other'].forEach(key => {
        if (Array.isArray(profile.skills[key])) {
          sanitized.skills[key] = profile.skills[key].filter(s => typeof s === 'string');
        }
      });
    }

    return sanitized;
  },

  // Sanitize imported applications
  sanitizeApplications(applications) {
    if (!Array.isArray(applications)) return [];

    return applications
      .filter(app => app && typeof app === 'object')
      .map(app => ({
        id: app.id || this.generateId(),
        company: String(app.company || ''),
        position: String(app.position || ''),
        status: app.status || 'applied',
        dateApplied: app.dateApplied || new Date().toISOString(),
        location: app.location || '',
        jobUrl: app.jobUrl || '',
        platform: app.platform || 'other',
        salary: app.salary || '',
        notes: app.notes || '',
        statusHistory: Array.isArray(app.statusHistory) ? app.statusHistory : [],
        meta: app.meta || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      }));
  },

  async importData(data, options = { merge: false }) {
    try {
      // Validate import data structure
      const validation = this.validateImportData(data);
      if (!validation.valid) {
        console.log('JobTracker: Import validation errors:', validation.errors);
        throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
      }

      // Sanitize data before importing
      const sanitizedProfile = data.profile ? this.sanitizeProfile(data.profile) : null;
      const sanitizedApplications = data.applications ? this.sanitizeApplications(data.applications) : null;

      if (options.merge) {
        // Merge with existing data
        const existingProfile = await this.getProfile();
        const existingApps = await this.getApplications();

        if (sanitizedProfile) {
          // Merge arrays, don't duplicate
          ['workHistory', 'education', 'certifications', 'customQA'].forEach(key => {
            if (sanitizedProfile[key]) {
              const existingIds = new Set((existingProfile[key] || []).map(item => item.id));
              sanitizedProfile[key].forEach(item => {
                if (!existingIds.has(item.id)) {
                  existingProfile[key] = existingProfile[key] || [];
                  existingProfile[key].push(item);
                }
              });
            }
          });
          await this.saveProfile({ ...existingProfile, ...sanitizedProfile });
        }

        if (sanitizedApplications) {
          const existingIds = new Set(existingApps.map(a => a.id));
          const newApps = sanitizedApplications.filter(a => !existingIds.has(a.id));
          await this.saveApplications([...existingApps, ...newApps]);
        }
      } else {
        // Replace all data
        if (sanitizedProfile) await this.saveProfile(sanitizedProfile);
        if (sanitizedApplications) await this.saveApplications(sanitizedApplications);
        if (data.settings) await this.saveSettings(data.settings);
      }

      return true;
    } catch (error) {
      console.log('JobTracker: Error importing data:', error);
      return false;
    }
  },

  // ==================== CLEAR DATA ====================

  async clearAllData() {
    try {
      await chrome.storage.local.remove([
        this.KEYS.PROFILE,
        this.KEYS.APPLICATIONS,
        this.KEYS.SETTINGS
      ]);
      return true;
    } catch (error) {
      console.log('JobTracker: Error clearing data:', error);
      return false;
    }
  }
};

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.JobTrackerStorage = JobTrackerStorage;
}
