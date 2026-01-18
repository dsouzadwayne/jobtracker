# Implementation Plan: Replace Git LFS Models with Hugging Face Downloads

## Overview

Replace locally bundled ONNX models (stored as Git LFS files) with on-demand downloads from Hugging Face Hub. Models will be downloaded on first use and cached in IndexedDB via Transformers.js's built-in caching system. This eliminates the 132MB Git LFS storage and reduces extension install size from ~135MB to ~5MB.

## Key Insight

**Transformers.js already supports this!** The library has built-in Hugging Face Hub download and IndexedDB caching. We just need to:
1. Change configuration from `allowRemoteModels: false` to `allowRemoteModels: true`
2. Update model paths from local to Xenova/* namespace
3. Add UI for download progress tracking
4. Remove Git LFS files

## Models to Download

1. **Xenova/all-MiniLM-L6-v2** (~23MB quantized)
   - Purpose: Semantic embeddings for resume-job matching
   - Current: Bundled at `lib/models/all-MiniLM-L6-v2/`

2. **Xenova/bert-base-NER** (~109MB quantized)
   - Purpose: Named entity recognition (companies, people, locations)
   - Current: Bundled at `lib/models/bert-base-NER/`

## Implementation Steps

### 1. Update AI Worker Configuration

**File:** `jobtracker/lib/ai-worker.js`

**Changes:**

```javascript
// Line 20-25: Update model paths to use Hugging Face
const MODELS = {
  embeddings: 'Xenova/all-MiniLM-L6-v2',  // Download from HF Hub
  ner: 'Xenova/bert-base-NER'              // Download from HF Hub
};

// Line 42-45: Enable remote model downloads
env.allowLocalModels = false;      // Disable local bundled models
env.allowRemoteModels = true;      // Enable HF Hub downloads ✓
env.useBrowserCache = true;        // Cache in IndexedDB (already enabled)
// Remove: env.localModelPath (not needed)
```

**Enhanced Progress Tracking (lines 78-88, 114-124):**

```javascript
progress_callback: (progress) => {
  if (progress.status === 'progress') {
    self.postMessage({
      type: 'MODEL_LOADING_PROGRESS',
      payload: {
        model: 'embeddings',  // or 'ner'
        status: 'downloading',
        progress: Math.round(progress.progress),
        loaded: progress.loaded,    // Bytes downloaded
        total: progress.total,      // Total bytes
        file: progress.file         // Current file name
      }
    });
  } else if (progress.status === 'done') {
    self.postMessage({
      type: 'MODEL_LOADING_COMPLETE',
      payload: {
        model: 'embeddings',
        cached: true
      }
    });
  }
}
```

### 2. Add Download Indicator UI

**Create Multiple UI Components:**

#### A. Toast Notification (Simple Progress)

**File:** `jobtracker/pages/dashboard/ai-features.js` (or new shared component)

```javascript
// Show toast when model download starts
function showModelDownloadToast(modelName, size) {
  const toast = document.createElement('div');
  toast.className = 'model-download-toast';
  toast.id = `model-toast-${modelName}`;
  toast.innerHTML = `
    <div class="toast-header">
      <span class="icon">⬇️</span>
      <span class="title">Downloading ${modelName === 'embeddings' ? 'Embeddings' : 'NER'} Model</span>
      <span class="size">${size}MB</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
    <div class="toast-details">
      <span class="progress-text">0%</span>
      <span class="status-text">Preparing download...</span>
    </div>
  `;
  document.body.appendChild(toast);
}

// Update progress
function updateModelDownloadProgress(modelName, progress, loaded, total) {
  const toast = document.getElementById(`model-toast-${modelName}`);
  if (!toast) return;

  const progressFill = toast.querySelector('.progress-fill');
  const progressText = toast.querySelector('.progress-text');
  const statusText = toast.querySelector('.status-text');

  progressFill.style.width = `${progress}%`;
  progressText.textContent = `${progress}%`;

  const loadedMB = (loaded / 1024 / 1024).toFixed(1);
  const totalMB = (total / 1024 / 1024).toFixed(1);
  statusText.textContent = `${loadedMB} MB / ${totalMB} MB`;
}

// Complete download
function completeModelDownload(modelName) {
  const toast = document.getElementById(`model-toast-${modelName}`);
  if (!toast) return;

  toast.querySelector('.icon').textContent = '✅';
  toast.querySelector('.title').textContent = 'Model Downloaded';
  toast.querySelector('.status-text').textContent = 'Cached for offline use';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

**CSS Styles (add to `common.css` or component CSS):**

```css
.model-download-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 320px;
  z-index: 10000;
  animation: slideIn 0.3s ease-out;
}

.model-download-toast.fade-out {
  animation: fadeOut 0.3s ease-out;
  opacity: 0;
}

.toast-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.toast-header .icon {
  font-size: 20px;
}

.toast-header .title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
}

.toast-header .size {
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
  border-radius: 3px;
}

.toast-details {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
}

.progress-text {
  font-weight: 600;
  color: #4CAF50;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
    transform: translateY(10px);
  }
}
```

#### B. Settings Page Model Status

**File:** `jobtracker/pages/dashboard.html` (or settings page)

```html
<section class="ai-models-section">
  <h2>AI Models</h2>
  <p class="section-description">
    Models are downloaded from Hugging Face on first use and cached locally for offline access.
  </p>

  <div class="models-list">
    <!-- Embeddings Model -->
    <div class="model-card" id="model-card-embeddings">
      <div class="model-info">
        <div class="model-icon">🧠</div>
        <div class="model-details">
          <h3>Embeddings Model</h3>
          <p class="model-name">Xenova/all-MiniLM-L6-v2</p>
          <p class="model-purpose">Semantic matching for resume-job analysis</p>
        </div>
      </div>
      <div class="model-status" data-model="embeddings">
        <span class="status-badge not-downloaded">Not Downloaded</span>
        <span class="model-size">23 MB</span>
        <button class="download-btn" onclick="downloadModel('embeddings')">
          Download
        </button>
      </div>
    </div>

    <!-- NER Model -->
    <div class="model-card" id="model-card-ner">
      <div class="model-info">
        <div class="model-icon">🏷️</div>
        <div class="model-details">
          <h3>NER Model</h3>
          <p class="model-name">Xenova/bert-base-NER</p>
          <p class="model-purpose">Extract companies, people, and locations</p>
        </div>
      </div>
      <div class="model-status" data-model="ner">
        <span class="status-badge not-downloaded">Not Downloaded</span>
        <span class="model-size">109 MB</span>
        <button class="download-btn" onclick="downloadModel('ner')">
          Download
        </button>
      </div>
    </div>
  </div>

  <div class="models-actions">
    <button class="btn-primary" onclick="preloadAllModels()">
      Download All Models (132 MB)
    </button>
    <button class="btn-secondary" onclick="clearModelCache()">
      Clear Cache
    </button>
  </div>

  <div class="cache-info">
    <span id="cache-size-display">Cache size: Calculating...</span>
  </div>
</section>
```

**Status Badge States (CSS):**

```css
.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.not-downloaded {
  background: #f0f0f0;
  color: #666;
}

.status-badge.downloading {
  background: #fff3cd;
  color: #856404;
  animation: pulse 1.5s infinite;
}

.status-badge.downloaded {
  background: #d4edda;
  color: #155724;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

#### C. First-Time Download Modal

**Modal HTML (shown on first AI feature use):**

```html
<div class="modal" id="first-download-modal">
  <div class="modal-content">
    <h2>AI Models Required</h2>
    <p>
      JobTracker uses AI models to enhance resume parsing and job matching.
      These models will be downloaded once and cached for offline use.
    </p>

    <div class="download-info">
      <div class="info-item">
        <span class="label">Download Size:</span>
        <span class="value">132 MB</span>
      </div>
      <div class="info-item">
        <span class="label">Storage:</span>
        <span class="value">Cached in browser</span>
      </div>
      <div class="info-item">
        <span class="label">Privacy:</span>
        <span class="value">100% local processing</span>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-primary" onclick="startDownload()">
        Download Now
      </button>
      <button class="btn-secondary" onclick="downloadLater()">
        Download Later
      </button>
      <button class="btn-text" onclick="disableAI()">
        Disable AI Features
      </button>
    </div>
  </div>
</div>
```

### 3. Wire Up Progress Events

**File:** `jobtracker/lib/ai-service.js`

**Add progress callback setter:**

```javascript
// Add method to set progress callback
setProgressCallback(callback) {
  this.onModelLoadProgress = callback;
}

// In handleMessage (already exists at line 73-78):
if (type === 'MODEL_LOADING_PROGRESS') {
  if (this.onModelLoadProgress) {
    this.onModelLoadProgress(payload);
  }
  // Also dispatch custom event for global listeners
  window.dispatchEvent(new CustomEvent('model-download-progress', {
    detail: payload
  }));
  return;
}

if (type === 'MODEL_LOADING_COMPLETE') {
  window.dispatchEvent(new CustomEvent('model-download-complete', {
    detail: payload
  }));
  return;
}
```

**Global listener setup (in dashboard.js or common script):**

```javascript
// Listen for model download events
window.addEventListener('model-download-progress', (event) => {
  const { model, progress, loaded, total } = event.detail;

  // Update toast
  updateModelDownloadProgress(model, progress, loaded, total);

  // Update settings page if visible
  updateSettingsModelStatus(model, 'downloading', progress);
});

window.addEventListener('model-download-complete', (event) => {
  const { model } = event.detail;

  // Complete toast
  completeModelDownload(model);

  // Update settings page
  updateSettingsModelStatus(model, 'downloaded', 100);
});
```

### 4. Database Schema for Model Metadata

**File:** `jobtracker/lib/database.js`

**Update version and add models_metadata store:**

```javascript
// Line 8: Increment version
DB_VERSION: 3,

// Line 12-19: Add MODELS_METADATA to STORES
STORES: {
  APPLICATIONS: 'applications',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  META: 'meta',
  INTERVIEWS: 'interviews',
  TASKS: 'tasks',
  ACTIVITIES: 'activities',
  MODELS_METADATA: 'models_metadata'  // NEW
},

// In onupgradeneeded handler (after line 100):
// Models metadata store (for tracking downloads)
if (!db.objectStoreNames.contains(this.STORES.MODELS_METADATA)) {
  const modelsStore = db.createObjectStore(this.STORES.MODELS_METADATA, { keyPath: 'modelId' });
  modelsStore.createIndex('downloadStatus', 'downloadStatus', { unique: false });
  modelsStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
}
```

**Add helper methods:**

```javascript
// Get model metadata
async getModelMetadata(modelId) {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readonly');
    const store = transaction.objectStore(this.STORES.MODELS_METADATA);
    const request = store.get(modelId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
},

// Set model metadata
async setModelMetadata(modelId, metadata) {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readwrite');
    const store = transaction.objectStore(this.STORES.MODELS_METADATA);
    const data = { modelId, ...metadata };
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
},

// Get all models status
async getModelsDownloadStatus() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readonly');
    const store = transaction.objectStore(this.STORES.MODELS_METADATA);
    const request = store.getAll();

    request.onsuccess = () => {
      const models = request.result || [];
      const status = {
        embeddings: models.find(m => m.modelId === 'embeddings') || { downloadStatus: 'not_started' },
        ner: models.find(m => m.modelId === 'ner') || { downloadStatus: 'not_started' }
      };
      resolve(status);
    };
    request.onerror = () => reject(request.error);
  });
}
```

### 5. Update Manifest

**File:** `jobtracker/manifest.json`

**Add unlimitedStorage permission (line 9):**

```json
"permissions": [
  "storage",
  "activeTab",
  "scripting",
  "alarms",
  "unlimitedStorage"
],
```

**Remove models from web_accessible_resources (lines 178-179):**

```json
"web_accessible_resources": [
  {
    "resources": [
      "lib/*.js",
      "lib/vendor/*",
      // REMOVE: "lib/models/*",
      // REMOVE: "lib/models/**/*",
      "lib/resume-parser/*",
      // ... rest
    ],
    "matches": ["<all_urls>"]
  }
]
```

### 6. Remove Git LFS Files

**Delete these directories:**
- `jobtracker/lib/models/all-MiniLM-L6-v2/`
- `jobtracker/lib/models/bert-base-NER/`
- `.gitattributes` (if only used for ONNX files)

**Git commands:**

```bash
git lfs untrack "*.onnx"
git rm -r jobtracker/lib/models/all-MiniLM-L6-v2
git rm -r jobtracker/lib/models/bert-base-NER
git rm .gitattributes  # Or edit if used for other files
git commit -m "Remove Git LFS models, switch to Hugging Face downloads

