/**
 * Resume Maker - PDF Export
 * Generates PDFs using html2canvas + jsPDF for visual fidelity
 */

import { getCurrentResume } from './state.js';
import { showToast } from './utils.js';

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
 * Export resume to PDF using html2canvas + jsPDF
 * Captures the visual preview and converts to PDF
 */
export async function exportToPdf() {
  const resume = getCurrentResume();

  if (!resume) {
    showToast('No resume to export', 'error');
    return;
  }

  const preview = document.getElementById('resume-preview');
  if (!preview) {
    showToast('Preview not available', 'error');
    return;
  }

  // Check if libraries are loaded
  if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
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
    // Store original zoom to restore later
    const originalZoom = preview.style.zoom;

    // Reset zoom for accurate capture (1:1 pixel ratio)
    preview.style.zoom = '1';

    // Apply font smoothing for better text rendering in canvas capture
    const originalFontSmooth = preview.style.fontSmooth;
    const originalWebkitSmoothing = preview.style.webkitFontSmoothing;
    const originalMozSmoothing = preview.style.MozOsxFontSmoothing;
    preview.style.fontSmooth = 'always';
    preview.style.webkitFontSmoothing = 'antialiased';
    preview.style.MozOsxFontSmoothing = 'grayscale';

    // Capture the preview as canvas with high resolution for print quality
    // Scale of 2 gives ~192 DPI (8.5in × 96px/in × 2 = 1632px)
    // Sufficient for print quality while keeping file size reasonable
    const canvas = await html2canvas(preview, {
      scale: 2,                    // 2x resolution for ~200 DPI print quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      letterRendering: true,       // Better text rendering
      allowTaint: false,
      removeContainer: true
    });

    // Restore original styles
    preview.style.zoom = originalZoom;
    preview.style.fontSmooth = originalFontSmooth;
    preview.style.webkitFontSmoothing = originalWebkitSmoothing;
    preview.style.MozOsxFontSmoothing = originalMozSmoothing;

    // Create PDF (US Letter: 8.5 x 11 inches)
    const { jsPDF } = jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'
    });

    // Page dimensions in inches
    const pageWidth = 8.5;
    const pageHeight = 11;

    // Calculate scaling: fit canvas width to page width
    const scale = pageWidth / canvas.width;

    // Calculate how many pixels of canvas height fit on one page
    const pageHeightInCanvasPixels = pageHeight / scale;

    // Slice canvas into pages
    let sourceY = 0;
    let pageNum = 0;

    while (sourceY < canvas.height) {
      if (pageNum > 0) {
        pdf.addPage();
      }

      // Calculate height for this slice (may be less on last page)
      const sliceHeight = Math.min(pageHeightInCanvasPixels, canvas.height - sourceY);

      // Create a temporary canvas for this page slice
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(
        canvas,
        0, sourceY,                    // Source x, y
        canvas.width, sliceHeight,     // Source width, height
        0, 0,                          // Dest x, y
        canvas.width, sliceHeight      // Dest width, height
      );

      // Add this slice to the PDF page using JPEG for smaller file size
      const sliceHeightInInches = sliceHeight * scale;
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.92),  // 92% quality JPEG
        'JPEG',
        0,
        0,
        pageWidth,
        sliceHeightInInches
      );

      sourceY += sliceHeight;
      pageNum++;
    }

    // Download the PDF
    const filename = generateFilename(resume);
    pdf.save(filename);

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
