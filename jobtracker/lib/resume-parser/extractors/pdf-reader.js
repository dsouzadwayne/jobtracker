/**
 * PDF Reader - Reads PDF files using PDF.js
 * Extracts text items with position, font, and EOL information
 */

const PDFTextReader = {
  _workerConfigured: false,

  async read(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded');
    }

    // Configure worker
    if (!this._workerConfigured) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/vendor/pdf.worker.min.js');
        }
      } catch (e) {
        console.log('Could not configure PDF.js worker:', e);
      }
      this._workerConfigured = true;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let textItems = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Wait for font data
      await page.getOperatorList();
      const commonObjs = page.commonObjs;

      const pageItems = textContent.items.map(item => {
        const x = item.transform ? item.transform[4] : 0;
        const y = item.transform ? item.transform[5] : 0;

        // Get original font name
        let fontName = item.fontName || '';
        try {
          if (commonObjs && item.fontName) {
            const fontObj = commonObjs.get(item.fontName);
            if (fontObj && fontObj.name) {
              fontName = fontObj.name;
            }
          }
        } catch (e) { /* Keep original fontName */ }

        // Fix hyphen issue (pdfjs reads "-" as "-­‐")
        const text = (item.str || '').replace(/-­‐/g, '-');

        return {
          text,
          x,
          y,
          width: item.width || 0,
          height: item.height || 0,
          fontName,
          hasEOL: item.hasEOL || false
        };
      });

      textItems.push(...pageItems);
    }

    // Filter out empty space noise
    textItems = textItems.filter(item => item.hasEOL || item.text.trim() !== '');

    return textItems;
  }
};

if (typeof window !== 'undefined') {
  window.PDFTextReader = PDFTextReader;
}