Models now download from HF Hub on first use and cache in IndexedDB.
Reduces extension size from ~135MB to ~5MB."
```

### 7. Data Management Settings

**Add settings UI for clearing different types of data.**

**File:** `jobtracker/pages/dashboard.html` (Settings section)

**Add Data Management Section:**

```html
<section class="data-management-section">
  <h2>Data Management</h2>
  <p class="section-description">
    Manage your stored data. All data is stored locally in your browser.
  </p>

  <div class="data-actions">
    <!-- Clear AI Models -->
    <div class="data-item">
      <div class="data-info">
        <h3>AI Models Cache</h3>
        <p>Downloaded AI models (embeddings and NER)</p>
        <span class="data-size" id="models-cache-size">Calculating...</span>
      </div>
      <button class="btn-danger" onclick="clearAIModels()">
        Clear AI Models
      </button>
    </div>

    <!-- Clear Profile -->
    <div class="data-item">
      <div class="data-info">
        <h3>Profile Information</h3>
        <p>Your resume, contact info, skills, and experience</p>
        <span class="data-size" id="profile-size">~50 KB</span>
      </div>
      <button class="btn-danger" onclick="clearProfile()">
        Clear Profile
      </button>
    </div>

    <!-- Clear Applications -->
    <div class="data-item">
      <div class="data-info">
        <h3>Job Applications</h3>
        <p>All tracked applications, interviews, tasks, and activities</p>
        <span class="data-size" id="applications-size">Calculating...</span>
      </div>
      <button class="btn-danger" onclick="clearApplications()">
        Clear Applications
      </button>
    </div>

    <!-- Clear All Data -->
    <div class="data-item danger-zone">
      <div class="data-info">
        <h3>⚠️ Clear All Data</h3>
        <p>Delete everything: models, profile, applications, and settings</p>
      </div>
      <button class="btn-danger-critical" onclick="clearAllData()">
        Clear All Data
      </button>
    </div>
  </div>

  <div class="total-storage">
    <span>Total Storage Used:</span>
    <span id="total-storage-size">Calculating...</span>
  </div>
