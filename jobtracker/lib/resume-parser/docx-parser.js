/**
 * DOCX Parser - Word document parsing using Mammoth.js
 * Requires mammoth library to be loaded
 */

const ResumeDOCXParser = {
  /**
   * Parse a DOCX file and extract text content
   * @param {File} file - The DOCX file object
   * @returns {Promise<string>} - Extracted text content
   */
  async parse(file) {
    // Check if Mammoth is loaded
    if (typeof mammoth === 'undefined') {
      throw new Error('Mammoth.js library is not loaded. Please ensure mammoth is included.');
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await this.readFileAsArrayBuffer(file);

    // Extract raw text using Mammoth
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });

    if (result.messages && result.messages.length > 0) {
      // Log any warnings (but don't fail)
      console.warn('DOCX parsing warnings:', result.messages);
    }

    // Clean up the text
    return this.cleanText(result.value);
  },

  /**
   * Parse a DOCX file and extract HTML (for structure hints)
   * @param {File} file - The DOCX file object
   * @returns {Promise<Object>} - Object with text and html
   */
  async parseWithHTML(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Mammoth.js library is not loaded.');
    }

    const arrayBuffer = await this.readFileAsArrayBuffer(file);

    // Get both text and HTML
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer: arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
    ]);

    return {
      text: this.cleanText(textResult.value),
      html: htmlResult.value,
      messages: [...(textResult.messages || []), ...(htmlResult.messages || [])]
    };
  },

  /**
   * Read file as ArrayBuffer
   * @param {File} file - File object
   * @returns {Promise<ArrayBuffer>} - File content as ArrayBuffer
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        resolve(event.target.result);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read DOCX file'));
      };

      reader.readAsArrayBuffer(file);
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
      // Remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Clean up tabs
      .replace(/\t+/g, ' ')
      // Normalize spaces
      .replace(/ +/g, ' ')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Trim overall
      .trim();
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumeDOCXParser = ResumeDOCXParser;
}
