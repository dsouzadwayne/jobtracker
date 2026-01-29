/**
 * Resume Maker - Preview Rendering
 * Renders resume as HTML for preview and PDF export
 */

import { getCurrentResume, getAnalysisResult, subscribe, getZoom, setZoom } from './state.js';
import { escapeHtml, formatDateRange, parseDescription } from './utils.js';

/**
 * Initialize preview
 */
export function initPreview() {
  // Subscribe to state changes
  subscribe('currentResume', renderPreview);
  subscribe('baseResume', renderPreview);
  subscribe('analysisResult', renderPreview);
  subscribe('zoom', updateZoom);

  // Zoom controls
  initZoomControls();

  // Initial render
  renderPreview();
}

/**
 * Initialize zoom controls
 */
function initZoomControls() {
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      setZoom(getZoom() + 10);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      setZoom(getZoom() - 10);
    });
  }
}

/**
 * Update zoom level display and transform
 */
function updateZoom() {
  const zoom = getZoom();
  const preview = document.getElementById('resume-preview');
  const zoomLabel = document.getElementById('zoom-level');

  if (preview) {
    preview.style.zoom = zoom / 100;
    preview.style.transform = 'none';
  }

  if (zoomLabel) {
    zoomLabel.textContent = `${zoom}%`;
  }
}

/**
 * Render the resume preview
 */
export function renderPreview() {
  const preview = document.getElementById('resume-preview');
  if (!preview) return;

  const resume = getCurrentResume();
  const analysis = getAnalysisResult();

  if (!resume) {
    preview.innerHTML = `
      <div class="preview-empty">
        <p>Start filling out your resume details to see a preview here.</p>
      </div>
    `;
    return;
  }

  // Build resume HTML
  const html = [
    renderHeader(resume.profile),
    renderSummary(resume.profile?.summary),
    renderExperience(resume.experience, analysis),
    renderEducation(resume.education),
    renderProjects(resume.projects),
    renderSkills(resume.skills, analysis),
    renderCustomSection(resume.custom)
  ].filter(Boolean).join('');

  const content = html || `
    <div class="preview-empty">
      <p>Add your profile information to get started.</p>
    </div>
  `;

  preview.innerHTML = content;
  updateZoom();
}

/**
 * Render header section
 */