</section>
```

**Styles (add to CSS):**

```css
.data-management-section {
  margin-top: 32px;
  padding: 24px;
  background: #f9f9f9;
  border-radius: 8px;
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 20px 0;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.data-item.danger-zone {
  border-color: #dc3545;
  background: #fff5f5;
}

.data-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.data-info p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
}

.data-size {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.btn-danger {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-danger-critical {
  padding: 10px 20px;
  background: #b21f2d;
  color: white;
  border: 2px solid #dc3545;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
}

.btn-danger-critical:hover {
  background: #9a1b27;
  transform: scale(1.02);
}

.total-storage {
  margin-top: 20px;
  padding: 12px;
  background: white;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}
```

**JavaScript Implementation:**

**File:** `jobtracker/pages/dashboard/settings.js` (or create new file)

```javascript
// Clear AI Models Cache
async function clearAIModels() {
  if (!confirm('Clear AI models cache? You will need to re-download models (132 MB) to use AI features.')) {
    return;
  }

  try {
    // Clear Transformers.js IndexedDB cache
    const dbName = 'transformers-cache'; // Transformers.js cache DB name
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Clear metadata
    await chrome.runtime.sendMessage({
      type: 'CLEAR_MODELS_METADATA'
    });

    showSuccessToast('AI models cache cleared successfully');
    updateStorageSizes();
  } catch (error) {
    console.error('Failed to clear AI models:', error);
    showErrorToast('Failed to clear AI models: ' + error.message);
  }
}

// Clear Profile Information
async function clearProfile() {
  if (!confirm('Clear your profile information? This will delete your resume, contact info, skills, and experience. This action cannot be undone.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_PROFILE'
    });

    if (response.success) {
      showSuccessToast('Profile information cleared successfully');
      updateStorageSizes();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      throw new Error(response.error || 'Failed to clear profile');
    }
  } catch (error) {
    console.error('Failed to clear profile:', error);
    showErrorToast('Failed to clear profile: ' + error.message);
  }
}

// Clear Applications
async function clearApplications() {
  const count = await getApplicationsCount();

  if (!confirm(`Clear all ${count} job applications? This will also delete related interviews, tasks, and activities. This action cannot be undone.`)) {
    return;
  }

  // Double confirmation for destructive action
  if (!confirm('Are you absolutely sure? This will permanently delete all your tracked applications.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_APPLICATIONS'
    });

    if (response.success) {
      showSuccessToast('All applications cleared successfully');
      updateStorageSizes();

      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      throw new Error(response.error || 'Failed to clear applications');
    }
  } catch (error) {
    console.error('Failed to clear applications:', error);
    showErrorToast('Failed to clear applications: ' + error.message);
  }
}

