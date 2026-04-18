/**
 * Job Sites Page Module
 * Displays supported sites, sites from application history, and user-added custom sites
 */

import { JobTrackerDB } from '../lib/database.js';

// Supported sites with autofill/auto-track capabilities
const SUPPORTED_SITES = [
  {
    name: 'LinkedIn',
    domain: 'linkedin.com',
    url: 'https://www.linkedin.com/jobs',
    abbrev: 'Li',
    gradient: 'linear-gradient(135deg, #0077B5, #00A0DC)',
    features: ['Autofill', 'Auto-track']
  },
  {
    name: 'Indeed',
    domain: 'indeed.com',
    url: 'https://www.indeed.com',
    abbrev: 'In',
    gradient: 'linear-gradient(135deg, #2164F3, #6D9EEB)',
    features: ['Autofill', 'Auto-track']
  },
  {
    name: 'Greenhouse',
    domain: 'greenhouse.io',
    url: 'https://boards.greenhouse.io',
    abbrev: 'Gh',
    gradient: 'linear-gradient(135deg, #3AB549, #7BC96F)',
    features: ['Autofill', 'Auto-track']
  },
  {
    name: 'Lever',
    domain: 'lever.co',
    url: 'https://jobs.lever.co',
    abbrev: 'Lv',
    gradient: 'linear-gradient(135deg, #1B1B1B, #4A4A4A)',
    features: ['Autofill', 'Auto-track']
  },
  {
    name: 'Workday',
    domain: 'myworkdayjobs.com',
    url: 'https://www.myworkdayjobs.com',
    abbrev: 'Wd',
    gradient: 'linear-gradient(135deg, #F68D2E, #FFB84D)',
    features: ['Autofill', 'Auto-track']
  },
  {
    name: 'iCIMS',
    domain: 'icims.com',
    url: 'https://www.icims.com',
    abbrev: 'iC',
    gradient: 'linear-gradient(135deg, #00A19C, #4DB6AC)',
    features: ['Autofill']
  },
  {
    name: 'Glassdoor',
    domain: 'glassdoor.com',
    url: 'https://www.glassdoor.com/Job',
    abbrev: 'Gd',
    gradient: 'linear-gradient(135deg, #0CAA41, #4CD964)',
    features: ['Autofill', 'Auto-track']
  },
  {
    name: 'ZipRecruiter',
    domain: 'ziprecruiter.com',
    url: 'https://www.ziprecruiter.com',
    abbrev: 'Zp',
    gradient: 'linear-gradient(135deg, #5BA829, #8BC34A)',
    features: ['Autofill']
  },
  {
    name: 'Wellfound',
    domain: 'wellfound.com',
    url: 'https://wellfound.com/jobs',
    abbrev: 'Wf',
    gradient: 'linear-gradient(135deg, #000000, #333333)',
    features: ['Autofill']
  },
  {
    name: 'Monster',
    domain: 'monster.com',
    url: 'https://www.monster.com',
    abbrev: 'Mo',
    gradient: 'linear-gradient(135deg, #6E45A5, #9575CD)',
    features: ['Autofill']
  },
  {
    name: 'Dice',
    domain: 'dice.com',
    url: 'https://www.dice.com',
    abbrev: 'Di',
    gradient: 'linear-gradient(135deg, #E53935, #FF5252)',
    features: ['Autofill']
  },
  {
    name: 'CareerBuilder',
    domain: 'careerbuilder.com',
    url: 'https://www.careerbuilder.com',
    abbrev: 'CB',
    gradient: 'linear-gradient(135deg, #1E88E5, #64B5F6)',
    features: ['Autofill']
  }
];

// Theme Manager
const ThemeManager = {
  STORAGE_KEY: 'jobtracker_ui_prefs',

  async init() {
    const theme = await this.getTheme();
    this.applyTheme(theme);
    this.setupToggle();
  },

  async getTheme() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY]?.theme || 'system';
    } catch {
      return 'system';
    }
  },

  async setTheme(theme) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const prefs = result[this.STORAGE_KEY] || {};
      prefs.theme = theme;
      await chrome.storage.local.set({ [this.STORAGE_KEY]: prefs });
      this.applyTheme(theme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  },

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  },

  setupToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', async () => {
        const current = await this.getTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
      });
    }
  }
};

