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
  let currentJobId = null; // Track current job to detect changes

  // Default settings for graceful degradation when background script fails
  const DEFAULT_SETTINGS = {
    autofill: { enabled: true, showFloatingButton: true, autoDetectForms: true, confirmBeforeFill: false }
  };

  /**
   * Safe wrapper for chrome.runtime.sendMessage with error handling
   * @param {object} message - Message to send
   * @param {any} defaultValue - Default value to return on error
   * @returns {Promise<any>} Response or default value
   */
  async function safeSendMessage(message, defaultValue = null) {
    try {
      const result = await chrome.runtime.sendMessage(message);
      if (chrome.runtime.lastError) {
        console.log('JobTracker: Runtime error:', chrome.runtime.lastError.message);
        return defaultValue;
      }
      return result;
    } catch (error) {
      console.log('JobTracker: Message error:', error.message || error);
      return defaultValue;
    }
  }

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
      // Get settings with fallback to defaults
      settings = await safeSendMessage({ type: 'GET_SETTINGS' }, DEFAULT_SETTINGS);

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

      // Watch for LinkedIn job selection changes (for two-pane view)
      observeLinkedInJobChanges();

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

    // Close menu when clicking elsewhere - store handler for cleanup
    const closeMenuHandler = () => {
      menu.classList.add('hidden');
    };
    document.addEventListener('click', closeMenuHandler);
    // Store handler reference for potential cleanup
    floatingButton._closeMenuHandler = closeMenuHandler;

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

    // Try standard extraction first
    let jobInfo = extractJobInfo();

    // If on unsupported site and extraction failed, try AI extraction
    if (jobInfo.platform === 'other' && (!jobInfo.company || !jobInfo.position)) {
      // Check if AI extractor is available
      if (typeof window.__jobTrackerAIExtract === 'function') {
        try {
          const aiJobInfo = await window.__jobTrackerAIExtract();
          if (aiJobInfo) {
            // Merge AI results with existing (AI results fill in gaps)
            for (const [key, value] of Object.entries(aiJobInfo)) {
              if (value && !jobInfo[key]) {
                jobInfo[key] = value;
              }
            }
          }
        } catch (error) {
          console.log('JobTracker: AI extraction failed:', error);
        }
      }
    }

    // If extraction still failed, show quick add modal
    if (!jobInfo.company && !jobInfo.position) {
      const result = await showQuickAddModal(jobInfo);
      if (!result) return; // User cancelled
      Object.assign(jobInfo, result);
    }

    const response = await safeSendMessage({
      type: 'ADD_APPLICATION',
      payload: {
        ...jobInfo,
        status: 'applied',
        dateApplied: new Date().toISOString(),
        source: 'manual-button'
      }
    }, null);

    if (!response) {
      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Failed to save application. Extension may be reloading.', 'error');
      }
      return;
    }

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

  // Reset button to untracked state
  function resetButtonState() {
    hasApplied = false;
    const appliedBtn = floatingButton?.querySelector('.jobtracker-btn-applied');
    if (appliedBtn) {
      appliedBtn.classList.remove('applied');
      appliedBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Track</span>
      `;
    }
  }

  // Get current job ID from LinkedIn page
  function getCurrentLinkedInJobId() {
    // Try to get job ID from URL first
    const jobIdMatch = window.location.href.match(/\/jobs\/view\/(\d+)/);
    if (jobIdMatch?.[1]) {
      return jobIdMatch[1];
    }

    // Check currentJobId query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const currentJobIdParam = urlParams.get('currentJobId');
    if (currentJobIdParam) {
      return currentJobIdParam;
    }

    // Check for active job card with data-job-id
    const activeJobCard = document.querySelector('[data-job-id].jobs-search-results-list__list-item--active, [data-job-id][aria-current="page"]');
    if (activeJobCard) {
      return activeJobCard.getAttribute('data-job-id');
    }

    // Check parent li elements with data-occludable-job-id
    // Note: Using fallback approach since :has() isn't supported in all browsers
    const activeElement = document.querySelector('.jobs-search-results-list__list-item--active');
    if (activeElement) {
      const activeListItem = activeElement.closest('li[data-occludable-job-id]');
      if (activeListItem) {
        return activeListItem.getAttribute('data-occludable-job-id');
      }
    }

    return null;
  }

  // Check if a job URL is already tracked
  async function checkIfJobTracked(jobUrl) {
    const response = await safeSendMessage({
      type: 'CHECK_DUPLICATE',
      payload: { jobUrl }
    }, { exists: false });
    return response?.exists || false;
  }

  // Update button state based on whether current job is tracked
  async function updateButtonForCurrentJob() {
    const jobId = getCurrentLinkedInJobId();

    // If job hasn't changed, no need to update
    if (jobId === currentJobId) return;

    currentJobId = jobId;

    if (!jobId) {
      resetButtonState();
      return;
    }

    const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
    const isTracked = await checkIfJobTracked(jobUrl);

    if (isTracked) {
      setAppliedState();
    } else {
      resetButtonState();
    }
  }

  // Store original extraction for correction tracking
  let originalExtraction = null;

  // Show quick add modal for manual entry
  function showQuickAddModal(prefill = {}) {
    // Store the original extraction data for correction tracking
    originalExtraction = { ...prefill };

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
            <div class="jobtracker-quick-add-row">
              <div class="jobtracker-quick-add-field">
                <label for="jt-company">Company</label>
                <input type="text" id="jt-company" placeholder="e.g., Google" value="${escapeHtml(prefill.company || '')}">
              </div>
              <div class="jobtracker-quick-add-field">
                <label for="jt-position">Position</label>
                <input type="text" id="jt-position" placeholder="e.g., Software Engineer" value="${escapeHtml(prefill.position || '')}">
              </div>
            </div>
            <div class="jobtracker-quick-add-row">
              <div class="jobtracker-quick-add-field">
                <label for="jt-location">Location <span class="jobtracker-optional-label">(optional)</span></label>
                <input type="text" id="jt-location" placeholder="e.g., San Francisco, CA" value="${escapeHtml(prefill.location || '')}">
              </div>
              <div class="jobtracker-quick-add-field">
                <label for="jt-salary">Salary <span class="jobtracker-optional-label">(optional)</span></label>
                <input type="text" id="jt-salary" placeholder="e.g., $100k - $150k" value="${escapeHtml(prefill.salary || '')}">
              </div>
            </div>
            <div class="jobtracker-quick-add-row">
              <div class="jobtracker-quick-add-field">
                <label for="jt-jobtype">Job Type <span class="jobtracker-optional-label">(optional)</span></label>
                <select id="jt-jobtype">
                  <option value="">Select...</option>
                  <option value="full-time" ${prefill.jobType === 'full-time' ? 'selected' : ''}>Full-time</option>
                  <option value="part-time" ${prefill.jobType === 'part-time' ? 'selected' : ''}>Part-time</option>
                  <option value="contract" ${prefill.jobType === 'contract' ? 'selected' : ''}>Contract</option>
                  <option value="internship" ${prefill.jobType === 'internship' ? 'selected' : ''}>Internship</option>
                </select>
              </div>
              <div class="jobtracker-quick-add-field">
                <label for="jt-remote">Remote <span class="jobtracker-optional-label">(optional)</span></label>
                <select id="jt-remote">
                  <option value="">Select...</option>
                  <option value="remote" ${prefill.remote === 'remote' ? 'selected' : ''}>Remote</option>
                  <option value="hybrid" ${prefill.remote === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                  <option value="onsite" ${prefill.remote === 'onsite' ? 'selected' : ''}>On-site</option>
                </select>
              </div>
            </div>
            <div class="jobtracker-quick-add-field">
              <label for="jt-description">
                Job Description
                <span class="jobtracker-optional-label">(optional)</span>
              </label>
              <textarea id="jt-description" placeholder="Paste or auto-extracted job description..." rows="3">${escapeHtml(prefill.jobDescription || '')}</textarea>
            </div>
          </div>
          <div class="jobtracker-quick-add-footer">
            <button class="jobtracker-quick-add-cancel">Cancel</button>
            <button class="jobtracker-quick-add-save">Save Application</button>
          </div>
        </div>
      `;

      document.body.appendChild(quickAddModal);

      // Focus first empty field (with null checks)
      const companyInput = quickAddModal.querySelector('#jt-company');
      const positionInput = quickAddModal.querySelector('#jt-position');
      const descriptionInput = quickAddModal.querySelector('#jt-description');
      if (companyInput && !companyInput.value) {
        companyInput.focus();
      } else if (positionInput && !positionInput.value) {
        positionInput.focus();
      } else if (companyInput) {
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
        const location = quickAddModal.querySelector('#jt-location')?.value.trim() || '';
        const salary = quickAddModal.querySelector('#jt-salary')?.value.trim() || '';
        const jobType = quickAddModal.querySelector('#jt-jobtype')?.value || '';
        const remote = quickAddModal.querySelector('#jt-remote')?.value || '';
        const jobDescription = descriptionInput.value.trim();

        if (!company && !position) {
          companyInput.focus();
          return;
        }

        const finalData = { company, position, location, salary, jobType, remote, jobDescription };

        // Track corrections if original extraction exists
        if (originalExtraction) {
          trackExtractionCorrection(originalExtraction, finalData);
        }

        quickAddModal.remove();
        quickAddModal = null;
        resolve(finalData);
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
      const profile = await safeSendMessage({ type: 'GET_PROFILE' }, null);

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
      await safeSendMessage({ type: 'TRIGGER_AUTOFILL' });
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

    // If on unsupported site, try AI extraction
    if (jobInfo.platform === 'other' && (!jobInfo.company || !jobInfo.position)) {
      if (typeof window.__jobTrackerAIExtract === 'function') {
        try {
          const aiJobInfo = await window.__jobTrackerAIExtract();
          if (aiJobInfo) {
            for (const [key, value] of Object.entries(aiJobInfo)) {
              if (value && !jobInfo[key]) {
                jobInfo[key] = value;
              }
            }
          }
        } catch (error) {
          console.log('JobTracker: AI extraction failed:', error);
        }
      }
    }

    if (!jobInfo.company && !jobInfo.position) {
      const result = await showQuickAddModal(jobInfo);
      if (!result) return;
      Object.assign(jobInfo, result);
    }

    const response = await safeSendMessage({
      type: 'ADD_APPLICATION',
      payload: {
        ...jobInfo,
        status: status,
        dateApplied: new Date().toISOString()
      }
    }, null);

    if (!response) {
      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Failed to save application. Extension may be reloading.', 'error');
      }
      return;
    }

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
    let jobDescription = '';

    // Platform-specific selectors
    const platformSelectors = {
      linkedin: {
        company: [
          '.job-details-jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name a',
          '.jobs-details-top-card__company-url',
          '.hirer-card__hirer-information a[href*="/company/"]'
        ],
        position: [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.job-details-jobs-unified-top-card__job-title a',
          '.jobs-unified-top-card__job-title h1',
          '.jobs-unified-top-card__job-title'
        ],
        location: [
          '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text--low-emphasis:first-child',
          '.job-details-jobs-unified-top-card__bullet',
          '.jobs-unified-top-card__bullet'
        ]
      },
      smartrecruiters: {
        company: [
          '[itemprop="hiringOrganization"] [itemprop="name"]',
          'meta[itemprop="name"]',
          '.header-logo img[alt]'
        ],
        position: [
          'h1.job-title[itemprop="title"]',
          'h1.job-title',
          '.job-title[itemprop="title"]'
        ],
        location: [
          'spl-job-location[formattedaddress]',
          '[itemprop="jobLocation"] [itemprop="address"]',
          '.job-details [itemprop="addressLocality"]'
        ],
        description: [
          '[itemprop="description"]',
          '.job-sections [itemprop="description"]',
          '#st-jobDescription .wysiwyg'
        ]
      },
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
          if (data.description) {
            jobDescription = data.description;
          }
          if (position && company) break;
        }
      }
    } catch (e) {
      // JSON-LD parsing failed, continue with DOM extraction
    }

    // Helper to extract text from element, handling special cases
    const extractFromElement = (el) => {
      if (!el) return '';
      // Skip IE11 notification overlay elements
      if (el.closest('.isn') || el.classList?.contains('isn') ||
          el.className?.includes?.('isn-')) return '';
      // Handle meta tags
      if (el.tagName === 'META') {
        return el.getAttribute('content') || '';
      }
      // Handle img alt text (for company logos)
      if (el.tagName === 'IMG') {
        return el.getAttribute('alt') || '';
      }
      // Handle custom web components with special attributes
      if (el.hasAttribute('formattedaddress')) {
        return el.getAttribute('formattedaddress') || '';
      }
      return el.textContent?.trim() || '';
    };

    // DOM extraction fallback
    if (!company) {
      for (const selector of companySelectors) {
        try {
          const el = document.querySelector(selector);
          const text = extractFromElement(el);
          if (text && text.length < 100) {
            company = text;
            break;
          }
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
      }
    }

    if (!position) {
      for (const selector of positionSelectors) {
        try {
          const el = document.querySelector(selector);
          const text = extractFromElement(el);
          if (text && text.length < 200) {
            position = text;
            break;
          }
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
      }
    }

    if (!location) {
      for (const selector of locationSelectors) {
        try {
          const els = document.querySelectorAll(selector);
          if (els.length > 0) {
            location = Array.from(els)
              .map(el => extractFromElement(el))
              .filter(Boolean)
              .slice(0, 3)
              .join(', ');
            if (location) break;
          }
        } catch (e) {
          // Selector query may fail for complex selectors
          console.warn('JobTracker: Selector query failed', selector, e.message);
        }
      }
    }

    // Fallback to page title
    if (!position) {
      const titleParts = document.title.split(/[-|–—]/);
      position = titleParts[0]?.trim() || '';
    }

    // Extract job description if not already found
    if (!jobDescription) {
      const descriptionSelectors = [
        '#job-description',
        '.job-description',
        '[class*="job-description"]',
        '[class*="jobDescription"]',
        '[class*="description"]',
        '[data-testid*="description"]',
        'article',
        '[role="main"] section'
      ];

      for (const selector of descriptionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.innerText?.trim().length > 100) {
            jobDescription = el.innerText.trim().substring(0, 10000);
            break;
          }
        } catch (e) {
          // Selector query may fail for complex selectors
        }
      }
    }

    return {
      company,
      position,
      location,
      jobDescription,
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
      // Clean up event listener to prevent memory leak
      if (floatingButton._closeMenuHandler) {
        document.removeEventListener('click', floatingButton._closeMenuHandler);
      }
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

    // Also reset drag state if mouse leaves the window
    window.addEventListener('blur', () => {
      if (isDragging) {
        isDragging = false;
        element.style.transition = '';
      }
    });

    // Handle mouse leaving the document/viewport
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget && isDragging) {
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

  // Watch for LinkedIn job selection changes
  function observeLinkedInJobChanges() {
    if (!window.location.href.includes('linkedin.com/jobs')) return;

    // Check initial state
    updateButtonForCurrentJob();

    // Observer for class/attribute changes on job cards
    const jobListObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if the active class was added/removed
        if (mutation.type === 'attributes' &&
            (mutation.attributeName === 'class' || mutation.attributeName === 'aria-current')) {
          const target = mutation.target;
          if (target.classList?.contains('jobs-search-results-list__list-item--active') ||
              target.getAttribute('aria-current') === 'page') {
            updateButtonForCurrentJob();
            return;
          }
        }
        // Also check added nodes for active job cards
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          updateButtonForCurrentJob();
          return;
        }
      }
    });

    // Observe the job list container
    const jobListContainer = document.querySelector('.jobs-search-results-list, .scaffold-layout__list');
    if (jobListContainer) {
      jobListObserver.observe(jobListContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-current']
      });
    }

    // Also listen for clicks on job cards as a fallback
    document.addEventListener('click', (e) => {
      const jobCard = e.target.closest('[data-job-id], li[data-occludable-job-id]');
      if (jobCard) {
        // Small delay to let LinkedIn update the UI
        setTimeout(() => updateButtonForCurrentJob(), 100);
      }
    });

    // Watch for URL changes (for SPA navigation)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        currentJobId = null; // Reset to force re-check
        setTimeout(() => updateButtonForCurrentJob(), 100);
      }
    });

    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Track extraction corrections for improving future extractions
  async function trackExtractionCorrection(extracted, corrected) {
    try {
      // Check if there are meaningful differences
      const fieldsToCompare = ['company', 'position', 'location', 'salary'];
      let hasChanges = false;

      for (const field of fieldsToCompare) {
        const extractedVal = (extracted[field] || '').trim().toLowerCase();
        const correctedVal = (corrected[field] || '').trim().toLowerCase();

        if (extractedVal !== correctedVal && correctedVal) {
          hasChanges = true;
          break;
        }
      }

      if (!hasChanges) {
        return; // No corrections to track
      }

      const url = window.location.href;
      let domain = 'unknown';
      try {
        domain = new URL(url).hostname;
      } catch (e) {
        // URL parsing failed
      }

      await safeSendMessage({
        type: 'TRACK_EXTRACTION_CORRECTION',
        payload: {
          extracted: {
            company: extracted.company || '',
            position: extracted.position || '',
            location: extracted.location || '',
            salary: extracted.salary || ''
          },
          corrected: {
            company: corrected.company || '',
            position: corrected.position || '',
            location: corrected.location || '',
            salary: corrected.salary || ''
          },
          url,
          domain
        }
      });

      console.log('JobTracker: Tracked extraction correction');
    } catch (error) {
      console.log('JobTracker: Failed to track correction:', error.message);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
