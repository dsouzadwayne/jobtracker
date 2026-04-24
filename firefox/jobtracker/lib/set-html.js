/**
 * Safe innerHTML wrapper to consolidate DOM HTML assignments.
 * Sanitizes through DOMPurify before setting innerHTML.
 * All call sites also pre-escape user data with escapeHtml().
 */
function setHTML(element, html) {
  if (typeof DOMPurify !== 'undefined') {
    const clean = DOMPurify.sanitize(html, {
      ADD_TAGS: ['svg', 'path', 'line', 'circle', 'rect', 'polyline', 'polygon', 'use', 'g'],
      ADD_ATTR: [
        'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
        'width', 'height', 'points', 'aria-hidden', 'aria-label', 'role',
        'xmlns', 'transform', 'none', 'data-id', 'data-status', 'data-field',
        'data-value', 'data-page', 'data-tab', 'data-section', 'data-type',
        'data-action', 'data-key', 'data-index', 'data-name', 'data-color',
        'data-level', 'data-date', 'data-count', 'data-format', 'data-sort',
        'data-direction', 'data-range', 'data-url', 'data-source', 'data-target',
        'for', 'type', 'value', 'name', 'placeholder', 'checked', 'disabled',
        'selected', 'readonly', 'multiple', 'min', 'max', 'step', 'maxlength',
        'rows', 'cols', 'colspan', 'rowspan', 'open', 'tabindex', 'autocomplete',
        'spellcheck', 'contenteditable', 'draggable', 'loading', 'decoding',
        'alt', 'src'
      ],
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false
    });
    const range = document.createRange();
    range.selectNodeContents(element);
    range.deleteContents();
    element.append(range.createContextualFragment(clean));
  } else {
    element.textContent = html;
  }
}
