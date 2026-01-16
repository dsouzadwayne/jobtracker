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
        lastName: nameParts.lastName,
        email: result.profile.email,
        phone: result.profile.phone,
        linkedIn: result.profile.linkedin,
        portfolio: result.profile.url
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
          location: '',
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
        startDate: '',
        endDate: edu.date || '',
        gpa: edu.gpa || ''
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
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeParser = ResumeParser;
}
