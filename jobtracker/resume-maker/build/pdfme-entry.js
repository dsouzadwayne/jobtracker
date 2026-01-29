/**
 * pdfme browser bundle entry point
 * Exports the essential pdfme functions needed for resume generation
 */

// Core generator
export { generate } from '@pdfme/generator';

// Common utilities and blank PDF template
export { BLANK_PDF } from '@pdfme/common';

// Schema plugins for different content types
export { text, line, rectangle, image, barcodes, table } from '@pdfme/schemas';
