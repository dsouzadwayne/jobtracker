/**
 * PDF Parser - PDF file parsing using PDF.js
 * Requires pdfjs-dist library to be loaded
 */

const ResumePDFParser = {
  _workerConfigured: false,
  _debug: false, // Set to true to log extraction details

  /**
   * Configure PDF.js worker (must be called before parsing)
   */
  configureWorker() {
    if (this._workerConfigured) return;

    if (typeof pdfjsLib !== 'undefined') {
      // Set the worker source URL for the Chrome extension
      // Try chrome.runtime.getURL for extension context, fallback for other contexts
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/vendor/pdf.worker.min.js');
        } else {
          // Fallback for non-extension contexts (e.g., testing)
          pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/vendor/pdf.worker.min.js';
        }
      } catch (e) {
        // If chrome.runtime is not available, use relative path
        pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/vendor/pdf.worker.min.js';
      }
      this._workerConfigured = true;
    }
  },

  /**
   * Parse a PDF file and extract text content
   * @param {File} file - The PDF file object
   * @returns {Promise<string>} - Extracted text content
   */
  async parse(file) {
    // Check if PDF.js is loaded
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded. Please ensure pdfjs-dist is included.');
    }

    // Configure worker before parsing
    this.configureWorker();

    // Read file as ArrayBuffer
    const arrayBuffer = await this.readFileAsArrayBuffer(file);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    // Extract text from all pages
    const textContent = [];
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Extract text items and join them
      const pageText = this.extractTextFromContent(content);
      textContent.push(pageText);
    }

    // Join pages with double newline
    const fullText = textContent.join('\n\n');

    // Clean up the text
    return this.cleanText(fullText);
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
        reject(new Error('Failed to read PDF file'));
      };

      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Extract text from PDF.js text content object
   * Uses position-based sorting to ensure correct visual reading order
   * @param {Object} content - PDF.js text content
   * @returns {string} - Extracted text
   */
  extractTextFromContent(content) {
    if (!content || !content.items) return '';

    // Primary method: Position-based extraction (respects visual layout)
    const positionResult = this.extractTextByPosition(content);

    if (this._debug) {
      // Also try other methods for comparison
      const eolResult = this.extractByEOL(content);
      const rawResult = this.extractRaw(content);

      console.log('=== PDF Parser Debug ===');
      console.log('Total items from PDF.js:', content.items.length);
      console.log('---');
      console.log('Position-based lines:', positionResult.split('\n').length);
      console.log('EOL-based lines:', eolResult.split('\n').length);
      console.log('Raw lines:', rawResult.split('\n').length);
      console.log('---');
      console.log('Position Result (first 1000 chars):');
      console.log(positionResult.substring(0, 1000));
      console.log('---');
      console.log('EOL Result (first 1000 chars):');
      console.log(eolResult.substring(0, 1000));
      console.log('---');
      console.log('Raw Result (first 1000 chars):');
      console.log(rawResult.substring(0, 1000));
    }

    return positionResult;
  },

  /**
   * Extract text using EOL markers from PDF.js
   * @param {Object} content - PDF.js text content
   * @returns {string} - Extracted text
   */
  extractByEOL(content) {
    const items = content.items.filter(item => item.str !== undefined);
    if (items.length === 0) return '';

    // Group items into lines using EOL markers
    const rawLines = [];
    let currentLineItems = [];

    for (const item of items) {
      currentLineItems.push({
        text: item.str,
        x: item.transform ? item.transform[4] : 0,
        width: item.width || 0
      });

      if (item.hasEOL) {
        if (currentLineItems.length > 0) {
          rawLines.push([...currentLineItems]);
        }
        currentLineItems = [];
      }
    }

    // Don't forget the last line
    if (currentLineItems.length > 0) {
      rawLines.push(currentLineItems);
    }

    // Calculate typical character width for merging
    const typicalCharWidth = this.getTypicalCharWidth(
      items.map(item => ({
        text: item.str,
        width: item.width || 0,
        height: item.height || 12
      }))
    );

    // Merge adjacent items within each line and convert to text
    const textLines = rawLines.map(lineItems => {
      const merged = this.mergeLineItems(lineItems, typicalCharWidth);
      return merged.map(item => item.text).join(' ').trim();
    }).filter(line => line.length > 0);

    return textLines.join('\n');
  },

  /**
   * Calculate typical character width based on most common font
   * @param {Array} items - Text items
   * @returns {number} - Typical character width
   */
  getTypicalCharWidth(items) {
    // Group by approximate height (font size)
    const heightGroups = {};
    for (const item of items) {
      if (!item.text || item.width <= 0) continue;
      const heightKey = Math.round(item.height);
      if (!heightGroups[heightKey]) {
        heightGroups[heightKey] = { totalWidth: 0, totalChars: 0 };
      }
      heightGroups[heightKey].totalWidth += item.width;
      heightGroups[heightKey].totalChars += item.text.length;
    }

    // Find the height with most characters (most common font size)
    let maxChars = 0;
    let typicalWidth = 6; // Default

    for (const [height, data] of Object.entries(heightGroups)) {
      if (data.totalChars > maxChars && data.totalChars > 0) {
        maxChars = data.totalChars;
        typicalWidth = data.totalWidth / data.totalChars;
      }
    }

    return typicalWidth;
  },

  /**
   * Merge adjacent items within a line if they're close together
   * This fixes fragmented text from PDFs
   * @param {Array} lineItems - Items in a single line
   * @param {number} typicalCharWidth - Typical character width
   * @returns {Array} - Merged items
   */
  mergeLineItems(lineItems, typicalCharWidth) {
    if (lineItems.length <= 1) return lineItems;

    // Sort by X position within the line
    const sorted = [...lineItems].sort((a, b) => a.x - b.x);

    const merged = [{ ...sorted[0] }];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      // Calculate gap between items
      const gap = current.x - (last.x + last.width);

      // Merge if gap is small enough (within 1.5x typical char width)
      if (gap <= typicalCharWidth * 1.5 && gap >= -typicalCharWidth * 0.5) {
        // Determine if we need a space
        const needsSpace = this.needsSpaceBetween(last.text, current.text, gap, typicalCharWidth);
        last.text = last.text + (needsSpace ? ' ' : '') + current.text;
        last.width = (current.x + current.width) - last.x;
      } else {
        // Too far apart, keep as separate item
        merged.push({ ...current });
      }
    }

    return merged;
  },

  /**
   * Determine if a space is needed between two text segments
   * @param {string} left - Left text
   * @param {string} right - Right text
   * @param {number} gap - Gap between items
   * @param {number} typicalCharWidth - Typical character width
   * @returns {boolean} - Whether to add space
   */
  needsSpaceBetween(left, right, gap, typicalCharWidth) {
    if (!left || !right) return false;

    // If gap is larger than half a char width, add space
    if (gap > typicalCharWidth * 0.4) return true;

    // Don't add space after opening brackets
    if (/[(\[{]$/.test(left)) return false;

    // Don't add space before closing brackets/punctuation
    if (/^[)\]},.:;!?]/.test(right)) return false;

    // Don't add space between word fragments (both alphanumeric)
    if (/[a-zA-Z]$/.test(left) && /^[a-zA-Z]/.test(right) && gap < typicalCharWidth * 0.3) {
      return false;
    }

    return false;
  },

  /**
   * Position-based extraction - sorts by Y then X coordinates
   * @param {Object} content - PDF.js text content
   * @returns {string} - Extracted text
   */
  extractTextByPosition(content) {
    // Extract items with position info
    const items = content.items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        text: item.str,
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        width: item.width || 0,
        height: item.height || (item.transform ? Math.abs(item.transform[0]) : 12)
      }));

    if (items.length === 0) return '';

    // Calculate average font height for line threshold
    const avgHeight = items.reduce((sum, i) => sum + i.height, 0) / items.length || 12;
    const lineThreshold = Math.max(avgHeight * 0.8, 8);

    // Sort by Y (descending - PDF Y starts at bottom), then X
    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > lineThreshold) return yDiff;
      return a.x - b.x;
    });

    return this.groupIntoLines(items, lineThreshold);
  },

  /**
   * Raw extraction - just concatenates text in PDF.js order
   * Useful for debugging or when other methods fail
   * @param {Object} content - PDF.js text content
   * @returns {string} - Extracted text
   */
  extractRaw(content) {
    const lines = [];
    let currentLine = [];

    for (const item of content.items) {
      if (item.str) {
        currentLine.push(item.str);
      }
      if (item.hasEOL) {
        lines.push(currentLine.join(''));
        currentLine = [];
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine.join(''));
    }

    return lines.join('\n');
  },


  /**
   * Group sorted items into lines of text (for position-based fallback)
   * @param {Array} items - Sorted text items
   * @param {number} lineThreshold - Y-difference threshold for line breaks
   * @returns {string} - Text with line breaks
   */
  groupIntoLines(items, lineThreshold = 8) {
    if (items.length === 0) return '';

    const lines = [];
    let currentLine = [items[0].text];
    let lastY = items[0].y;
    let lastX = items[0].x + items[0].width;

    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      const yDiff = Math.abs(item.y - lastY);

      if (yDiff > lineThreshold) {
        // New line
        const lineText = currentLine.join(' ').trim();
        if (lineText) {
          lines.push(lineText);
        }
        currentLine = [item.text];
        lastY = item.y;
        lastX = item.x + item.width;
      } else {
        // Same line
        const gap = item.x - lastX;
        if (gap > 10) {
          currentLine.push(' ' + item.text);
        } else {
          currentLine.push(item.text);
        }
        lastX = item.x + item.width;
      }
    }

    // Add final line
    const lastLineText = currentLine.join(' ').trim();
    if (lastLineText) {
      lines.push(lastLineText);
    }

    return lines.map(line => line.replace(/\s+/g, ' ').trim()).join('\n');
  },


  /**
   * Clean up extracted text
   * @param {string} text - Raw text content
   * @returns {string} - Cleaned text
   */
  cleanText(text) {
    if (!text) return '';

    return text
      // Fix bullet points and special characters first
      .replace(/[•·■□▪▸►]/g, '- ')
      // Normalize dashes
      .replace(/[–—]/g, '-')
      // Normalize horizontal whitespace (spaces/tabs) but preserve newlines
      .replace(/[^\S\n]+/g, ' ')
      // Remove trailing spaces on each line
      .replace(/ +\n/g, '\n')
      // Remove leading spaces on each line
      .replace(/\n +/g, '\n')
      // Limit consecutive newlines to max 2
      .replace(/\n{3,}/g, '\n\n')
      // Clean up
      .trim();
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ResumePDFParser = ResumePDFParser;

  // Debug helper - call from console: enableResumeParserDebug()
  window.enableResumeParserDebug = () => {
    ResumePDFParser._debug = true;
    console.log('Resume parser debug mode enabled. Upload a PDF to see extraction details.');
  };

  window.disableResumeParserDebug = () => {
    ResumePDFParser._debug = false;
    console.log('Resume parser debug mode disabled.');
  };
}
