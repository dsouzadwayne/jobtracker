/**
 * Resume Maker - pdfme Data Mapper
 * Maps resume state data to pdfme input format
 */

/**
 * Format a date string for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Format a date range
 */
function formatDateRange(start, end, current) {
  const startStr = start ? formatDate(start) : '';
  const endStr = current ? 'Present' : (end ? formatDate(end) : '');
  return startStr && endStr ? `${startStr} - ${endStr}` : startStr || endStr;
}

/**
 * Build contact string from profile data
 */
function buildContactString(profile) {
  if (!profile) return '';
  const parts = [
    profile.email,
    profile.phone,
    profile.location,
    profile.website
  ].filter(Boolean);
  return parts.join(' | ');
}

/**
 * Extract link metadata from profile for hyperlink annotations
 * Returns array of objects with text and url properties
 */
function extractContactLinks(profile) {
  if (!profile) return [];

  const links = [];

  // Email link
  if (profile.email) {
    links.push({
      type: 'email',
      text: profile.email,
      url: `mailto:${profile.email}`
    });
  }

  // Website/LinkedIn link
  if (profile.website) {
    const url = profile.website.startsWith('http')
      ? profile.website
      : `https://${profile.website}`;
    links.push({
      type: 'website',
      text: profile.website,
      url: url
    });
  }

  return links;
}

/**
 * Parse bullet points from description text
 */
