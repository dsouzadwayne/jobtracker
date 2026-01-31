/**
 * Resume Maker - pdfme Template Definitions
 * Defines the PDF template structure for resume generation
 */

// US Letter size in mm (8.5 x 11 inches)
const PAGE_WIDTH = 215.9;
const PAGE_HEIGHT = 279.4;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

// Typography settings
const FONTS = {
  name: { size: 20, lineHeight: 1.2 },
  headline: { size: 11, lineHeight: 1.3 },
  contact: { size: 9, lineHeight: 1.3 },
  sectionTitle: { size: 12, lineHeight: 1.4 },
  itemTitle: { size: 11, lineHeight: 1.3 },
  itemSubtitle: { size: 10, lineHeight: 1.3 },
  body: { size: 10, lineHeight: 1.4 },
  small: { size: 9, lineHeight: 1.3 }
};

// Colors
const COLORS = {
  primary: '#000000',
  secondary: '#333333',
  muted: '#666666',
  link: '#0066cc'
};

/**
 * Create a text schema element
 */
function textSchema(name, x, y, width, height, options = {}) {
  return {
    name,
    type: 'text',
    position: { x, y },
    width,
    height,
    fontSize: options.fontSize || FONTS.body.size,
    lineHeight: options.lineHeight || FONTS.body.lineHeight,
    alignment: options.alignment || 'left',
    fontColor: options.color || COLORS.primary,
    fontName: options.bold ? 'Helvetica-Bold' : 'Helvetica'
  };
}

/**
 * Create a line schema element (for section dividers)
 */
function lineSchema(name, x, y, width) {
  return {
    name,
    type: 'line',
    position: { x, y },
    width,
    height: 0.5,
    color: COLORS.muted
  };
}

/**
 * Calculate dynamic template based on resume content
 * Returns template with schemas positioned based on actual content
 */
export function createResumeTemplate(resume) {
  const schemas = [];
  let currentY = MARGIN;

  // Header Section
  if (resume?.profile?.name) {
    schemas.push(textSchema('name', MARGIN, currentY, CONTENT_WIDTH, 8, {
      fontSize: FONTS.name.size,
      alignment: 'center',
      bold: true
    }));
    currentY += 10;
  }

  if (resume?.profile?.headline) {
    schemas.push(textSchema('headline', MARGIN, currentY, CONTENT_WIDTH, 5, {
      fontSize: FONTS.headline.size,
      alignment: 'center',
      color: COLORS.secondary
    }));
    currentY += 7;
  }

  // Contact info
  schemas.push(textSchema('contact', MARGIN, currentY, CONTENT_WIDTH, 4, {
    fontSize: FONTS.contact.size,
    alignment: 'center',
    color: COLORS.muted
  }));
  currentY += 6;

  // Summary
  if (resume?.profile?.summary) {
    schemas.push(textSchema('summary', MARGIN, currentY, CONTENT_WIDTH, 20, {
      fontSize: FONTS.body.size
    }));
    currentY += 22;
  }

  // Dynamic content sections - using table schema for variable-length content
  // This is where pdfme's table schema handles automatic page breaks
  schemas.push({
    name: 'sections',
    type: 'table',
    position: { x: MARGIN, y: currentY },
    width: CONTENT_WIDTH,
    height: PAGE_HEIGHT - currentY - MARGIN,
    // Table configuration for borderless cells
    showHead: false,
    headStyles: { fontSize: 0, cellPadding: 0 },
    bodyStyles: {
      fontSize: FONTS.body.size,
      lineHeight: FONTS.body.lineHeight,
      cellPadding: { top: 2, right: 0, bottom: 2, left: 0 },
      borderWidth: 0
    },
    columnStyles: {
      0: { width: CONTENT_WIDTH }
    },
    tableStyles: {
      borderWidth: 0
    }
  });

  return {
    basePdf: {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      padding: [MARGIN, MARGIN, MARGIN, MARGIN]
    },
    schemas: [schemas]
  };
}

/**
 * Create a simpler flat template that uses text schemas throughout
 * This approach gives more control over layout but requires content-aware positioning
 */
export function createFlatResumeTemplate() {
  // Use BLANK_PDF from pdfme bundle - required for generate() to work
  const pdfmeGlobal = typeof window !== 'undefined' ? window.pdfme : null;
  if (!pdfmeGlobal?.BLANK_PDF) {
    throw new Error('pdfme BLANK_PDF not available. Make sure pdfme is loaded.');
  }

  return {
    basePdf: pdfmeGlobal.BLANK_PDF,
    schemas: [[
      // Header - Name
      {
        name: 'name',
        type: 'text',
        position: { x: MARGIN, y: MARGIN },
        width: CONTENT_WIDTH,
        height: 10,
        fontSize: FONTS.name.size,
        alignment: 'center',
        fontColor: COLORS.primary
      },
      // Headline
      {
        name: 'headline',
        type: 'text',
        position: { x: MARGIN, y: MARGIN + 12 },
        width: CONTENT_WIDTH,
        height: 6,
        fontSize: FONTS.headline.size,
        alignment: 'center',
        fontColor: COLORS.secondary
      },
      // Contact
      {
        name: 'contact',
        type: 'text',
        position: { x: MARGIN, y: MARGIN + 20 },
        width: CONTENT_WIDTH,
        height: 5,
        fontSize: FONTS.contact.size,
        alignment: 'center',
        fontColor: COLORS.muted
      },
      // Summary
      {
        name: 'summary',
        type: 'text',
        position: { x: MARGIN, y: MARGIN + 28 },
        width: CONTENT_WIDTH,
        height: 30,
        fontSize: FONTS.body.size,
        alignment: 'left',
        fontColor: COLORS.primary
      },
      // Main content (all sections combined)
      {
        name: 'content',
        type: 'text',
        position: { x: MARGIN, y: MARGIN + 60 },
        width: CONTENT_WIDTH,
        height: PAGE_HEIGHT - MARGIN * 2 - 60,
        fontSize: FONTS.body.size,
        alignment: 'left',
        fontColor: COLORS.primary
      }
    ]]
  };
}

export { FONTS, COLORS, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH };
