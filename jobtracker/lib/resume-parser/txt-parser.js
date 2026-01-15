/**
 * TXT Parser - Plain text file parsing
 * Uses native FileReader API
 */

const ResumeTXTParser = {
  /**
   * Parse a TXT file and extract text content
   * @param {File} file - The TXT file object
   * @returns {Promise<string>} - Extracted text content
   */
  async parse(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target.result;
        // Clean up the text
        const cleanedText = this.cleanText(text);
        resolve(cleanedText);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read the text file'));
      };

      reader.readAsText(file);
    });
  },

  /**
   * Clean up extracted text
   * @param {string} text - Raw text content
   * @returns {string} - Cleaned text
   */
  cleanText(text) {
    if (!text) return '';

    return text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive blank lines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace from each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Trim overall
      .trim();
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeTXTParser = ResumeTXTParser;
}