// Clear All Data (nuclear option)
async function clearAllData() {
  if (!confirm('⚠️ CLEAR ALL DATA? This will delete EVERYTHING: AI models, profile, applications, settings. This action CANNOT be undone.')) {
    return;
  }

  // Double confirmation
  const confirmation = prompt('Type "DELETE ALL" to confirm (case-sensitive):');
  if (confirmation !== 'DELETE ALL') {
    showErrorToast('Confirmation failed. No data was deleted.');
    return;
  }

  try {
    // Clear AI models
    await indexedDB.deleteDatabase('transformers-cache');

    // Clear JobTracker database
    await indexedDB.deleteDatabase('JobTrackerDB');

    // Clear chrome.storage
    await chrome.storage.local.clear();

    showSuccessToast('All data cleared. Extension will reload.');

    // Reload extension
    setTimeout(() => {
      chrome.runtime.reload();
    }, 2000);
  } catch (error) {
    console.error('Failed to clear all data:', error);
    showErrorToast('Failed to clear all data: ' + error.message);
  }
}

// Calculate and display storage sizes
async function updateStorageSizes() {
  try {
    // Get AI models cache size
    const modelsSize = await estimateDBSize('transformers-cache');
    document.getElementById('models-cache-size').textContent = formatBytes(modelsSize);

    // Get applications size
    const appResponse = await chrome.runtime.sendMessage({
      type: 'GET_APPLICATIONS_SIZE'
    });
    document.getElementById('applications-size').textContent = formatBytes(appResponse.size);

    // Get profile size
    const profileResponse = await chrome.runtime.sendMessage({
      type: 'GET_PROFILE_SIZE'
    });
    document.getElementById('profile-size').textContent = formatBytes(profileResponse.size);

    // Total storage
    const total = modelsSize + appResponse.size + profileResponse.size;
    document.getElementById('total-storage-size').textContent = formatBytes(total);
  } catch (error) {
    console.error('Failed to calculate storage sizes:', error);
  }
}

