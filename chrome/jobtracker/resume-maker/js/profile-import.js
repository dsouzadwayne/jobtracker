/**
 * Profile Import Utilities
 * Transforms JobTracker profile data into Resume Maker format
 */

import { JobTrackerDB } from '../../lib/database.js';

/**
 * Get the JobTracker user profile
 * @returns {Promise<Object|null>} The user profile or null
 */
export async function getJobTrackerProfile() {
  await JobTrackerDB.init();
  return JobTrackerDB.getProfile();
}

/**
 * Check if the base resume is empty (needs import)
 * @param {Object} baseResume - The base resume object
 * @returns {boolean} True if resume is empty
 */
export function isBaseResumeEmpty(baseResume) {
  if (!baseResume) return true;

  const p = baseResume.profile || {};
  const hasProfile = p.name || p.email || p.phone;
  const hasExperience = baseResume.experience?.items?.length > 0;
  const hasEducation = baseResume.education?.items?.length > 0;
  const hasSkills = baseResume.skills?.items?.length > 0;

  return !hasProfile && !hasExperience && !hasEducation && !hasSkills;
}

/**
 * Transform JobTracker profile to Resume Maker format
 * @param {Object} jtProfile - JobTracker profile object
 * @returns {Object} Resume Maker formatted data
 */
export function transformProfile(jtProfile) {
  if (!jtProfile) return null;

  const personal = jtProfile.personal || {};

  return {
    profile: transformPersonalInfo(personal),
    experience: {
      title: 'Experience',
      items: transformWorkHistory(jtProfile.workHistory)
    },
    education: {
      title: 'Education',
      items: transformEducation(jtProfile.education)
    },
    skills: {
      title: 'Skills',
      items: transformSkills(jtProfile.skills)
    },
    custom: {
      title: 'Certifications',
      items: transformCertifications(jtProfile.certifications)
    }
  };
}

/**
 * Transform personal info section
 * @param {Object} personal - Personal info from JobTracker
 * @returns {Object} Profile section for resume
 */
function transformPersonalInfo(personal) {
  // Build full name from parts
  const nameParts = [
    personal.firstName,
    personal.middleName,
    personal.lastName
  ].filter(Boolean);

  // Build location from city and state
  const locationParts = [
    personal.address?.city,
    personal.address?.state
  ].filter(Boolean);

  // Get website (prioritize LinkedIn, then portfolio, then website)
  const website = personal.linkedIn || personal.portfolio || personal.website || '';

  return {
    name: nameParts.join(' '),
    email: personal.email || '',
    phone: personal.phone || '',
    location: locationParts.join(', '),
    website: website,
    headline: '',  // User customization - don't overwrite
    summary: ''    // User customization - don't overwrite
  };
}

/**
 * Transform work history to experience items
 * @param {Array} workHistory - Work history from JobTracker
 * @returns {Array} Experience items for resume
 */
function transformWorkHistory(workHistory) {
  if (!Array.isArray(workHistory)) return [];

  return workHistory.map((job, index) => ({
    id: `exp-${index}-${Date.now()}`,
    title: job.title || job.position || '',
    company: job.company || job.employer || '',
    location: job.location || '',
    startDate: formatDate(job.startDate),
    endDate: job.current ? 'Present' : formatDate(job.endDate),
    current: job.current || false,
    description: job.description || job.responsibilities || ''
  }));
}

/**
 * Transform education to education items
 * @param {Array} education - Education from JobTracker
 * @returns {Array} Education items for resume
 */
function transformEducation(education) {
  if (!Array.isArray(education)) return [];

  return education.map((edu, index) => {
    // Combine degree and field of study
    const degreeParts = [
      edu.degree,
      edu.fieldOfStudy || edu.major
    ].filter(Boolean);

    return {
      id: `edu-${index}-${Date.now()}`,
      school: edu.school || edu.institution || '',
      degree: degreeParts.join(' in '),
      location: edu.location || '',
      startDate: formatDate(edu.startDate),
      endDate: formatDate(edu.endDate || edu.graduationDate),
      description: edu.description || edu.activities || ''
    };
  });
}

/**
 * Transform skills object to flat array
 * @param {Object} skills - Skills object from JobTracker
 * @returns {Array} Flat array of skill strings
 */
function transformSkills(skills) {
  if (!skills || typeof skills !== 'object') return [];

  // Flatten all skill arrays into one
  const allSkills = [];

  // Common skill categories in JobTracker profile
  const categories = ['languages', 'frameworks', 'tools', 'soft', 'other', 'technical', 'programming'];

  for (const category of categories) {
    if (Array.isArray(skills[category])) {
      allSkills.push(...skills[category]);
    }
  }

  // Handle case where skills might be stored as a flat array
  if (Array.isArray(skills)) {
    return skills.filter(s => typeof s === 'string');
  }

  // Remove duplicates and empty strings
  return [...new Set(allSkills.filter(s => s && typeof s === 'string'))];
}

/**
 * Transform certifications to custom section items
 * @param {Array} certifications - Certifications from JobTracker
 * @returns {Array} Custom section items for resume
 */
function transformCertifications(certifications) {
  if (!Array.isArray(certifications)) return [];

  return certifications.map((cert, index) => ({
    id: `cert-${index}-${Date.now()}`,
    title: cert.name || cert.title || '',
    subtitle: cert.issuer || cert.organization || '',
    date: formatDate(cert.date || cert.issueDate),
    description: cert.description || ''
  }));
}

/**
 * Format a date string for display
 * @param {string} dateStr - Date string from JobTracker
 * @returns {string} Formatted date string
 */
function formatDate(dateStr) {
  if (!dateStr) return '';

  // If already in a readable format, return as-is
  if (typeof dateStr === 'string' && !/^\d{4}-\d{2}/.test(dateStr)) {
    return dateStr;
  }

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    // Format as "MMM YYYY" (e.g., "Jan 2024")
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Merge imported profile data with existing resume, preserving user customizations
 * @param {Object} currentResume - Current resume data
 * @param {Object} importedData - Data from transformProfile()
 * @returns {Object} Merged resume data
 */
export function mergeWithExisting(currentResume, importedData) {
  if (!importedData) return currentResume;

  return {
    ...currentResume,
    ...importedData,
    // Preserve user customizations in profile
    profile: {
      ...importedData.profile,
      headline: currentResume?.profile?.headline || importedData.profile?.headline || '',
      summary: currentResume?.profile?.summary || importedData.profile?.summary || ''
    },
    // Keep existing projects section (not in JobTracker profile)
    projects: currentResume?.projects || {
      title: 'Projects',
      items: []
    }
  };
}
