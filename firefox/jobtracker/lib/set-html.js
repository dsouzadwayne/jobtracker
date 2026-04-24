/**
 * Safe innerHTML wrapper to consolidate DOM HTML assignments.
 * All call sites use escapeHtml() or DOMPurify for user data.
 */
function setHTML(element, html) {
  element.innerHTML = html;
}
