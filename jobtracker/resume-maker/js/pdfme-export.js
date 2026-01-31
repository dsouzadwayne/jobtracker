/**
 * Resume Maker - PDF Export
 * Generates ATS-friendly PDFs using pdfme (text-based) with clickable hyperlinks via pdf-lib
 */

import { getCurrentResume } from './state.js';
import { showToast } from './utils.js';
import { createFlatResumeTemplate, FONTS, COLORS, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH } from './pdfme-templates.js';
import { mapResumeToFlatInputs, buildContactString, extractContactLinks } from './pdfme-mapper.js';

/**
 * Initialize PDF export button handler
 */
export function initPdfExport() {
  const exportBtn = document.getElementById('export-pdf-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToPdf);
  }
}

/**
 * Generate filename for the PDF
 */
function generateFilename(resume) {
  const profileName = resume?.profile?.name || 'Resume';
  const sanitizedName = profileName.replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date().toISOString().split('T')[0];
  return `${sanitizedName}_Resume_${date}.pdf`;
}

/**
 * Extract link metadata from resume for hyperlink annotation
 * Uses the shared extractContactLinks function from pdfme-mapper
 */
function extractLinkMetadata(resume) {
  return extractContactLinks(resume?.profile);
}

/**
 * Find text position in PDF using pdf-lib
 * This searches for text in the contact line and returns approximate position
 * @param {string} contactString - The full contact string
 * @param {string} searchText - The text to find
 * @param {number} pageWidth - Page width in points
 * @param {number} fontSizePts - Font size in points
 */
function findTextInContactLine(contactString, searchText, pageWidth, fontSizePts) {
  if (!contactString || !searchText) return null;

  const idx = contactString.indexOf(searchText);
  if (idx === -1) return null;

  // Approximate character width for Helvetica (average is ~0.5-0.55 of font size)
  // Use 0.55 for a more conservative estimate with variable-width fonts
  const charWidth = fontSizePts * 0.55;

  // Contact line is centered, so calculate offset from center
  const totalWidth = contactString.length * charWidth;
  const startX = (pageWidth - totalWidth) / 2;

  // Calculate position of the search text
  const textX = startX + (idx * charWidth);
  const textWidth = searchText.length * charWidth;

  return {
    x: textX,
    width: textWidth
  };
}

/**
 * Add hyperlink annotations to PDF using pdf-lib
 */
async function addHyperlinks(pdfBytes, resume) {
  // Check if pdf-lib is available
  if (typeof PDFLib === 'undefined') {
    console.warn('pdf-lib not loaded, skipping hyperlink annotations');
    return pdfBytes;
  }

  const { PDFDocument, PDFName, PDFString, PDFArray, PDFDict } = PDFLib;

  try {
    // Load the generated PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) return pdfBytes;

    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Get link metadata
    const links = extractLinkMetadata(resume);
    if (links.length === 0) return pdfBytes;

    // Build the contact string to find positions
    const contactString = buildContactString(resume.profile);

    // Contact line position (from pdfme-templates.js)
    // Contact is at: y = MARGIN + 20 (mm), centered horizontally
    // Convert mm to points (1 mm = 2.83465 points)
    const mmToPoints = 2.83465;

    // FONTS.contact.size is already in points (9pt), not mm
    const contactFontSizePts = FONTS.contact.size;  // 9 points

    // Contact Y position: convert mm to points, then calculate from bottom of page
    const contactYFromTop = (MARGIN + 20) * mmToPoints;  // mm to points
    const contactY = height - contactYFromTop - (contactFontSizePts * 0.8);  // Adjust for baseline

    // Link height based on font size in points
    const linkHeight = contactFontSizePts * 1.2;  // ~10.8 points

    // Add link annotations for each link
    for (const link of links) {
      // Pass font size in points directly (no conversion needed)
      const pos = findTextInContactLine(contactString, link.text, width, contactFontSizePts);

      if (pos) {
        // Create link annotation using pdf-lib's lower-level API
        const linkAnnotation = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [pos.x, contactY, pos.x + pos.width, contactY + linkHeight],
          Border: [0, 0, 0],
          A: {
            Type: 'Action',
            S: 'URI',
            URI: PDFString.of(link.url),
          },
        });

        // Register the annotation object
        const linkAnnotationRef = pdfDoc.context.register(linkAnnotation);

        // Get or create the Annots array for the page
        const pageDict = firstPage.node;
        const existingAnnots = pageDict.get(PDFName.of('Annots'));

        if (existingAnnots instanceof PDFArray) {
          existingAnnots.push(linkAnnotationRef);
        } else {
          pageDict.set(PDFName.of('Annots'), pdfDoc.context.obj([linkAnnotationRef]));
        }
      }
    }

    // Save and return the modified PDF
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error adding hyperlinks:', error);
    return pdfBytes;
  }
}

/**
 * Export resume to PDF using pdfme (ATS-friendly text-based PDF)
 */
export async function exportToPdf() {
  const resume = getCurrentResume();

  if (!resume) {
    showToast('No resume to export', 'error');
    return;
  }

  // Check if pdfme is loaded
  if (typeof pdfme === 'undefined') {
    showToast('PDF libraries not loaded. Please refresh the page.', 'error');
    return;
  }

  // Show loading state
  const exportBtn = document.getElementById('export-pdf-btn');
  const originalContent = exportBtn ? exportBtn.innerHTML : '';
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.innerHTML = `
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      Generating...
    `;
  }

  try {
    // Create template and map data
    const template = createFlatResumeTemplate();
    const inputs = mapResumeToFlatInputs(resume);

    // Get plugins from pdfme - use lowercase keys matching schema types
    const plugins = {
      text: pdfme.text,
      line: pdfme.line,
      rectangle: pdfme.rectangle,
      image: pdfme.image,
      table: pdfme.table
    };

    // Generate PDF using pdfme
    const pdfBytes = await pdfme.generate({
      template,
      inputs,
      plugins
    });

    // Add hyperlinks using pdf-lib
    const pdfWithLinks = await addHyperlinks(pdfBytes, resume);

    // Convert to blob and download
    const blob = new Blob([pdfWithLinks], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename(resume);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Delay revocation to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('PDF exported successfully', 'success');
  } catch (error) {
    console.error('PDF export failed:', error);
    showToast('Failed to export PDF. Please try again.', 'error');
  } finally {
    // Restore button state
    if (exportBtn && originalContent) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalContent;
    }
  }
}

/**
 * Export resume using print dialog (alternative method - unchanged)
 */
export function printResume() {
  const preview = document.getElementById('resume-preview');
  if (!preview) return;

  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      #resume-preview, #resume-preview * {
        visibility: visible;
      }
      #resume-preview {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        transform: none !important;
        box-shadow: none;
        margin: 0;
        padding: 0.5in;
      }
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = printStyles;
  document.head.appendChild(styleSheet);

  window.print();

  setTimeout(() => {
    document.head.removeChild(styleSheet);
  }, 1000);
}

/**
 * Export resume data as JSON (unchanged)
 */
export function exportAsJson() {
  const resume = getCurrentResume();
  if (!resume) {
    showToast('No resume to export', 'error');
    return;
  }

  const dataStr = JSON.stringify(resume, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `resume_${new Date().toISOString().split('T')[0]}.json`;
  link.click();

  URL.revokeObjectURL(url);
  showToast('Resume data exported', 'success');
}