function parseBulletPoints(text) {
  if (!text) return [];
  return text.split('\n')
    .map(line => line.replace(/^[-\u2022*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Format a section item (experience, education, project, custom)
 */
function formatSectionItem(item, type) {
  const lines = [];

  switch (type) {
    case 'experience':
      if (item.title) {
        const dateStr = formatDateRange(item.startDate, item.endDate, item.current);
        lines.push(dateStr ? `${item.title}  |  ${dateStr}` : item.title);
      }
      if (item.company) lines.push(item.company);
      if (item.location) lines.push(item.location);
      break;

    case 'education':
      if (item.degree) {
        const dateStr = formatDateRange(item.startDate, item.endDate, item.current);
        lines.push(dateStr ? `${item.degree}  |  ${dateStr}` : item.degree);
      }
      if (item.school) lines.push(item.school);
      if (item.location) lines.push(item.location);
      if (item.gpa) lines.push(`GPA: ${item.gpa}`);
      break;

    case 'projects':
      if (item.name) {
        const dateStr = formatDateRange(item.startDate, item.endDate, item.current);
        lines.push(dateStr ? `${item.name}  |  ${dateStr}` : item.name);
      }
      if (item.url) lines.push(item.url);
      if (item.technologies) lines.push(`Technologies: ${item.technologies}`);
      break;

    case 'custom':
      if (item.name || item.title) {
        const dateStr = formatDateRange(item.startDate, item.endDate, item.current) || item.date || '';
        const name = item.name || item.title;
        lines.push(dateStr ? `${name}  |  ${dateStr}` : name);
      }
      if (item.issuer || item.organization) {
        lines.push(item.issuer || item.organization);
      }
      break;
  }

  // Add bullet points from description
  if (item.description) {
    const bullets = parseBulletPoints(item.description);
    bullets.forEach(bullet => {
      lines.push(`  \u2022 ${bullet}`);
    });
  }

  return lines.join('\n');
}

/**
 * Build the main content text from all sections
 * This creates a single formatted text block for the flat template
 */
function buildContentText(resume) {
  const sections = [];

  // Experience
  if (resume.experience?.items?.length) {
    const title = resume.experience.title || 'Experience';
    const items = resume.experience.items
      .map(item => formatSectionItem(item, 'experience'))
      .join('\n\n');
    sections.push(`${title.toUpperCase()}\n${'_'.repeat(50)}\n\n${items}`);
  }

  // Education
  if (resume.education?.items?.length) {
    const title = resume.education.title || 'Education';
    const items = resume.education.items
      .map(item => formatSectionItem(item, 'education'))
      .join('\n\n');
    sections.push(`${title.toUpperCase()}\n${'_'.repeat(50)}\n\n${items}`);
  }

  // Projects
  if (resume.projects?.items?.length) {
    const title = resume.projects.title || 'Projects';
    const items = resume.projects.items
      .map(item => formatSectionItem(item, 'projects'))
      .join('\n\n');
    sections.push(`${title.toUpperCase()}\n${'_'.repeat(50)}\n\n${items}`);
  }

  // Skills
  if (resume.skills?.items?.length) {
    const title = resume.skills.title || 'Skills';
    const skillNames = resume.skills.items
      .map(skill => typeof skill === 'string' ? skill : skill.name)
      .filter(Boolean);
    if (skillNames.length) {
      sections.push(`${title.toUpperCase()}\n${'_'.repeat(50)}\n\n${skillNames.join(', ')}`);
    }
  }

  // Custom/Certifications
  if (resume.custom?.items?.length) {
    const title = resume.custom.title || 'Certifications';
    const items = resume.custom.items
      .map(item => formatSectionItem(item, 'custom'))
      .join('\n\n');
    sections.push(`${title.toUpperCase()}\n${'_'.repeat(50)}\n\n${items}`);
  }

  return sections.join('\n\n\n');
}

/**
 * Build table data for the table schema approach
 * Each row is a section or item
 */
function buildTableData(resume) {
  const rows = [];

  // Experience
  if (resume.experience?.items?.length) {
    const title = resume.experience.title || 'Experience';
    rows.push([`\n${title.toUpperCase()}\n${'_'.repeat(80)}`]);
    resume.experience.items.forEach(item => {
      rows.push([formatSectionItem(item, 'experience')]);
      rows.push(['']); // Spacer row
    });
  }

  // Education
  if (resume.education?.items?.length) {
    const title = resume.education.title || 'Education';
    rows.push([`\n${title.toUpperCase()}\n${'_'.repeat(80)}`]);
    resume.education.items.forEach(item => {
      rows.push([formatSectionItem(item, 'education')]);
      rows.push(['']); // Spacer row
    });
  }

  // Projects
  if (resume.projects?.items?.length) {
    const title = resume.projects.title || 'Projects';
    rows.push([`\n${title.toUpperCase()}\n${'_'.repeat(80)}`]);
    resume.projects.items.forEach(item => {
      rows.push([formatSectionItem(item, 'projects')]);
      rows.push(['']); // Spacer row
    });
  }

  // Skills
  if (resume.skills?.items?.length) {
    const title = resume.skills.title || 'Skills';
    const skillNames = resume.skills.items
      .map(skill => typeof skill === 'string' ? skill : skill.name)
      .filter(Boolean);
    if (skillNames.length) {
      rows.push([`\n${title.toUpperCase()}\n${'_'.repeat(80)}`]);
      rows.push([skillNames.join(', ')]);
      rows.push(['']); // Spacer row
    }
  }

  // Custom/Certifications
  if (resume.custom?.items?.length) {
    const title = resume.custom.title || 'Certifications';
    rows.push([`\n${title.toUpperCase()}\n${'_'.repeat(80)}`]);
    resume.custom.items.forEach(item => {
      rows.push([formatSectionItem(item, 'custom')]);
      rows.push(['']); // Spacer row
    });
  }

  return rows;
}

/**
 * Map resume data to pdfme inputs for the dynamic template
 */
export function mapResumeToInputs(resume) {
  if (!resume) return [{}];

  return [{
    name: resume.profile?.name || '',
    headline: resume.profile?.headline || '',
    contact: buildContactString(resume.profile),
    summary: resume.profile?.summary || '',
    sections: buildTableData(resume)
  }];
}

/**
 * Map resume data to pdfme inputs for the flat template
 */
export function mapResumeToFlatInputs(resume) {
  if (!resume) return [{}];

  return [{
    name: resume.profile?.name || '',
    headline: resume.profile?.headline || '',
    contact: buildContactString(resume.profile),
    summary: resume.profile?.summary || '',
    content: buildContentText(resume)
  }];
}

export {
  formatDate,
  formatDateRange,
  buildContactString,
  extractContactLinks,
  parseBulletPoints,
  formatSectionItem,
  buildContentText,
  buildTableData
};