// Estimate IndexedDB database size
async function estimateDBSize(dbName) {
  try {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);

      request.onsuccess = async () => {
        const db = request.result;
        let totalSize = 0;

        const storeNames = Array.from(db.objectStoreNames);
        const transaction = db.transaction(storeNames, 'readonly');

        for (const storeName of storeNames) {
          const store = transaction.objectStore(storeName);
          const allRecords = await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });

          // Rough size estimation (JSON stringify)
          totalSize += JSON.stringify(allRecords).length;
        }

        db.close();
        resolve(totalSize);
      };

      request.onerror = () => resolve(0); // DB doesn't exist
    });
  } catch (error) {
    return 0;
  }
}

// Format bytes to human-readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Get applications count
async function getApplicationsCount() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_APPLICATIONS_COUNT'
    });
    return response.count || 0;
  } catch (error) {
    return 0;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateStorageSizes();

  // Update every 30 seconds
  setInterval(updateStorageSizes, 30000);
});

// Toast notifications
function showSuccessToast(message) {
  // Use existing toast system or create simple alert
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = '✓ ' + message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.textContent = '✗ ' + message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
```

**Background Message Handlers:**

**File:** `jobtracker/background.js`

```javascript
// Add these message type handlers

case MessageTypes.CLEAR_MODELS_METADATA:
  try {
    await JobTrackerDB.clearModelsMetadata();
    response = { success: true };
  } catch (error) {
    response = { success: false, error: error.message };
  }
  break;

case MessageTypes.CLEAR_PROFILE:
  try {
    await JobTrackerDB.deleteProfile();
    response = { success: true };
  } catch (error) {
    response = { success: false, error: error.message };
  }
  break;

case MessageTypes.CLEAR_APPLICATIONS:
  try {
    await JobTrackerDB.clearAllApplications();
    await JobTrackerDB.clearAllInterviews();
    await JobTrackerDB.clearAllTasks();
    await JobTrackerDB.clearAllActivities();
    response = { success: true };
  } catch (error) {
    response = { success: false, error: error.message };
  }
  break;

case MessageTypes.GET_APPLICATIONS_SIZE:
  try {
    const apps = await JobTrackerDB.getAllApplications();
    const size = JSON.stringify(apps).length;
    response = { size };
  } catch (error) {
    response = { size: 0 };
  }
  break;

case MessageTypes.GET_PROFILE_SIZE:
  try {
    const profile = await JobTrackerDB.getProfile();
    const size = JSON.stringify(profile).length;
    response = { size };
  } catch (error) {
    response = { size: 0 };
  }
  break;

case MessageTypes.GET_APPLICATIONS_COUNT:
  try {
    const apps = await JobTrackerDB.getAllApplications();
    response = { count: apps.length };
  } catch (error) {
    response = { count: 0 };
  }
  break;
```

**Database Helper Methods:**

**File:** `jobtracker/lib/database.js`

```javascript
// Add these helper methods to JobTrackerDB

// Clear all models metadata
async clearModelsMetadata() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.MODELS_METADATA], 'readwrite');
    const store = transaction.objectStore(this.STORES.MODELS_METADATA);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('JobTracker: Models metadata cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
},