// Mobile sidebar handling
function setupMobileSidebar() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('dashboard-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('hidden');
    menuBtn.setAttribute('aria-expanded', sidebar.classList.contains('open'));
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Generate abbreviation from name
 */
function generateAbbrev(name) {
  const words = name.split(/[\s-]+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).charAt(0).toUpperCase() + name.substring(0, 2).charAt(1).toLowerCase();
}

/**
 * Format domain name to a readable name
 */
function formatDomainName(domain) {
  // Remove www. prefix
  let name = domain.replace(/^www\./, '');

  // Remove common TLDs for cleaner display
  name = name.replace(/\.(com|org|net|io|co|jobs)$/, '');

  // Handle subdomains like careers.company.com
  const parts = name.split('.');
  if (parts.length > 1) {
    // Use the main domain part
    name = parts[parts.length - 1] || parts[0];
  }

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Generate a consistent color gradient based on domain name
 */
function generateGradient(domain) {
  // Create a hash from the domain
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Generate hue from hash (0-360)
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash >> 8) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%

  return `linear-gradient(135deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${(hue + 20) % 360}, ${saturation}%, ${lightness + 15}%))`;
}


/**
 * Check if a domain is a supported site
 */
function isSupportedSite(domain) {
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
  return SUPPORTED_SITES.some(site => {
    const siteDomain = site.domain.replace(/^www\./, '').toLowerCase();
    return normalizedDomain.includes(siteDomain) || siteDomain.includes(normalizedDomain);
  });
}

/**
 * Get sites from application history with success rate
 */
async function getApplicationSites() {
  try {
    const apps = await JobTrackerDB.getAllApplications();
    const sites = new Map(); // domain -> {name, url, count, successes}

    // Statuses that count as "success" (got a response/progress)
    const successStatuses = ['screening', 'interview', 'offer'];

    apps.forEach(app => {
      if (app.jobUrl) {
        try {
          const url = new URL(app.jobUrl);
          const domain = url.hostname.replace(/^www\./, '');

          // Skip if it's a supported site (those are shown separately)
          if (isSupportedSite(domain)) return;

          if (!sites.has(domain)) {
            sites.set(domain, {
              name: formatDomainName(domain),
              domain: domain,
              url: url.origin,
              count: 0,
              successes: 0
            });
          }

          const siteData = sites.get(domain);
          siteData.count++;

          // Count successes (applications that progressed past 'applied')
          if (successStatuses.includes(app.status)) {
            siteData.successes++;
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });

    // Calculate success rate and sort by count descending
    return Array.from(sites.values())
      .map(site => ({
        ...site,
        successRate: site.count > 0 ? Math.round((site.successes / site.count) * 100) : null
      }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error getting application sites:', error);
    return [];
  }
}

/**
 * Create a site card element
 */
function createSiteCard(site, options = {}) {
  const { showFeatures = false, showCount = false, showDelete = false, isGeneric = false } = options;

  const card = document.createElement('a');
  card.href = site.url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.className = `site-card${isGeneric ? ' site-card-generic' : ''}`;

  // Logo
  const logo = document.createElement('div');
  logo.className = 'site-logo';
  if (isGeneric) {
    logo.style.background = 'linear-gradient(135deg, var(--text-muted), var(--text-secondary))';
    logo.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
    `;
  } else {
    logo.style.background = site.gradient || generateGradient(site.domain || site.name);
    logo.textContent = site.abbrev || generateAbbrev(site.name);
  }

  // Info container
  const info = document.createElement('div');
  info.className = 'site-info';

  const title = document.createElement('h4');
  title.textContent = site.name;
  info.appendChild(title);

  const domain = document.createElement('p');
  domain.textContent = site.domain || new URL(site.url).hostname;
  info.appendChild(domain);

  // Features tags (for supported sites)
  if (showFeatures && site.features?.length > 0) {
    const features = document.createElement('div');
    features.className = 'site-features';
    site.features.forEach(feature => {
      const tag = document.createElement('span');
      tag.className = 'feature-tag';
      tag.textContent = feature;
      features.appendChild(tag);
    });
    info.appendChild(features);
  }

  // Application count and success rate badges
  if (showCount && site.count) {
    const statsContainer = document.createElement('div');
    statsContainer.className = 'site-stats';

    // Application count
    const countBadge = document.createElement('span');
    countBadge.className = 'site-count';
    countBadge.textContent = `${site.count} application${site.count !== 1 ? 's' : ''}`;
    statsContainer.appendChild(countBadge);

    // Success rate (only show if there are applications)
    if (site.successRate !== null && site.successRate !== undefined) {
      const rateBadge = document.createElement('span');
      rateBadge.className = 'site-success-rate';
      if (site.successRate > 0) {
        rateBadge.classList.add('has-success');
      }
      rateBadge.textContent = `${site.successRate}% response`;
      statsContainer.appendChild(rateBadge);
    }

    info.appendChild(statsContainer);
  }

  card.appendChild(logo);
  card.appendChild(info);

  // External link icon
  const externalIcon = document.createElement('div');
  externalIcon.className = 'external-link-icon';
  externalIcon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  `;
  card.appendChild(externalIcon);

  // Delete button (for custom sites)
  if (showDelete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'site-delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${site.name}`);
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await deleteCustomSite(site.url);
    });
    card.appendChild(deleteBtn);
  }

  return card;
}

/**
 * Render all sites in a unified grid
 */
async function renderAllSites() {
  const grid = document.getElementById('sites-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // 1. Supported sites (with feature tags)
  SUPPORTED_SITES.forEach(site => {
    const card = createSiteCard(site, { showFeatures: true });
    grid.appendChild(card);
  });

  // 2. Sites from application history (with count badge)
  const applicationSites = await getApplicationSites();
  applicationSites.forEach(site => {
    const card = createSiteCard(site, { showCount: true });
    grid.appendChild(card);
  });

  // 3. User-added sites (with delete button)
  const customSites = await getCustomSites();
  customSites.forEach(site => {
    const card = createSiteCard(site, { showDelete: true });
    grid.appendChild(card);
  });
}

/**
 * Get custom sites from settings
 */
async function getCustomSites() {
  try {
    const settings = await JobTrackerDB.getSettings();
    return settings.customJobSites || [];
  } catch (error) {
    console.error('Error getting custom sites:', error);
    return [];
  }
}

/**
 * Save custom sites to settings
 */
async function saveCustomSites(sites) {
  try {
    const settings = await JobTrackerDB.getSettings();
    settings.customJobSites = sites;
    await JobTrackerDB.saveSettings(settings);
    return true;
  } catch (error) {
    console.error('Error saving custom sites:', error);
    return false;
  }
}

/**
 * Add a custom site
 */
async function addCustomSite(name, url) {
  const sites = await getCustomSites();

  // Check for duplicates
  const normalizedUrl = url.toLowerCase().replace(/\/+$/, '');
  const isDuplicate = sites.some(site =>
    site.url.toLowerCase().replace(/\/+$/, '') === normalizedUrl
  );

  if (isDuplicate) {
    throw new Error('This site has already been added');
  }

  // Parse URL to get domain
  let domain;
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
  } catch {
    throw new Error('Invalid URL format');
  }

  sites.push({
    name,
    url,
    domain,
    addedAt: new Date().toISOString()
  });

  const success = await saveCustomSites(sites);
  if (!success) {
    throw new Error('Failed to save site');
  }

  return true;
}

/**
 * Delete a custom site
 */
async function deleteCustomSite(url) {
  const sites = await getCustomSites();
  const normalizedUrl = url.toLowerCase().replace(/\/+$/, '');
  const filtered = sites.filter(site =>
    site.url.toLowerCase().replace(/\/+$/, '') !== normalizedUrl
  );

  if (filtered.length === sites.length) {
    return false; // Site not found
  }

  await saveCustomSites(filtered);
  await renderAllSites();
  return true;
}

/**
 * Setup modal functionality
 */
function setupModal() {
  const modal = document.getElementById('add-site-modal');
  const addBtn = document.getElementById('add-site-btn');
  const closeBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('modal-cancel');
  const form = document.getElementById('add-site-form');
  const errorEl = document.getElementById('form-error');

  if (!modal || !addBtn || !form) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    document.getElementById('site-name').focus();
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    form.reset();
    errorEl?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  addBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('site-name').value.trim();
    const url = document.getElementById('site-url').value.trim();

    if (!name || !url) return;

    try {
      await addCustomSite(name, url);
      closeModal();
      await renderAllSites();
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
      }
    }
  });
}

/**
 * Initialize page
 */
async function init() {
  await ThemeManager.init();
  setupMobileSidebar();
  setupModal();

  // Initialize database
  await JobTrackerDB.init();

  // Render all sites
  await renderAllSites();
}

// Start
document.addEventListener('DOMContentLoaded', init);
