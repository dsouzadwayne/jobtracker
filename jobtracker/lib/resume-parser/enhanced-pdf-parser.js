/**
 * Enhanced PDF Parser
 * Extended PDF.js usage with column detection and improved text flow reconstruction
 *
 * Features:
 * - Multi-column layout detection
 * - Header/section identification
 * - Better text flow reconstruction
 * - Table and list handling
 */

const EnhancedPDFParser = {
  _workerConfigured: false,
  _debug: false,

  /**
   * Configure PDF.js worker
   */
  configureWorker() {
    if (this._workerConfigured) return;

    if (typeof pdfjsLib !== 'undefined') {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/vendor/pdf.worker.min.js');
        } else {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/vendor/pdf.worker.min.js';
        }
      } catch (e) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/vendor/pdf.worker.min.js';
      }
      this._workerConfigured = true;
    }
  },

  /**
   * Parse a PDF file with enhanced layout analysis
   * @param {File} file - The PDF file object
   * @param {Object} options - Parsing options
   * @returns {Promise<Object>} - Extracted content with structure
   */
  async parse(file, options = {}) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded');
    }

    this.configureWorker();

    const {
      detectColumns = true,
      detectSections = true,
      preserveFormatting = false
    } = options;

    const arrayBuffer = await this.readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pages = [];
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      const pageData = await this.processPage(content, viewport, {
        detectColumns,
        detectSections,
        preserveFormatting,
        pageNumber: i
      });

      pages.push(pageData);
    }

    // Merge pages
    const result = this.mergePages(pages);

    return {
      text: result.text,
      sections: result.sections,
      columns: result.columnCount,
      pageCount: numPages,
      metadata: {
        hasMultipleColumns: result.columnCount > 1,
        sectionCount: result.sections.length
      }
    };
  },

  /**
   * Process a single page with layout analysis
   */
  async processPage(content, viewport, options) {
    if (!content || !content.items) {
      return { text: '', columns: [], sections: [], columnCount: 1 };
    }

    // Extract items with position info
    const items = content.items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        text: item.str,
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        width: item.width || 0,
        height: item.height || Math.abs(item.transform?.[0] || 12),
        fontSize: Math.abs(item.transform?.[0] || 12)
      }));

    if (items.length === 0) {
      return { text: '', columns: [], sections: [], columnCount: 1 };
    }

    // Detect columns
    let columnCount = 1;
    let columns = [items];

    if (options.detectColumns) {
      const columnResult = this.detectColumns(items, viewport);
      columns = columnResult.columns;
      columnCount = columnResult.columnCount;
    }

    // Process each column
    const processedColumns = columns.map(columnItems =>
      this.processColumn(columnItems, options)
    );

    // Detect sections
    let sections = [];
    if (options.detectSections) {
      sections = this.detectSections(items);
    }

    // Merge column text
    const text = processedColumns
      .map(col => col.text)
      .filter(t => t)
      .join('\n\n');

    return {
      text,
      columns: processedColumns,
      sections,
      columnCount
    };
  },

  /**
   * Detect column layout in page
   */
  detectColumns(items, viewport) {
    if (!items || items.length < 10) {
      return { columns: [items], columnCount: 1 };
    }

    const pageWidth = viewport?.width || 612; // Default letter width
    const pageCenter = pageWidth / 2;

    // Analyze X distribution
    const xPositions = items.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const xRange = maxX - minX;

    // Count items in left vs right half
    let leftCount = 0;
    let rightCount = 0;
    const leftItems = [];
    const rightItems = [];

    for (const item of items) {
      if (item.x + item.width / 2 < pageCenter) {
        leftCount++;
        leftItems.push(item);
      } else {
        rightCount++;
        rightItems.push(item);
      }
    }

    // Check for gap in the middle
    const hasGap = this.detectColumnGap(items, pageCenter, xRange);

    // Two-column detection criteria
    const isLikelyTwoColumn =
      hasGap &&
      leftCount > 5 &&
      rightCount > 5 &&
      Math.abs(leftCount - rightCount) < Math.max(leftCount, rightCount) * 0.5;

    if (isLikelyTwoColumn) {
      return {
        columns: [leftItems, rightItems],
        columnCount: 2
      };
    }

    return { columns: [items], columnCount: 1 };
  },

  /**
   * Detect gap between columns
   */
  detectColumnGap(items, center, xRange) {
    const gapThreshold = xRange * 0.1;
    const nearCenter = items.filter(item =>
      Math.abs((item.x + item.width / 2) - center) < gapThreshold
    );

    // If very few items near center, likely a gap
    return nearCenter.length < items.length * 0.05;
  },

  /**
   * Process items in a single column
   */
  processColumn(items, options) {
    // Sort by Y (descending) then X
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.x - b.x;
    });

    // Group into lines
    const lines = this.groupIntoLines(sorted);

    // Join lines
    const text = lines
      .map(line => line.join(' ').trim())
      .filter(l => l)
      .join('\n');

    return { text, lines };
  },

  /**
   * Group sorted items into lines
   */
  groupIntoLines(items) {
    if (items.length === 0) return [];

    const lines = [];
    let currentLine = [items[0].text];
    let lastY = items[0].y;

    const avgHeight = items.reduce((sum, i) => sum + i.height, 0) / items.length;
    const lineThreshold = avgHeight * 0.8;

    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      const yDiff = Math.abs(item.y - lastY);

      if (yDiff > lineThreshold) {
        lines.push(currentLine);
        currentLine = [item.text];
        lastY = item.y;
      } else {
        currentLine.push(item.text);
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  },

  /**
   * Detect sections/headers in the document
   */
  detectSections(items) {
    const sections = [];

    // Find potential headers (larger font size, standalone lines)
    const avgFontSize = items.reduce((sum, i) => sum + i.fontSize, 0) / items.length;
    const headerThreshold = avgFontSize * 1.2;

    // Common section headers in resumes
    const sectionKeywords = [
      'experience', 'work experience', 'employment', 'professional experience',
      'education', 'academic', 'qualifications',
      'skills', 'technical skills', 'competencies',
      'projects', 'portfolio',
      'certifications', 'certificates', 'licenses',
      'summary', 'objective', 'profile', 'about',
      'languages', 'interests', 'hobbies',
      'references', 'awards', 'achievements', 'publications'
    ];

    for (const item of items) {
      const text = item.text.toLowerCase().trim();

      // Check if it's a section header
      const isLargerFont = item.fontSize >= headerThreshold;
      const matchesKeyword = sectionKeywords.some(kw =>
        text === kw || text.startsWith(kw + ':') || text.startsWith(kw + ' ')
      );

      if ((isLargerFont || matchesKeyword) && text.length < 50) {
        sections.push({
          title: item.text.trim(),
          y: item.y,
          fontSize: item.fontSize,
          isLargerFont,
          matchesKeyword
        });
      }
    }

    // Sort by Y position (top to bottom)
    sections.sort((a, b) => b.y - a.y);

    return sections;
  },

  /**
   * Merge multiple pages
   */
  mergePages(pages) {
    const allSections = [];
    const texts = [];
    let maxColumns = 1;

    for (const page of pages) {
      texts.push(page.text);
      allSections.push(...(page.sections || []));
      maxColumns = Math.max(maxColumns, page.columnCount || 1);
    }

    return {
      text: texts.join('\n\n---\n\n'),
      sections: allSections,
      columnCount: maxColumns
    };
  },

  /**
   * Extract text with reading order correction
   * Better handles multi-column layouts
   */
  async extractWithReadingOrder(file) {
    const result = await this.parse(file, {
      detectColumns: true,
      detectSections: true
    });

    return {
      text: this.cleanText(result.text),
      sections: result.sections,
      hasMultipleColumns: result.columns > 1,
      pageCount: result.pageCount
    };
  },

  /**
   * Read file as ArrayBuffer
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => reject(new Error('Failed to read PDF file'));
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Clean extracted text
   */
  cleanText(text) {
    if (!text) return '';

    return text
      .replace(/[•·■□▪▸►]/g, '- ')
      .replace(/[–—]/g, '-')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  /**
   * Detect if PDF is a scanned image (needs OCR)
   * @param {File} file - PDF file
   * @returns {Promise<boolean>} - True if scanned/image-based
   */
  async isScannedPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      return false;
    }

    this.configureWorker();

    try {
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      // Check first page
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();

      // If very few text items, likely scanned
      const textItems = content.items.filter(item => item.str && item.str.trim());

      // Also check if page has operators (images)
      const ops = await page.getOperatorList();
      const hasImages = ops.fnArray.some(fn =>
        fn === pdfjsLib.OPS.paintImageXObject ||
        fn === pdfjsLib.OPS.paintInlineImageXObject
      );

      // Scanned if: few text items AND has images
      return textItems.length < 10 && hasImages;

    } catch (error) {
      console.warn('[EnhancedPDFParser] Scan detection failed:', error.message);
      return false;
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EnhancedPDFParser = EnhancedPDFParser;
}

export { EnhancedPDFParser };