function renderHeader(profile) {
  if (!profile || !profile.name) return '';

  const contactParts = [];
  if (profile.email) contactParts.push(`<span aria-label="Email">${escapeHtml(profile.email)}</span>`);
  if (profile.phone) contactParts.push(`<span aria-label="Phone">${escapeHtml(profile.phone)}</span>`);
  if (profile.location) contactParts.push(`<span aria-label="Location">${escapeHtml(profile.location)}</span>`);
  if (profile.website) {
    const displayUrl = profile.website.replace(/^https?:\/\//, '');
    contactParts.push(`<span aria-label="Website"><a href="${escapeHtml(profile.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayUrl)}</a></span>`);
  }

  return `
    <div class="resume-header">
      <div class="resume-name">${escapeHtml(profile.name)}</div>
      ${profile.headline ? `<div class="resume-headline">${escapeHtml(profile.headline)}</div>` : ''}
      ${contactParts.length > 0 ? `<div class="resume-contact">${contactParts.join('')}</div>` : ''}
    </div>
  `;
}

/**
 * Render summary section
 */
function renderSummary(summary) {
  if (!summary) return '';

  return `
    <div class="resume-summary">
      ${escapeHtml(summary)}
    </div>
  `;
}

/**
 * Render experience section
 */
function renderExperience(experience, analysis) {
  if (!experience?.items?.length) return '';

  // Sort by relevance score if analysis exists
  let items = [...experience.items];
  if (analysis?.tailoring?.experienceScores) {
    const scores = analysis.tailoring.experienceScores;
    items.sort((a, b) => {
      const scoreA = (a?.id && scores[a.id] != null) ? scores[a.id] : 0;
      const scoreB = (b?.id && scores[b.id] != null) ? scores[b.id] : 0;
      return scoreB - scoreA;
    });
  }

  const itemsHtml = items.map(item => {
    const isHighlighted = analysis?.tailoring?.experienceScores?.[item.id] > 0;
    const highlightClass = isHighlighted ? 'highlighted' : '';

    const bullets = parseDescription(item.description);
    const descriptionHtml = bullets.length > 0
      ? `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : '';

    return `
      <div class="resume-item ${highlightClass}">
        <div class="resume-item-header">
          <span class="resume-item-title">${escapeHtml(item.title || '')}</span>
          <span class="resume-item-date">${escapeHtml(formatDateRange(item.startDate, item.current ? 'Present' : item.endDate))}</span>
        </div>
        <div class="resume-item-subtitle">${escapeHtml(item.company || '')}</div>
        ${item.location ? `<div class="resume-item-location">${escapeHtml(item.location)}</div>` : ''}
        ${descriptionHtml ? `<div class="resume-item-description">${descriptionHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="resume-section">
      <div class="resume-section-title">${escapeHtml(experience.title || 'Experience')}</div>
      ${itemsHtml}
    </div>
  `;
}

/**
 * Render education section
 */
function renderEducation(education) {
  if (!education?.items?.length) return '';

  const itemsHtml = education.items.map(item => {
    const bullets = parseDescription(item.description);
    const descriptionHtml = bullets.length > 0
      ? `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : '';

    return `
      <div class="resume-item">
        <div class="resume-item-header">
          <span class="resume-item-title">${escapeHtml(item.degree || '')}</span>
          <span class="resume-item-date">${escapeHtml(formatDateRange(item.startDate, item.endDate))}</span>
        </div>
        <div class="resume-item-subtitle">${escapeHtml(item.school || '')}${item.gpa ? ` - GPA: ${escapeHtml(item.gpa)}` : ''}</div>
        ${item.location ? `<div class="resume-item-location">${escapeHtml(item.location)}</div>` : ''}
        ${descriptionHtml ? `<div class="resume-item-description">${descriptionHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="resume-section">
      <div class="resume-section-title">${escapeHtml(education.title || 'Education')}</div>
      ${itemsHtml}
    </div>
  `;
}

/**
 * Render projects section
 */
function renderProjects(projects) {
  if (!projects?.items?.length) return '';

  const itemsHtml = projects.items.map(item => {
    const bullets = parseDescription(item.description);
    const descriptionHtml = bullets.length > 0
      ? `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : '';

    const titleWithLink = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.name || '')}</a>`
      : escapeHtml(item.name || '');

    return `
      <div class="resume-item">
        <div class="resume-item-header">
          <span class="resume-item-title">${titleWithLink}</span>
          <span class="resume-item-date">${escapeHtml(formatDateRange(item.startDate, item.endDate))}</span>
        </div>
        ${item.technologies ? `<div class="resume-item-subtitle">${escapeHtml(item.technologies)}</div>` : ''}
        ${descriptionHtml ? `<div class="resume-item-description">${descriptionHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="resume-section">
      <div class="resume-section-title">${escapeHtml(projects.title || 'Projects')}</div>
      ${itemsHtml}
    </div>
  `;
}

/**
 * Render skills section
 */
function renderSkills(skills, analysis) {
  if (!skills?.items?.length) return '';

  const matchingSkills = new Set(
    (analysis?.tailoring?.matchingSkills || []).map(s => s.toLowerCase())
  );

  const highlightSkills = new Set(
    (analysis?.tailoring?.highlightSkills || []).map(s => s.toLowerCase())
  );

  const skillsHtml = skills.items.map(skill => {
    const skillLower = skill.toLowerCase();
    let className = 'resume-skill';

    if (matchingSkills.has(skillLower)) {
      className += ' matched';
    } else if (highlightSkills.has(skillLower)) {
      className += ' highlight';
    }

    return `<span class="${className}">${escapeHtml(skill)}</span>`;
  }).join('');

  return `
    <div class="resume-section">
      <div class="resume-section-title">${escapeHtml(skills.title || 'Skills')}</div>
      <div class="resume-skills">${skillsHtml}</div>
    </div>
  `;
}

/**
 * Render custom section (certifications, etc.)
 */
function renderCustomSection(custom) {
  if (!custom?.items?.length) return '';

  const itemsHtml = custom.items.map(item => {
    const titleWithLink = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title || '')}</a>`
      : escapeHtml(item.title || '');

    return `
      <div class="resume-item">
        <div class="resume-item-header">
          <span class="resume-item-title">${titleWithLink}</span>
          ${item.date ? `<span class="resume-item-date">${escapeHtml(formatDateRange(item.date, null))}</span>` : ''}
        </div>
        ${item.issuer ? `<div class="resume-item-subtitle">${escapeHtml(item.issuer)}</div>` : ''}
        ${item.description ? `<div class="resume-item-description">${escapeHtml(item.description)}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="resume-section">
      <div class="resume-section-title">${escapeHtml(custom.title || 'Certifications')}</div>
      ${itemsHtml}
    </div>
  `;
}

/**
 * Get the preview element for PDF export
 */
export function getPreviewElement() {
  return document.getElementById('resume-preview');
}

/**
 * Get the current page count
 * @returns {number} Always returns 1 (no pagination)
 */
export function getPageCount() {
  return 1;
}

/**
 * Force re-render of the preview
 */
export function refreshPagination() {
  renderPreview();
}
