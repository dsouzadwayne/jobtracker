/**
 * JobTracker Activity Heatmap Module
 * Uses ActivityHeatmap library (D3.js) for GitHub-style visualization
 */

// Helper to escape HTML for safe insertion
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Heatmap rendering module
const HeatmapRenderer = {
  // AbortController for event listener cleanup
  _abortController: null,
  // MutationObserver reference for cleanup
  _observer: null,
  // Retry counter for deferred rendering
  _renderRetries: 0,
  _maxRenderRetries: 3,
  /**
   * Render the activity heatmap
   * @param {string} selector - CSS selector for the container
   * @param {Object} dailyCounts - Object with date keys (YYYY-MM-DD) and count values
   */
  render(selector, dailyCounts) {
    const container = document.querySelector(selector);
    if (!container) {
      console.log('Heatmap container not found:', selector);
      return;
    }

    // Abort any existing event listeners from previous render
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Disconnect any existing MutationObserver
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    // Clear existing heatmap and remove any existing tooltip
    container.innerHTML = '';
    const existingGlobalTooltip = document.getElementById('heatmap-tooltip-global');
    if (existingGlobalTooltip) {
      existingGlobalTooltip.remove();
    }

    // Pre-populate all dates for the past year to ensure all cells render
    // This ensures today's date block always appears
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate start: Sunday of current week, then back 52 weeks
    // This matches how GitHub-style heatmaps work
    const startOfRange = new Date(today);
    startOfRange.setDate(startOfRange.getDate() - startOfRange.getDay()); // Sunday of current week
    startOfRange.setDate(startOfRange.getDate() - (52 * 7)); // Back 52 weeks

    // Helper to format date as YYYY-MM-DD in local timezone
    const formatDateLocal = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Build data array with all dates in range (53 weeks)
    const data = [];
    const currentDate = new Date(startOfRange);
    const countsMap = dailyCounts || {};

    while (currentDate <= today) {
      const dateStr = formatDateLocal(currentDate);
      data.push({
        date: new Date(currentDate),
        value: countsMap[dateStr] || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get theme-aware colors
    const isDark = this.isDarkTheme();

    const colorScale = isDark
      ? ['#1e293b', '#3b82f6']  // Dark theme: slate to blue
      : ['#e2e8f0', '#3b82f6']; // Light theme: light gray to blue

    // Create and render the heatmap
    // The IIFE creates: var ActivityHeatmap = { ActivityHeatmap: class }
    // And also sets: window.ActivityHeatmap = class (inside the IIFE)
    // But the var declaration shadows window.ActivityHeatmap after IIFE completes
    let HeatmapClass = null;

    // Try different ways to access the class
    if (typeof ActivityHeatmap !== 'undefined') {
      if (typeof ActivityHeatmap === 'function') {
        HeatmapClass = ActivityHeatmap;
      } else if (ActivityHeatmap && ActivityHeatmap.ActivityHeatmap) {
        HeatmapClass = ActivityHeatmap.ActivityHeatmap;
      }
    }

    if (!HeatmapClass || typeof HeatmapClass !== 'function') {
      console.log('ActivityHeatmap library not loaded. ActivityHeatmap =', ActivityHeatmap);
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Heatmap library not loaded</p>';
      return;
    }

    try {
      // Calculate cell size based on container width
      // 53 weeks in a year, plus margins and row labels
      let containerWidth = container.offsetWidth;

      // If container has no width (not rendered yet), defer rendering
      if (!containerWidth || containerWidth === 0) {
        if (this._renderRetries < this._maxRenderRetries) {
          this._renderRetries++;
          // Use requestAnimationFrame to wait for layout, then retry
          const self = this;
          requestAnimationFrame(() => {
            self.render(selector, dailyCounts);
          });
          return; // Exit and let RAF callback re-render
        } else {
          // Max retries reached, use default width
          console.log('Heatmap: Container still has no width after retries, using default 800px');
          containerWidth = 800;
          this._renderRetries = 0; // Reset for future renders
        }
      } else {
        this._renderRetries = 0; // Reset on successful width detection
      }

      const availableWidth = containerWidth - 60; // Account for margins and labels
      const cellSize = Math.max(8, Math.min(14, Math.floor(availableWidth / 55)));
      const cellPadding = Math.max(1, Math.floor(cellSize / 6));

      const heatmap = new HeatmapClass(data, 'yearly', {
        selector: selector,
        legend: true,
        histogram: false,
        frame: false,
        tooltip: false,
        colors: {
          scale: colorScale,
          separator: isDark ? '#475569' : '#cbd5e1',
          frame: isDark ? '#475569' : '#cbd5e1'
        },
        geometry: {
          square: {
            width: cellSize,
            height: cellSize,
            padding: cellPadding
          },
          margin: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          },
          histogram: {
            box: { padding: 8, height: 50 }
          },
          labels: {
            rows: {
              label: { width: 28 }
            }
          }
        },
        labels: {
          cols: {
            granularity: 'week',
            label: d => {
              const date = new Date(d.date);
              return date.toLocaleDateString('en-US', { month: 'short' });
            },
            display: d => {
              const date = new Date(d.date);
              const endOfWeek = new Date(date);
              endOfWeek.setDate(date.getDate() + 6);
              return endOfWeek.getDate() <= 7;
            }
          },
          rows: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
        }
      });

      heatmap.render();

      // Make the SVG responsive after rendering
      const svg = container.querySelector('svg.activity-heatmap');
      if (svg) {
        const originalWidth = parseFloat(svg.getAttribute('width'));
        const originalHeight = parseFloat(svg.getAttribute('height'));

        if (originalWidth && originalHeight) {
          svg.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
          svg.setAttribute('width', '100%');
          svg.removeAttribute('height');
          svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
        }

        // Remove library's tooltip (positioning is broken with viewBox scaling)
        const existingTooltip = container.querySelector('.heatmap-tooltip');
        if (existingTooltip) {
          existingTooltip.remove();
        }

        // Build date mapping: calculate dates for each cell based on position
        // Start from Sunday of current week, go back 52 weeks to ensure today is included
        const cells = svg.querySelectorAll('.cell');
        const todayDate = new Date();
        todayDate.setHours(23, 59, 59, 999); // End of today

        // Calculate start: go to Sunday of current week, then back 52 weeks
        const startDate = new Date(todayDate);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Sunday of current week
        startDate.setDate(startDate.getDate() - (52 * 7)); // Back 52 weeks

        // Helper to format date as YYYY-MM-DD in local timezone
        const formatLocal = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // Create lookup for daily counts
        const countsLookup = {};
        Object.entries(dailyCounts || {}).forEach(([dateStr, count]) => {
          countsLookup[dateStr] = count;
        });

        // Assign data to each cell based on its position in the grid
        cells.forEach((cell, index) => {
          const weekIndex = Math.floor(index / 7);
          const dayIndex = index % 7;
          const cellDate = new Date(startDate);
          cellDate.setDate(startDate.getDate() + (weekIndex * 7) + dayIndex);

          // Hide future date cells
          if (cellDate > todayDate) {
            cell.style.visibility = 'hidden';
            return;
          }

          const dateStr = formatLocal(cellDate);
          const value = countsLookup[dateStr] || 0;

          cell.setAttribute('data-date', dateStr);
          cell.setAttribute('data-value', value);
        });

        // Create custom tooltip with unique ID for cleanup
        const tooltip = document.createElement('div');
        tooltip.id = 'heatmap-tooltip-global';
        tooltip.className = 'heatmap-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);

        // Add event listeners to cells with abort signal for cleanup
        const abortSignal = signal;
        cells.forEach(cell => {
          cell.addEventListener('mouseenter', (e) => {
            const dateStr = cell.getAttribute('data-date');
            const value = cell.getAttribute('data-value') || '0';

            if (dateStr) {
              const formattedDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const count = parseInt(value, 10);
              const safeDate = escapeHtml(formattedDate);
              tooltip.innerHTML = count === 0
                ? `No applications on ${safeDate}`
                : `<strong>${count}</strong> application${count !== 1 ? 's' : ''} on ${safeDate}`;
              tooltip.style.display = 'block';
            }
          }, { signal: abortSignal });

          cell.addEventListener('mousemove', (e) => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            // Check if tooltip would overflow right edge
            let left;
            if (e.clientX + tooltipRect.width + 15 > viewportWidth) {
              // Position to the left of cursor
              left = e.pageX - tooltipRect.width - 12;
            } else {
              // Position to the right of cursor
              left = e.pageX + 12;
            }

            // Check if tooltip would overflow bottom edge
            let top;
            if (e.clientY - tooltipRect.height - 10 < 0) {
              // Position below cursor
              top = e.pageY + 15;
            } else {
              // Position above cursor
              top = e.pageY - tooltipRect.height - 8;
            }

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
          }, { signal: abortSignal });

          cell.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          }, { signal: abortSignal });
        });

        // Clean up tooltip when container is cleared
        const self = this;
        this._observer = new MutationObserver(() => {
          if (!document.contains(svg)) {
            tooltip.remove();
            if (self._observer) {
              self._observer.disconnect();
              self._observer = null;
            }
          }
        });
        this._observer.observe(container, { childList: true });

        // Also clean up on page unload/navigation
        const cleanupOnUnload = () => {
          tooltip.remove();
          if (self._observer) {
            self._observer.disconnect();
            self._observer = null;
          }
          if (self._abortController) {
            self._abortController.abort();
            self._abortController = null;
          }
        };
        window.addEventListener('pagehide', cleanupOnUnload, { once: true });
        window.addEventListener('beforeunload', cleanupOnUnload, { once: true });
      }
    } catch (error) {
      console.log('Error rendering activity heatmap:', error);
      // Fallback: show simple message
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Unable to load heatmap</p>';
    }
  },

  /**
   * Check if dark theme is active
   * @returns {boolean}
   */
  isDarkTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  /**
   * Get color scale based on current theme
   * @returns {string[]} - Array of two colors [low, high]
   */
  getColorScale() {
    return this.isDarkTheme()
      ? ['#1e293b', '#3b82f6']  // Dark theme
      : ['#e2e8f0', '#3b82f6']; // Light theme
  }
};

// Make available globally for dashboard.js
window.HeatmapRenderer = HeatmapRenderer;
