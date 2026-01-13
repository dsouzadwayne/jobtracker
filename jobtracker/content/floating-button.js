/**
 * JobTracker Floating Button
 * Shows autofill button when job application form is detected
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerFloatingButtonInitialized) return;
  window.__jobTrackerFloatingButtonInitialized = true;

  // State
  let floatingButton = null;
  let quickAddModal = null;
  let isFormDetected = false;
  let hasApplied = false;
  let settings = null;

  // Form detection indicators
  const JOB_FORM_INDICATORS = {
    urlPatterns: [
      /\/apply/i,
      /\/jobs?\//i,
      /\/career/i,
      /\/application/i,
      /\/hiring/i,
      /greenhouse\.io/,
      /lever\.(co|com)/,
      /workday\.com/,
      /myworkdayjobs\.com/,
      /icims\.com/,
      /smartrecruiters\.com/,
      /naukri\.com\/job-listings/i,
      /naukri\.com\/job\//i
    ],
    formPatterns: [
      /apply/i,
      /application/i,
      /job-form/i,
      /candidate/i,
      /resume/i,
      /career/i
    ],
    fieldPatterns: [
      'first_name', 'last_name', 'email', 'phone', 'resume', 'cv',
      'linkedin', 'github', 'cover_letter', 'portfolio'
    ]
  };

  // Initialize
  async function init() {
    try {
      // Get settings
      settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

      if (!settings?.autofill?.showFloatingButton) {
        return;
      }

      // Check if on a job application page
      if (shouldShowButton()) {
        createFloatingButton();
        isFormDetected = true;
      }

      // Watch for dynamic form changes
      observeFormChanges();

    } catch (error) {
      console.log('JobTracker: Error initializing floating button:', error);
    }
  }

  // Check if button should be shown
  function shouldShowButton() {
    const url = window.location.href;

    // Check URL patterns
    const urlMatch = JOB_FORM_INDICATORS.urlPatterns.some(p => p.test(url));
    if (urlMatch) return true;

    // Check for job application forms
    return detectJobForm();
  }

  // Detect job application form on page
  function detectJobForm() {
    const forms = document.querySelectorAll('form');

    for (const form of forms) {
      let score = 0;

      // Check form attributes
      const formAttrs = [
        form.id,
        form.name,
        form.className,
        form.getAttribute('action') || ''
      ].join(' ').toLowerCase();

      if (JOB_FORM_INDICATORS.formPatterns.some(p => p.test(formAttrs))) {
        score += 2;
      }

      // Check for application-related fields
      const inputs = form.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        const inputAttrs = [
          input.name,
          input.id,
          input.placeholder,
          input.getAttribute('aria-label') || ''
        ].join(' ').toLowerCase();

        if (JOB_FORM_INDICATORS.fieldPatterns.some(p => inputAttrs.includes(p))) {
          score++;
        }
      }

      // Check for resume/file upload
      const fileInputs = form.querySelectorAll('input[type="file"]');
      if (fileInputs.length > 0) {
        score += 2;
      }

      if (score >= 3) {
        return true;
      }
    }

    return false;
  }

  // Create floating button
  function createFloatingButton() {
    if (floatingButton) return;

    floatingButton = document.createElement('div');
    floatingButton.id = 'jobtracker-floating-btn';
    floatingButton.className = 'jobtracker-floating-btn';
    floatingButton.innerHTML = `
      <div class="jobtracker-btn-group">
        <button class="jobtracker-btn-applied" title="Track this job">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Track</span>
        </button>
        <button class="jobtracker-btn-main" title="Autofill Form">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="jobtracker-btn-menu-toggle" title="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
      </div>
      <div class="jobtracker-btn-menu hidden">
        <button class="jobtracker-menu-item" data-action="autofill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Autofill Form
        </button>
        <button class="jobtracker-menu-item" data-action="save">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          Save for Later
        </button>
        <button class="jobtracker-menu-item" data-action="hide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Hide Button
        </button>
      </div>
    `;

    document.body.appendChild(floatingButton);

    // Event listeners
    const appliedBtn = floatingButton.querySelector('.jobtracker-btn-applied');
    const mainBtn = floatingButton.querySelector('.jobtracker-btn-main');
    const menuToggle = floatingButton.querySelector('.jobtracker-btn-menu-toggle');
    const menu = floatingButton.querySelector('.jobtracker-btn-menu');

    // Click "I Applied" button
    appliedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleIApplied();
    });

    // Click autofill button
    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerAutofill();
    });

    // Click menu toggle
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });

    // Menu item clicks
    floatingButton.querySelectorAll('.jobtracker-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        handleMenuAction(action);
        menu.classList.add('hidden');
      });
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', () => {
      menu.classList.add('hidden');
    });

    // Make draggable
    makeDraggable(floatingButton);
  }

  // Handle menu actions
  function handleMenuAction(action) {
    switch (action) {
      case 'autofill':
        triggerAutofill();
        break;
      case 'save':
        trackCurrentApplication('saved');
        break;
      case 'hide':
        hideButton();
        break;
    }
  }

  // Handle "I Applied" button click
  async function handleIApplied() {
    if (hasApplied) return;

    const jobInfo = extractJobInfo();

    // If extraction failed, show quick add modal
    if (!jobInfo.company && !jobInfo.position) {
      const result = await showQuickAddModal(jobInfo);
      if (!result) return; // User cancelled
      Object.assign(jobInfo, result);
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_APPLICATION',
        payload: {
          ...jobInfo,
          status: 'applied',
          dateApplied: new Date().toISOString(),
          source: 'manual-button'
        }
      });

      // Check for duplicate
      if (response?.duplicate) {
        if (window.JobTrackerContent) {
          window.JobTrackerContent.showNotification(
            `Already tracked: ${response.existing?.position || 'This job'} at ${response.existing?.company || 'this company'}`,
            'warning'
          );
        }
        // Still update button to show it's tracked
        setAppliedState();
        return;
      }

      // Update button to show applied state
      setAppliedState();

      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Application tracked!', 'success');
      }
    } catch (error) {
      console.log('JobTracker: Error tracking application:', error);
      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Failed to save application', 'error');
      }
    }
  }

  // Set button to tracked state
  function setAppliedState() {
    hasApplied = true;
    const appliedBtn = floatingButton?.querySelector('.jobtracker-btn-applied');
    if (appliedBtn) {
      appliedBtn.classList.add('applied');
      appliedBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Tracked</span>
      `;
    }
  }

  // Show quick add modal for manual entry
  function showQuickAddModal(prefill = {}) {
    return new Promise((resolve) => {
      // Remove existing modal if any
      if (quickAddModal) {
        quickAddModal.remove();
      }

      quickAddModal = document.createElement('div');
      quickAddModal.className = 'jobtracker-quick-add-overlay';
      quickAddModal.innerHTML = `
        <div class="jobtracker-quick-add-modal">
          <div class="jobtracker-quick-add-header">
            <h3>Track Application</h3>
            <button class="jobtracker-quick-add-close">&times;</button>
          </div>
          <div class="jobtracker-quick-add-body">
            <div class="jobtracker-quick-add-field">
              <label for="jt-company">Company</label>
              <input type="text" id="jt-company" placeholder="e.g., Google" value="${escapeHtml(prefill.company || '')}">
            </div>
            <div class="jobtracker-quick-add-field">
              <label for="jt-position">Position</label>
              <input type="text" id="jt-position" placeholder="e.g., Software Engineer" value="${escapeHtml(prefill.position || '')}">
            </div>
            <div class="jobtracker-quick-add-field">
              <label for="jt-description">
                Job Description
                <span class="jobtracker-optional-label">(optional)</span>
              </label>
              <textarea id="jt-description" placeholder="Paste or auto-extracted job description..." rows="4">${escapeHtml(prefill.jobDescription || '')}</textarea>
            </div>
          </div>
          <div class="jobtracker-quick-add-footer">
            <button class="jobtracker-quick-add-cancel">Cancel</button>
            <button class="jobtracker-quick-add-save">Save Application</button>
          </div>
        </div>
      `;

      document.body.appendChild(quickAddModal);

      // Focus first empty field
      const companyInput = quickAddModal.querySelector('#jt-company');
      const positionInput = quickAddModal.querySelector('#jt-position');
      const descriptionInput = quickAddModal.querySelector('#jt-description');
      if (!companyInput.value) {
        companyInput.focus();
      } else if (!positionInput.value) {
        positionInput.focus();
      } else {
        companyInput.focus();
      }

      // Event handlers
      const closeModal = () => {
        quickAddModal.remove();
        quickAddModal = null;
        resolve(null);
      };

      const saveData = () => {
        const company = companyInput.value.trim();
        const position = positionInput.value.trim();
        const jobDescription = descriptionInput.value.trim();

        if (!company && !position) {
          companyInput.focus();
          return;
        }

        quickAddModal.remove();
        quickAddModal = null;
        resolve({ company, position, jobDescription });
      };

      quickAddModal.querySelector('.jobtracker-quick-add-close').addEventListener('click', closeModal);
      quickAddModal.querySelector('.jobtracker-quick-add-cancel').addEventListener('click', closeModal);
      quickAddModal.querySelector('.jobtracker-quick-add-save').addEventListener('click', saveData);

      // Close on overlay click
      quickAddModal.addEventListener('click', (e) => {
        if (e.target === quickAddModal) closeModal();
      });

      // Handle Enter key
      quickAddModal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveData();
        } else if (e.key === 'Escape') {
          closeModal();
        }
      });
    });
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Trigger autofill with profile validation
  async function triggerAutofill() {
    try {
      // Get profile to validate before autofill
      const profile = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });

      // Check if profile has minimum required fields
      if (!profile || !profile.personal?.email) {
        if (window.JobTrackerContent) {
          window.JobTrackerContent.showNotification(
            'Please complete your profile before using autofill. Click the extension icon to set up your profile.',
            'warning'
          );
        } else {
          alert('Please complete your profile before using autofill. Click the JobTracker extension icon to set up your profile.');
        }
        return;
      }

      window.dispatchEvent(new CustomEvent('jobtracker:trigger-autofill'));
      chrome.runtime.sendMessage({ type: 'TRIGGER_AUTOFILL' });
    } catch (error) {
      console.log('JobTracker: Error triggering autofill:', error);
      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Error triggering autofill', 'error');
      }
    }
  }

  // Track current application
  async function trackCurrentApplication(status = 'saved') {
    let jobInfo = extractJobInfo();

    if (!jobInfo.company && !jobInfo.position) {
      const result = await showQuickAddModal(jobInfo);
      if (!result) return;
      Object.assign(jobInfo, result);
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_APPLICATION',
        payload: {
          ...jobInfo,
          status: status,
          dateApplied: new Date().toISOString()
        }
      });

      // Check for duplicate
      if (response?.duplicate) {
        if (window.JobTrackerContent) {
          window.JobTrackerContent.showNotification(
            `Already tracked: ${response.existing?.position || 'This job'} at ${response.existing?.company || 'this company'}`,
            'warning'
          );
        }
        return;
      }

      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Application saved to tracker!', 'success');
      }
    } catch (error) {
      console.log('JobTracker: Error tracking application:', error);
    }
  }

  // Extract job info from page
  function extractJobInfo() {
    const url = window.location.href;
    const platform = detectPlatform(url);

    // Try platform-specific extractor first (exposed by platform detect modules)
    if (typeof window.__jobTrackerExtractJob === 'function') {
      const platformInfo = window.__jobTrackerExtractJob();
      if (platformInfo && (platformInfo.company || platformInfo.position)) {
        return {
          ...platformInfo,
          jobUrl: url,
          platform
        };
      }
    }

    // Try to extract from page
    let company = '';
    let position = '';
    let location = '';

    // Platform-specific selectors
    const platformSelectors = {
      naukri: {
        company: [
          '.styles_jd-header-comp-name__MvqAI > a',
          '[class*="jd-header-comp-name"] > a',
          '[class*="company-name"] a'
        ],
        position: [
          'h1.styles_jd-header-title__rZwM1',
          '.styles_jd-header-title__rZwM1',
          'h1[class*="jd-header-title"]'
        ],
        location: [
          '.styles_jhc__location__W_pVs a',
          '[class*="jhc__location"] a'
        ]
      }
    };

    // Common selectors for job info
    const companySelectors = [
      ...(platformSelectors[platform]?.company || []),
      '[class*="company"]',
      '[class*="employer"]',
      '[data-company]',
      'h2',
      '.company-name'
    ];

    const positionSelectors = [
      ...(platformSelectors[platform]?.position || []),
      'h1',
      '[class*="job-title"]',
      '[class*="position"]',
      '[data-job-title]',
      '.job-title'
    ];

    const locationSelectors = [
      ...(platformSelectors[platform]?.location || []),
      '[class*="location"]',
      '[class*="job-location"]'
    ];

    // Try JSON-LD first (most reliable)
    try {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting') {
          position = data.title || '';
          company = data.hiringOrganization?.name || '';
          if (data.jobLocation?.address) {
            const addr = data.jobLocation.address;
            location = Array.isArray(addr.addressLocality)
              ? addr.addressLocality.join(', ')
              : addr.addressLocality || '';
          }
          if (position && company) break;
        }
      }
    } catch (e) {
      // JSON-LD parsing failed, continue with DOM extraction
    }

    // DOM extraction fallback
    if (!company) {
      for (const selector of companySelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length < 100) {
            company = el.textContent.trim();
            break;
          }
        } catch (e) {}
      }
    }

    if (!position) {
      for (const selector of positionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length < 200) {
            position = el.textContent.trim();
            break;
          }
        } catch (e) {}
      }
    }

    if (!location) {
      for (const selector of locationSelectors) {
        try {
          const els = document.querySelectorAll(selector);
          if (els.length > 0) {
            location = Array.from(els)
              .map(el => el.textContent.trim())
              .filter(Boolean)
              .slice(0, 3)
              .join(', ');
            if (location) break;
          }
        } catch (e) {}
      }
    }

    // Fallback to page title
    if (!position) {
      const titleParts = document.title.split(/[-|–—]/);
      position = titleParts[0]?.trim() || '';
    }

    return {
      company,
      position,
      location,
      jobUrl: url,
      platform
    };
  }

  // Detect platform from URL - use shared utility if available
  function detectPlatform(url) {
    if (typeof JobTrackerUtils !== 'undefined' && JobTrackerUtils.detectPlatform) {
      return JobTrackerUtils.detectPlatform(url);
    }
    // Fallback if utility not available
    const platforms = {
      'linkedin': /linkedin\.com/i,
      'indeed': /indeed\.com/i,
      'glassdoor': /glassdoor\.(com|co\.uk)/i,
      'greenhouse': /greenhouse\.io/i,
      'lever': /lever\.(co|com)/i,
      'workday': /(myworkdayjobs|workday)\.com/i,
      'icims': /icims\.com/i,
      'smartrecruiters': /smartrecruiters\.com/i,
      'naukri': /naukri\.com/i
    };

    for (const [platform, pattern] of Object.entries(platforms)) {
      if (pattern.test(url)) return platform;
    }
    return 'other';
  }

  // Hide button
  function hideButton() {
    if (floatingButton) {
      floatingButton.remove();
      floatingButton = null;
    }
  }

  // Make element draggable
  function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, startLeft, startBottom;

    element.addEventListener('mousedown', (e) => {
      if (e.target.closest('.jobtracker-btn-menu')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startBottom = window.innerHeight - rect.bottom;

      element.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = startY - e.clientY;

      let newLeft = startLeft + deltaX;
      let newBottom = startBottom + deltaY;

      // Keep within bounds
      const rect = element.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newBottom = Math.max(0, Math.min(newBottom, window.innerHeight - rect.height));

      element.style.left = `${newLeft}px`;
      element.style.right = 'auto';
      element.style.bottom = `${newBottom}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.transition = '';
      }
    });
  }

  // Watch for dynamic form changes
  function observeFormChanges() {
    const observer = new MutationObserver(() => {
      if (!isFormDetected && shouldShowButton()) {
        createFloatingButton();
        isFormDetected = true;
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
