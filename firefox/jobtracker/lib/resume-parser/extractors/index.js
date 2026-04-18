/**
 * Resume Parser - Main Orchestrator
 * Combines all extraction modules into a single parser
 *
 * Dependencies (must be loaded before this file):
 * - PDFTextReader (pdf-reader.js)
 * - LineGrouper (line-grouper.js)
 * - SectionGrouper (section-grouper.js)
 * - ProfileExtractor (profile-extractor.js)
 * - WorkExtractor (work-extractor.js)
 * - EducationExtractor (education-extractor.js)
 * - SkillsExtractor (skills-extractor.js)
 */

const SmartResumeParser = {
  /**
   * Parse a PDF resume file
   * @param {File} file - PDF file object
   * @returns {Promise<Object>} - Parsed resume data
   */
  async parse(file) {
    console.log('[SmartResumeParser] Starting parse...');

    // Step 1: Read PDF into text items
    const textItems = await PDFTextReader.read(file);
    console.log('[SmartResumeParser] Read', textItems.length, 'text items');

    // Step 2: Group text items into lines
    const lines = LineGrouper.group(textItems);
    console.log('[SmartResumeParser] Grouped into', lines.length, 'lines');

    // Step 3: Group lines into sections
    const sections = SectionGrouper.group(lines);
    console.log('[SmartResumeParser] Found sections:', Object.keys(sections));

    // Step 4: Extract data from each section
    const profile = ProfileExtractor.extract(sections);
    console.log('[SmartResumeParser] Extracted profile:', profile);

    const workExperiences = WorkExtractor.extract(sections);
    console.log('[SmartResumeParser] Extracted', workExperiences.length, 'work experiences');
    console.log('[SmartResumeParser] Work experiences details:');
    workExperiences.forEach((exp, i) => {
      console.log(`  [${i}] jobTitle: "${exp.jobTitle}", company: "${exp.company}", date: "${exp.date}"`);
    });

    const education = EducationExtractor.extract(sections);
    console.log('[SmartResumeParser] Extracted', education.length, 'education entries');

    // Get full text for skills extraction
    const fullText = lines.map(line => line.map(item => item.text).join(' ')).join('\n');
    const skills = SkillsExtractor.extract(sections, fullText);

    return {
      profile,
      workExperiences,
      education,
      skills: skills.raw,
      skillsCategorized: skills.categorized,
      sections
    };
  },

  /**
   * Check if all required modules are loaded
   * @returns {Object} - Status of each module
   */
  checkModules() {
    return {
      PDFTextReader: typeof PDFTextReader !== 'undefined',
      LineGrouper: typeof LineGrouper !== 'undefined',
      SectionGrouper: typeof SectionGrouper !== 'undefined',
      ProfileExtractor: typeof ProfileExtractor !== 'undefined',
      WorkExtractor: typeof WorkExtractor !== 'undefined',
      EducationExtractor: typeof EducationExtractor !== 'undefined',
      SkillsExtractor: typeof SkillsExtractor !== 'undefined',
      pdfjsLib: typeof pdfjsLib !== 'undefined'
    };
  }
};

if (typeof window !== 'undefined') {
  window.SmartResumeParser = SmartResumeParser;
}
