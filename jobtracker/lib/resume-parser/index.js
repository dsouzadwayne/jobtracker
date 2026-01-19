/**
 * Resume Parser - Main Orchestrator
 * Detects file type and routes to appropriate parser
 */

const ResumeParser = {
  // Supported file types
  FILE_TYPES: {
    PDF: 'pdf',
    DOCX: 'docx',
    TXT: 'txt'
  },

  /**
   * Parse a resume file and extract structured data
   * @param {File} file - The file object from file input
   * @returns {Promise<Object>} - Extracted resume data
   */
  async parse(file) {
    const fileType = this.detectFileType(file);

    if (!fileType) {
      throw new Error(`Unsupported file type: ${file.name}. Please use PDF, DOCX, or TXT files.`);
    }

    // For PDFs, use SmartResumeParser (better accuracy)
    if (fileType === this.FILE_TYPES.PDF && typeof SmartResumeParser !== 'undefined') {
      return this.parseWithSmartParser(file);
    }

    // Fallback to legacy parser for other file types
    return this.parseWithLegacy(file, fileType);
  },

  /**
   * Parse using SmartResumeParser (for PDFs)
   * @param {File} file - PDF file
   * @returns {Promise<Object>} - Extracted resume data
   */
  async parseWithSmartParser(file) {
    console.log('[ResumeParser] Using SmartResumeParser for PDF');

    const result = await SmartResumeParser.parse(file);

    // Split the name into first/last
    const nameParts = ProfileExtractor.splitName(result.profile.name);

    // Convert to our expected format
    const extractedData = {
      personal: {
        firstName: nameParts.firstName,
        middleName: nameParts.middleName || '',
        lastName: nameParts.lastName,
        email: result.profile.email,
        phone: result.profile.phone,
        linkedIn: result.profile.linkedin,
        github: result.profile.github || '',
        portfolio: result.profile.url,
        location: result.profile.location || ''
      },
      workHistory: result.workExperiences.map(exp => {
        console.log('[ResumeParser] Mapping work experience:', {
          jobTitle: exp.jobTitle,
          company: exp.company,
          mappedTitle: exp.jobTitle
        });
        // Smart bullet point handling:
        // 1. Join all descriptions and strip existing bullet characters
        // 2. Split by action verbs to find logical bullet points
        // 3. Re-add bullet markers properly
        let description = '';
        if (Array.isArray(exp.descriptions) && exp.descriptions.length > 0) {
          // Join all descriptions into one string, stripping bullet characters
          const bulletChars = /[•⋅∙🞄⦁⚫●⬤⚬○■□►▸\-\*]/g;
          let fullText = exp.descriptions
            .map(d => d.replace(bulletChars, ' ').trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          // Action verbs that typically start resume bullet points
          const actionVerbPattern = /(Achieved|Administered|Analyzed|Applied|Assisted|Automated|Built|Collaborated|Completed|Conducted|Coordinated|Created|Delivered|Designed|Developed|Directed|Enhanced|Established|Executed|Generated|Implemented|Improved|Increased|Initiated|Launched|Led|Leveraged|Maintained|Managed|Mentored|Organized|Oversaw|Performed|Planned|Prepared|Presented|Produced|Reduced|Resolved|Revamped|Rigorously|Spearheaded|Streamlined|Supervised|Supported|Tagged|Trained|Transformed|Utilized|Worked|Conceptualized|Developing)/g;

          // Find all positions where action verbs start
          const matches = [...fullText.matchAll(actionVerbPattern)];

          if (matches.length > 0) {
            const bulletPoints = [];
            for (let i = 0; i < matches.length; i++) {
              const start = matches[i].index;
              const end = i < matches.length - 1 ? matches[i + 1].index : fullText.length;
              const point = fullText.slice(start, end).trim();
              if (point.length > 10) { // Skip very short fragments
                bulletPoints.push(point);
              }
            }
            description = bulletPoints.map(b => '• ' + b).join('\n');
          } else {
            // No action verbs found, just use the text as-is
            description = fullText;
          }
        }
        return {
          company: exp.company,
          title: exp.jobTitle,
          location: exp.location || '',
          employmentType: exp.employmentType || '',
          startDate: exp.startDate || '',
          endDate: exp.endDate || '',
          current: exp.current || false,
          description: description
        };
      }),
      education: result.education.map(edu => ({
        school: edu.school,
        degree: edu.degree,
        field: edu.field || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || edu.date || '',
        gpa: edu.gpa || '',
        honors: edu.honors || ''
      })),
      skills: result.skillsCategorized || {
        languages: [],
        frameworks: [],
        tools: [],
        soft: []
      }
    };

    // Normalize to profile schema
    const normalizedData = ResumeDataNormalizer.normalize(extractedData);

    return {
      raw: '[Parsed with SmartResumeParser]',
      sections: result.sections,
      extracted: extractedData,
      normalized: normalizedData
    };
  },

  /**
   * Split full name into first and last name
   * @param {string} name - Full name
   * @returns {Object} - { firstName, lastName }
   */
  splitName(name) {
    if (!name) return { firstName: '', lastName: '' };
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  },

  /**
   * Parse using legacy text-based parser
   * @param {File} file - File to parse
   * @param {string} fileType - Detected file type
   * @returns {Promise<Object>} - Extracted resume data
   */
  async parseWithLegacy(file, fileType) {
    console.log('[ResumeParser] Using legacy parser for', fileType);

    let rawText = '';

    // Extract text based on file type
    switch (fileType) {
      case this.FILE_TYPES.PDF:
        rawText = await ResumePDFParser.parse(file);
        break;
      case this.FILE_TYPES.DOCX:
        rawText = await ResumeDOCXParser.parse(file);
        break;
      case this.FILE_TYPES.TXT:
        rawText = await ResumeTXTParser.parse(file);
        break;
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Could not extract text from the file. Please ensure the file contains readable text.');
    }

    // Detect sections in the resume
    const sections = ResumeSectionDetector.detectSections(rawText);

    // Extract fields from sections
    const extractedData = ResumeFieldExtractor.extractAll(rawText, sections);

    // Normalize to profile schema
    const normalizedData = ResumeDataNormalizer.normalize(extractedData);

    return {
      raw: rawText,
      sections: sections,
      extracted: extractedData,
      normalized: normalizedData
    };
  },

  /**
   * Detect file type from file object
   * @param {File} file - The file object
   * @returns {string|null} - File type constant or null if unsupported
   */
  detectFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeType = file.type.toLowerCase();

    // Check by extension first
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return this.FILE_TYPES.PDF;
    }

    if (extension === 'docx' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.FILE_TYPES.DOCX;
    }

    if (extension === 'txt' || mimeType === 'text/plain') {
      return this.FILE_TYPES.TXT;
    }

    return null;
  },

  /**
   * Get supported file extensions for file input accept attribute
   * @returns {string} - Accept attribute value
   */
  getSupportedExtensions() {
    return '.pdf,.docx,.txt';
  },

  /**
   * Check if libraries are loaded
   * @returns {Object} - Status of each library
   */
  checkLibraries() {
    return {
      pdfjs: typeof pdfjsLib !== 'undefined',
      mammoth: typeof mammoth !== 'undefined'
    };
  },

  /**
   * Enhance parsed resume with AI
   * Uses ML for better entity extraction and skill identification
   * @param {Object} parsedData - Result from parse()
   * @param {Object} aiService - AI service instance
   * @param {Object} fieldSettings - Per-field settings to control which fields get AI enhancement
   * @param {Object} fieldSettings.personal - Personal info field settings
   * @param {Object} fieldSettings.work - Work history field settings
   * @param {Object} fieldSettings.education - Education field settings
   * @param {Object} fieldSettings.skills - Skills field settings
   * @param {boolean} fieldSettings.suggestedTags - Generate tag suggestions
   * @returns {Promise<Object>} - Enhanced resume data
   */
  async enhanceWithAI(parsedData, aiService, fieldSettings = {}) {
    if (!aiService || !parsedData.raw) {
      return parsedData;
    }

    // Build normalized settings with defaults (backwards compatibility)
    const settings = {
      personal: {
        name: fieldSettings.personal?.name ?? true,
        email: fieldSettings.personal?.email ?? true,
        phone: fieldSettings.personal?.phone ?? true,
        location: fieldSettings.personal?.location ?? true,
        links: fieldSettings.personal?.links ?? true
      },
      work: {
        companies: fieldSettings.work?.companies ?? true,
        titles: fieldSettings.work?.titles ?? true,
        locations: fieldSettings.work?.locations ?? true,
        dates: fieldSettings.work?.dates ?? true,
        descriptions: fieldSettings.work?.descriptions ?? true
      },
      education: {
        schools: fieldSettings.education?.schools ?? true,
        degrees: fieldSettings.education?.degrees ?? true,
        fields: fieldSettings.education?.fields ?? true,
        dates: fieldSettings.education?.dates ?? true,
        gpa: fieldSettings.education?.gpa ?? true
      },
      skills: {
        languages: fieldSettings.skills?.languages ?? true,
        frameworks: fieldSettings.skills?.frameworks ?? true,
        tools: fieldSettings.skills?.tools ?? true,
        soft: fieldSettings.skills?.soft ?? true
      },
      suggestedTags: fieldSettings.suggestedTags ?? true
    };

    // Check if any AI enhancement is actually enabled
    const anyFieldEnabled = this.hasAnyFieldEnabled(settings);
    if (!anyFieldEnabled) {
      console.log('[ResumeParser] All AI fields disabled, skipping enhancement');
      return parsedData;
    }

    try {
      console.log('[ResumeParser] Enhancing with AI...', { enabledFields: settings });

      const text = parsedData.raw;
      const aiResult = await aiService.parseResume(text, true);

      // Merge AI extractions with existing data
      const enhanced = { ...parsedData };

      // ==================== PERSONAL INFO ====================
      if (aiResult.entities) {
        // Name extraction via NER
        if (settings.personal.name && !enhanced.extracted.personal?.firstName && aiResult.entities.persons?.length > 0) {
          const nameParts = this.splitName(aiResult.entities.persons[0]);
          enhanced.extracted.personal = enhanced.extracted.personal || {};
          enhanced.extracted.personal.firstName = nameParts.firstName;
          enhanced.extracted.personal.lastName = nameParts.lastName;
        }

        // Email extraction
        if (settings.personal.email && aiResult.emails?.length > 0 && !enhanced.extracted.personal?.email) {
          enhanced.extracted.personal = enhanced.extracted.personal || {};
          enhanced.extracted.personal.email = aiResult.emails[0];
        }

        // Phone extraction
        if (settings.personal.phone && aiResult.phones?.length > 0 && !enhanced.extracted.personal?.phone) {
          enhanced.extracted.personal = enhanced.extracted.personal || {};
          enhanced.extracted.personal.phone = aiResult.phones[0];
        }

        // Location extraction via NER
        if (settings.personal.location && aiResult.entities.locations?.length > 0) {
          enhanced.extracted.personal = enhanced.extracted.personal || {};
          if (!enhanced.extracted.personal.location) {
            enhanced.extracted.personal.location = aiResult.entities.locations[0];
          }
        }

        // Links extraction (LinkedIn, GitHub, portfolio)
        if (settings.personal.links) {
          enhanced.extracted.personal = enhanced.extracted.personal || {};
          if (aiResult.linkedin && !enhanced.extracted.personal.linkedIn) {
            enhanced.extracted.personal.linkedIn = aiResult.linkedin;
          }
          if (aiResult.github && !enhanced.extracted.personal.github) {
            enhanced.extracted.personal.github = aiResult.github;
          }
          if (aiResult.portfolio && !enhanced.extracted.personal.portfolio) {
            enhanced.extracted.personal.portfolio = aiResult.portfolio;
          }
        }
      }

      // ==================== WORK HISTORY ====================
      if (aiResult.entities?.organizations?.length > 0) {
        // Store detected organizations for work history enhancement
        if (settings.work.companies) {
          enhanced.detectedOrganizations = aiResult.entities.organizations;
        }
      }

      // Work locations via NER
      if (settings.work.locations && aiResult.workLocations?.length > 0) {
        enhanced.detectedWorkLocations = aiResult.workLocations;
      }

      // ==================== EDUCATION ====================
      if (aiResult.entities?.organizations?.length > 0 && settings.education.schools) {
        // Filter organizations that look like schools
        enhanced.detectedSchools = aiResult.entities.organizations.filter(org =>
          /university|college|institute|school|academy/i.test(org)
        );
      }

      // ==================== SKILLS ====================
      if (aiResult.skills) {
        enhanced.extracted.skills = enhanced.extracted.skills || {};

        // Languages
        if (settings.skills.languages && aiResult.skills.languages?.length > 0) {
          enhanced.extracted.skills.languages = enhanced.extracted.skills.languages || [];
          for (const skill of aiResult.skills.languages) {
            if (!enhanced.extracted.skills.languages.includes(skill)) {
              enhanced.extracted.skills.languages.push(skill);
            }
          }
        }

        // Frameworks
        if (settings.skills.frameworks && aiResult.skills.frameworks?.length > 0) {
          enhanced.extracted.skills.frameworks = enhanced.extracted.skills.frameworks || [];
          for (const skill of aiResult.skills.frameworks) {
            if (!enhanced.extracted.skills.frameworks.includes(skill)) {
              enhanced.extracted.skills.frameworks.push(skill);
            }
          }
        }

        // Tools
        if (settings.skills.tools && aiResult.skills.tools?.length > 0) {
          enhanced.extracted.skills.tools = enhanced.extracted.skills.tools || [];
          for (const skill of aiResult.skills.tools) {
            if (!enhanced.extracted.skills.tools.includes(skill)) {
              enhanced.extracted.skills.tools.push(skill);
            }
          }
        }

        // Soft skills
        if (settings.skills.soft && aiResult.skills.soft?.length > 0) {
          enhanced.extracted.skills.soft = enhanced.extracted.skills.soft || [];
          for (const skill of aiResult.skills.soft) {
            if (!enhanced.extracted.skills.soft.includes(skill)) {
              enhanced.extracted.skills.soft.push(skill);
            }
          }
        }
      }

      // ==================== SUGGESTED TAGS ====================
      if (settings.suggestedTags && aiResult.suggestedTags?.length > 0) {
        enhanced.suggestedTags = aiResult.suggestedTags;
      }

      // Re-normalize with enhanced data
      enhanced.normalized = ResumeDataNormalizer.normalize(enhanced.extracted);

      console.log('[ResumeParser] AI enhancement complete');
      return enhanced;
    } catch (error) {
      console.log('[ResumeParser] AI enhancement failed:', error);
      return parsedData; // Return original if AI fails
    }
  },

  /**
   * Check if any field in the settings is enabled
   * @param {Object} settings - Field settings object
   * @returns {boolean}
   */
  hasAnyFieldEnabled(settings) {
    // Check personal fields
    if (Object.values(settings.personal).some(v => v)) return true;
    // Check work fields
    if (Object.values(settings.work).some(v => v)) return true;
    // Check education fields
    if (Object.values(settings.education).some(v => v)) return true;
    // Check skills fields
    if (Object.values(settings.skills).some(v => v)) return true;
    // Check suggested tags
    if (settings.suggestedTags) return true;
    return false;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeParser = ResumeParser;
}
