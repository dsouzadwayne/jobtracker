/**
 * JobTracker Naukri Detection
 * Extracts job information from Naukri.com job pages for manual tracking
 * NO auto-adding - user must click the floating button to add jobs
 */

(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__jobTrackerNaukriDetectInitialized) return;
  window.__jobTrackerNaukriDetectInitialized = true;

  // Naukri-specific selectors
  const SELECTORS = {
    // Job details page selectors
    jobTitle: 'h1.styles_jd-header-title__rZwM1, .styles_jd-header-title__rZwM1, h1[class*="jd-header-title"]',
    company: '.styles_jd-header-comp-name__MvqAI > a, [class*="jd-header-comp-name"] > a',
    location: '.styles_jhc__location__W_pVs a, [class*="jhc__location"] a, [class*="jhc__loc"] span',
    experience: '.styles_jhc__exp__k_giM span, [class*="jhc__exp"] span',
    salary: '.styles_jhc__salary__jdfEC span, [class*="jhc__salary"] span',
    workMode: '.styles_jhc__wfhmode__iQwF4 span, [class*="jhc__wfhmode"] span',
    skills: '.styles_key-skill__GIPn_ .styles_chip__7YCfG span, [class*="key-skill"] [class*="chip"] span',
    jobDescription: '.styles_JDC__dang-inner-html__h0K4t, [class*="JDC__dang-inner-html"]',
    employmentType: '.styles_other-details__oEN4O, [class*="other-details"]'
  };

  // Valid Naukri hostnames
  const NAUKRI_HOSTNAMES = ['www.naukri.com', 'naukri.com'];

  // Check if we're on a valid Naukri domain
  function isNaukriDomain() {
    return NAUKRI_HOSTNAMES.includes(window.location.hostname);
  }

  // Initialize - just expose the job extraction function
  function init() {
    if (!isNaukriDomain()) return;

    // Expose job extraction for the floating button
    window.__jobTrackerExtractJob = extractJobInfo;

    console.log('JobTracker: Naukri detection module loaded (manual mode)');
  }

  // Extract job information from page
  function extractJobInfo() {
    const info = {
      company: '',
      position: '',
      location: '',
      salary: '',
      experience: '',
      workMode: '',
      skills: [],
      jobUrl: window.location.href,
      platform: 'naukri',
      jobDescription: ''
    };

    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'JobPosting') {
          info.position = data.title || '';
          info.company = data.hiringOrganization?.name || '';

          // Extract location
          const jobLocation = data.jobLocation;
          if (jobLocation?.address) {
            const addr = jobLocation.address;
            if (Array.isArray(addr.addressLocality)) {
              // Ensure all items are strings before joining
              info.location = addr.addressLocality
                .map(item => typeof item === 'string' ? item : String(item || ''))
                .filter(Boolean)
                .join(', ');
            } else {
              info.location = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(', ');
            }
          }

          // Extract salary
          if (data.baseSalary?.value) {
            const salaryValue = data.baseSalary.value;
            info.salary = typeof salaryValue === 'object' ? salaryValue.value : salaryValue;
          }

          // Extract experience
          if (data.experienceRequirements?.monthsOfExperience) {
            const months = parseInt(data.experienceRequirements.monthsOfExperience);
            info.experience = `${Math.floor(months / 12)} years`;
          }

          // Extract skills
          if (data.skills) {
            info.skills = Array.isArray(data.skills) ? data.skills : [data.skills];
          }

          // Extract employment type
          if (data.employmentType) {
            info.employmentType = data.employmentType;
          }

          // Extract job description from JSON-LD
          if (data.description) {
            info.jobDescription = data.description;
          }

          break;
        }
      } catch (e) {
        // JSON-LD parsing failed for this script, continue with others
      }
    }

    // Strategy 2: DOM extraction (fallback)
    if (!info.position) {
      const titleEl = document.querySelector(SELECTORS.jobTitle);
      if (titleEl) {
        info.position = titleEl.textContent?.trim() || '';
      }
    }

    if (!info.company) {
      const companyEl = document.querySelector(SELECTORS.company);
      if (companyEl) {
        info.company = companyEl.textContent?.trim() || '';
      }
    }

    if (!info.location) {
      const locationEls = document.querySelectorAll(SELECTORS.location);
      if (locationEls.length > 0) {
        info.location = Array.from(locationEls)
          .map(el => el.textContent?.trim())
          .filter(Boolean)
          .join(', ');
      }
    }

    if (!info.experience) {
      const expEl = document.querySelector(SELECTORS.experience);
      if (expEl) {
        info.experience = expEl.textContent?.trim() || '';
      }
    }

    if (!info.salary) {
      const salaryEl = document.querySelector(SELECTORS.salary);
      if (salaryEl) {
        info.salary = salaryEl.textContent?.trim() || '';
      }
    }

    if (!info.workMode) {
      const workModeEl = document.querySelector(SELECTORS.workMode);
      if (workModeEl) {
        info.workMode = workModeEl.textContent?.trim() || '';
      }
    }

    if (info.skills.length === 0) {
      const skillEls = document.querySelectorAll(SELECTORS.skills);
      if (skillEls.length > 0) {
        info.skills = Array.from(skillEls)
          .map(el => el.textContent?.trim())
          .filter(Boolean);
      }
    }

    // Extract job description from DOM if not already found
    if (!info.jobDescription) {
      const descEl = document.querySelector(SELECTORS.jobDescription);
      if (descEl) {
        info.jobDescription = descEl.innerText?.trim() || '';
      }
    }

    // Try to get job ID from URL
    const jobIdMatch = window.location.href.match(/job-listings[^-]*-(\d+)/);
    if (jobIdMatch?.[1]) {
      info.jobId = jobIdMatch[1];
    }

    return info;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