// Delete profile
async deleteProfile() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.PROFILE], 'readwrite');
    const store = transaction.objectStore(this.STORES.PROFILE);
    const request = store.delete('main');

    request.onsuccess = () => {
      console.log('JobTracker: Profile deleted');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
},

// Clear all applications
async clearAllApplications() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.APPLICATIONS], 'readwrite');
    const store = transaction.objectStore(this.STORES.APPLICATIONS);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('JobTracker: All applications cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
},

// Clear all interviews
async clearAllInterviews() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.INTERVIEWS], 'readwrite');
    const store = transaction.objectStore(this.STORES.INTERVIEWS);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('JobTracker: All interviews cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
},

// Clear all tasks
async clearAllTasks() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.TASKS], 'readwrite');
    const store = transaction.objectStore(this.STORES.TASKS);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('JobTracker: All tasks cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
},

// Clear all activities
async clearAllActivities() {
  await this.init();
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction([this.STORES.ACTIVITIES], 'readwrite');
    const store = transaction.objectStore(this.STORES.ACTIVITIES);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('JobTracker: All activities cleared');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
```

### 8. Error Handling

**Add retry logic and user-friendly errors:**

```javascript
// In ai-worker.js, wrap model loading:
async function loadEmbeddingsModel() {
  if (featureExtractor) return featureExtractor;

  const available = await loadTransformers();
  if (!available) {
    throw new Error('Transformers.js not available');
  }

  let lastError;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check network
      if (!navigator.onLine) {
        throw new Error('No internet connection. AI models require initial download.');
      }

      console.log(`[AI Worker] Loading embeddings model (attempt ${attempt}/${maxRetries})...`);

      featureExtractor = await pipeline('feature-extraction', MODELS.embeddings, {
        quantized: true,
        progress_callback: (progress) => { /* ... */ }
      });

      // Success - save metadata
      await saveModelMetadata('embeddings', 'completed');

      return featureExtractor;

    } catch (error) {
      lastError = error;
      console.error(`[AI Worker] Load attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  await saveModelMetadata('embeddings', 'failed', lastError.message);
  throw new Error(`Failed to download AI model after ${maxRetries} attempts: ${lastError.message}`);
}

async function saveModelMetadata(modelId, status, error = null) {
  self.postMessage({
    type: 'UPDATE_MODEL_METADATA',
    payload: {
      modelId,
      downloadStatus: status,
      downloadedAt: status === 'completed' ? new Date().toISOString() : null,
      lastError: error
    }
  });
}
```

## Critical Files to Modify

| File | Purpose | Changes |
|------|---------|---------|
| `jobtracker/lib/ai-worker.js` | Model loading | Update model paths, enable remote downloads, enhance progress |
| `jobtracker/lib/ai-service.js` | Main thread API | Add progress event dispatching |
| `jobtracker/lib/database.js` | IndexedDB schema | Add models_metadata store, clear methods for all data types |
| `jobtracker/manifest.json` | Extension config | Add unlimitedStorage, remove models from web_accessible_resources |
| `jobtracker/pages/dashboard/ai-features.js` | UI components | Add download indicator UI, progress handlers |
| `jobtracker/pages/dashboard/settings.js` | Data management | Clear functions, storage size calculations |
| `jobtracker/background.js` | Message handlers | Add handlers for clearing data and getting sizes |
| `jobtracker/common.css` | Styles | Add toast, progress bar, and data management styles |
| `jobtracker/pages/dashboard.html` | Settings UI | Add model status cards and data management section |

## Download Indicator Features Summary

The implementation includes **three levels of download indicators**:

1. **Toast Notification** (Bottom-right corner)
   - Shows when download starts
   - Live progress bar with percentage
   - Shows downloaded MB / total MB
   - Auto-hides when complete
   - Persists across page navigation

2. **Settings Page Status Cards**
   - Always-visible model status
   - Download buttons for individual models
   - "Download All" option
   - Cache size display
   - Status badges (Not Downloaded, Downloading, Downloaded, Failed)

3. **First-Time Modal**
   - Appears on first AI feature use
   - Explains what models are and why needed
   - One-click download or defer option
   - Privacy reassurance (local processing)

## Verification Steps

After implementation, verify:

1. **Clean Install Test**
   - Install extension in fresh Chrome profile
   - Extension size should be < 5MB (vs 135+ MB before)
   - Open DevTools > Application > IndexedDB
   - Trigger AI feature (parse resume)
   - Should see download toast appear
   - Network tab should show HF Hub requests
   - Models should cache in IndexedDB
   - Second use should be instant (no network)

2. **Offline Test**
   - After models cached, go offline
   - AI features should still work
   - No network errors

3. **Progress Accuracy**
   - Download progress should update smoothly 0-100%
   - MB counts should match model sizes (23MB, 109MB)
   - Status badges should update correctly

4. **Error Handling**
   - Disconnect network mid-download
   - Should show retry attempts
   - Should fall back to regex-only mode gracefully

## Benefits

- **132MB smaller extension** (from ~135MB to ~5MB)
- **No Git LFS complexity** (simpler repo management)
- **Faster installation** (models download on-demand)
- **Clear user feedback** (download indicators show progress)
- **Offline after first use** (models cached in IndexedDB)
- **Automatic updates** (can fetch new model versions from HF)
- **Privacy maintained** (all processing still local after download)

## Edge Cases Handled

- Network failures during download (retry with exponential backoff)
- Offline usage after models cached (works seamlessly)
- Partial downloads (Transformers.js handles resumption)
- Storage quota issues (graceful degradation to regex-only mode)
- Model corruption (auto-detect and re-download)
- First-time user experience (helpful modal with clear CTAs)
