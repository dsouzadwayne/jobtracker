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
  let isFormDetected = false;
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
      /lever\.co/,
      /workday\.com/,
      /myworkdayjobs\.com/,
      /icims\.com/,
      /smartrecruiters\.com/
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
      console.error('JobTracker: Error initializing floating button:', error);
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
      <button class="jobtracker-btn-main" title="JobTracker - Autofill Application">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>Autofill</span>
      </button>
      <div class="jobtracker-btn-menu hidden">
        <button class="jobtracker-menu-item" data-action="autofill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Autofill Form
        </button>
        <button class="jobtracker-menu-item" data-action="track">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Track Application
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
    const mainBtn = floatingButton.querySelector('.jobtracker-btn-main');
    const menu = floatingButton.querySelector('.jobtracker-btn-menu');

    // Click main button to autofill
    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerAutofill();
    });

    // Right-click to show menu
    mainBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
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
      case 'track':
        trackCurrentApplication();
        break;
      case 'hide':
        hideButton();
        break;
    }
  }

  // Trigger autofill
  function triggerAutofill() {
    window.dispatchEvent(new CustomEvent('jobtracker:trigger-autofill'));
    chrome.runtime.sendMessage({ type: 'TRIGGER_AUTOFILL' });
  }

  // Track current application
  async function trackCurrentApplication() {
    const jobInfo = extractJobInfo();

    if (!jobInfo.company && !jobInfo.position) {
      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Could not extract job info from this page', 'warning');
      }
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_APPLICATION',
        payload: {
          ...jobInfo,
          status: 'saved',
          dateApplied: new Date().toISOString()
        }
      });

      if (window.JobTrackerContent) {
        window.JobTrackerContent.showNotification('Application saved to tracker!', 'success');
      }
    } catch (error) {
      console.error('JobTracker: Error tracking application:', error);
    }
  }

  // Extract job info from page
  function extractJobInfo() {
    const url = window.location.href;
    const platform = detectPlatform(url);

    // Try to extract from page
    let company = '';
    let position = '';

    // Common selectors for job info
    const companySelectors = [
      '[class*="company"]',
      '[class*="employer"]',
      '[data-company]',
      'h2',
      '.company-name'
    ];

    const positionSelectors = [
      'h1',
      '[class*="job-title"]',
      '[class*="position"]',
      '[data-job-title]',
      '.job-title'
    ];

    for (const selector of companySelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length < 100) {
        company = el.textContent.trim();
        break;
      }
    }

    for (const selector of positionSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length < 200) {
        position = el.textContent.trim();
        break;
      }
    }

    // Fallback to page title
    if (!position) {
      const titleParts = document.title.split(/[-|]/);
      position = titleParts[0]?.trim() || '';
    }

    return {
      company,
      position,
      jobUrl: url,
      platform
    };
  }

  // Detect platform from URL
  function detectPlatform(url) {
    const platforms = {
      'linkedin': /linkedin\.com/i,
      'indeed': /indeed\.com/i,
      'glassdoor': /glassdoor\.(com|co\.uk)/i,
      'greenhouse': /greenhouse\.io/i,
      'lever': /lever\.co/i,
      'workday': /(myworkdayjobs|workday)\.com/i,
      'icims': /icims\.com/i,
      'smartrecruiters': /smartrecruiters\.com/i
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
