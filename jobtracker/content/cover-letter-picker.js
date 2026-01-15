/**
 * JobTracker Cover Letter Picker
 * Shows a floating picker to select cover letters during autofill
 */

(function() {
  'use strict';

  if (window.__jobTrackerCoverLetterPickerInitialized) return;
  window.__jobTrackerCoverLetterPickerInitialized = true;

  let pickerContainer = null;
  let currentTargetInput = null;
  let resolveSelection = null;

  // CSS styles for the picker (using CSS variables for theming)
  const pickerStyles = `
    .jt-cover-picker-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .jt-cover-picker {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .jt-cover-picker-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e8e6e3;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .jt-cover-picker-title {
      font-size: 16px;
      font-weight: 600;
      color: #2a2826;
      margin: 0;
    }

    .jt-cover-picker-close {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 6px;
      color: #7a7773;
      transition: all 0.15s ease;
    }

    .jt-cover-picker-close:hover {
      background: #f5f4f2;
      color: #2a2826;
    }

    .jt-cover-picker-list {
      overflow-y: auto;
      flex: 1;
      padding: 8px;
    }

    .jt-cover-picker-empty {
      padding: 40px 20px;
      text-align: center;
      color: #7a7773;
    }

    .jt-cover-picker-item {
      padding: 12px 16px;
      border: 1px solid #e8e6e3;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .jt-cover-picker-item:hover {
      border-color: #5b7c99;
      background: #f7f6f4;
    }

    .jt-cover-picker-item:last-child {
      margin-bottom: 0;
    }

    .jt-cover-picker-item-name {
      font-weight: 500;
      color: #2a2826;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .jt-cover-picker-item-badge {
      font-size: 10px;
      padding: 2px 6px;
      background: #e8eef3;
      color: #5b7c99;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .jt-cover-picker-item-preview {
      font-size: 13px;
      color: #7a7773;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .jt-cover-picker-footer {
      padding: 12px 16px;
      border-top: 1px solid #e8e6e3;
      display: flex;
      justify-content: flex-end;
    }

    .jt-cover-picker-skip {
      padding: 8px 16px;
      background: none;
      border: 1px solid #d4d2cf;
      border-radius: 6px;
      color: #5c5955;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.15s ease;
    }

    .jt-cover-picker-skip:hover {
      background: #f5f4f2;
      border-color: #a8a5a0;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .jt-cover-picker {
        background: #1a1917;
      }

      .jt-cover-picker-header {
        border-color: #3d3b38;
      }

      .jt-cover-picker-title {
        color: #f5f4f2;
      }

      .jt-cover-picker-close {
        color: #a8a5a0;
      }

      .jt-cover-picker-close:hover {
        background: #2e2d2a;
        color: #f5f4f2;
      }

      .jt-cover-picker-empty {
        color: #a8a5a0;
      }

      .jt-cover-picker-item {
        border-color: #3d3b38;
      }

      .jt-cover-picker-item:hover {
        border-color: #7b9cb8;
        background: #242321;
      }

      .jt-cover-picker-item-name {
        color: #f5f4f2;
      }

      .jt-cover-picker-item-badge {
        background: #2a3540;
        color: #7b9cb8;
      }

      .jt-cover-picker-item-preview {
        color: #a8a5a0;
      }

      .jt-cover-picker-footer {
        border-color: #3d3b38;
      }

      .jt-cover-picker-skip {
        border-color: #5c5955;
        color: #a8a5a0;
      }

      .jt-cover-picker-skip:hover {
        background: #2e2d2a;
        border-color: #7a7773;
      }
    }
  `;

  // Inject styles
  function injectStyles() {
    if (document.getElementById('jt-cover-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'jt-cover-picker-styles';
    style.textContent = pickerStyles;
    document.head.appendChild(style);
  }

  // Create picker UI
  function createPicker(coverLetters) {
    injectStyles();

    const overlay = document.createElement('div');
    overlay.className = 'jt-cover-picker-overlay';
    overlay.innerHTML = `
      <div class="jt-cover-picker">
        <div class="jt-cover-picker-header">
          <h3 class="jt-cover-picker-title">Select Cover Letter</h3>
          <button class="jt-cover-picker-close" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="jt-cover-picker-list">
          ${coverLetters.length === 0 ? `
            <div class="jt-cover-picker-empty">
              <p>No cover letters saved.</p>
              <p>Add cover letters in JobTracker settings.</p>
            </div>
          ` : coverLetters.map(cl => `
            <div class="jt-cover-picker-item" data-id="${cl.id}">
              <div class="jt-cover-picker-item-name">
                ${escapeHtml(cl.name)}
                ${cl.isDefault ? '<span class="jt-cover-picker-item-badge">Default</span>' : ''}
              </div>
              <div class="jt-cover-picker-item-preview">${escapeHtml(cl.content.substring(0, 150))}${cl.content.length > 150 ? '...' : ''}</div>
            </div>
          `).join('')}
        </div>
        <div class="jt-cover-picker-footer">
          <button class="jt-cover-picker-skip">Skip</button>
        </div>
      </div>
    `;

    return overlay;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Show picker and return promise that resolves with selected cover letter content
  function showPicker(coverLetters, targetInput) {
    return new Promise((resolve) => {
      currentTargetInput = targetInput;
      resolveSelection = resolve;

      pickerContainer = createPicker(coverLetters);
      document.body.appendChild(pickerContainer);

      // Close button
      pickerContainer.querySelector('.jt-cover-picker-close').addEventListener('click', () => {
        closePicker(null);
      });

      // Skip button
      pickerContainer.querySelector('.jt-cover-picker-skip').addEventListener('click', () => {
        closePicker(null);
      });

      // Overlay click to close
      pickerContainer.addEventListener('click', (e) => {
        if (e.target === pickerContainer) {
          closePicker(null);
        }
      });

      // Cover letter selection
      pickerContainer.querySelectorAll('.jt-cover-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          const selected = coverLetters.find(cl => cl.id === id);
          closePicker(selected?.content || null);
        });
      });

      // ESC to close
      document.addEventListener('keydown', handleEscKey);
    });
  }

  // Handle ESC key
  function handleEscKey(e) {
    if (e.key === 'Escape' && pickerContainer) {
      closePicker(null);
    }
  }

  // Close picker
  function closePicker(selectedContent) {
    document.removeEventListener('keydown', handleEscKey);

    if (pickerContainer && pickerContainer.parentNode) {
      pickerContainer.parentNode.removeChild(pickerContainer);
    }

    pickerContainer = null;
    currentTargetInput = null;

    if (resolveSelection) {
      resolveSelection(selectedContent);
      resolveSelection = null;
    }
  }

  // Listen for cover letter picker trigger
  window.addEventListener('jobtracker:show-cover-letter-picker', async (e) => {
    const { coverLetters, targetInput, callback } = e.detail;

    if (!coverLetters || !targetInput) {
      if (callback) callback(null);
      return;
    }

    const selectedContent = await showPicker(coverLetters, targetInput);

    if (callback) {
      callback(selectedContent);
    }
  });

  // Expose function for direct calls
  window.JobTrackerCoverLetterPicker = {
    show: showPicker
  };

})();
