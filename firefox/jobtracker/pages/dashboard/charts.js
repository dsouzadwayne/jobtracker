/**
 * Dashboard Charts Module
 * All Chart.js chart rendering and updates
 */

import { STATUS_COLORS, PLATFORM_COLORS, getCurrentPage, elements } from './state.js';

// Chart instances
let statusChart = null;
let timelineChart = null;
let platformChart = null;
let funnelChart = null;
let timeStatusChart = null;

// Get theme-aware text color
function getChartTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#6b7280';
}

// Initialize charts
export function initCharts(stats) {
  const chartsSection = document.getElementById('charts-section');
  if (!chartsSection) return;

  // Only show charts when there's data and in stats view
  if (stats.total === 0 || getCurrentPage() !== 'stats') {
    chartsSection.classList.add('hidden');
    return;
  }
  chartsSection.classList.remove('hidden');

  renderStatusChart(stats.byStatus);
  renderTimelineChart(stats.weeklyTrend);
  renderPlatformChart(stats.byPlatform);

  // Phase 3 charts
  renderFunnelChart(stats.funnelData);
  renderHeatmap(stats.dailyCounts);
  renderTimeStatusChart(stats.timeInStatus);
}

// Status Distribution Donut Chart
export function renderStatusChart(byStatus) {
  const ctx = document.getElementById('status-chart');
  if (!ctx) return;

  const labels = Object.keys(byStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1));
  const data = Object.values(byStatus);
  const colors = Object.keys(byStatus).map(s => STATUS_COLORS[s] || '#6b7280');

  if (statusChart) statusChart.destroy();

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 12 },
            color: getChartTextColor()
          }
        }
      }
    }
  });
}

// Applications Timeline Line Chart
export function renderTimelineChart(weeklyTrend) {
  const ctx = document.getElementById('timeline-chart');
  if (!ctx) return;

  const labels = weeklyTrend.map(w => w.week);
  const data = weeklyTrend.map(w => w.count);
  const textColor = getChartTextColor();

  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Applications',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        x: {
          ticks: {
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Platform Distribution Bar Chart
export function renderPlatformChart(byPlatform) {
  const ctx = document.getElementById('platform-chart');
  if (!ctx) return;

  // Sort by count descending
  const sorted = Object.entries(byPlatform)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6); // Top 6 platforms

  const labels = sorted.map(([p]) => p.charAt(0).toUpperCase() + p.slice(1));
  const data = sorted.map(([, count]) => count);
  const colors = sorted.map(([p]) => PLATFORM_COLORS[p] || '#6b7280');
  const textColor = getChartTextColor();

  if (platformChart) platformChart.destroy();

  platformChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Application Funnel Chart (Horizontal Bar)
export function renderFunnelChart(funnelData) {
  const ctx = document.getElementById('funnel-chart');
  if (!ctx) return;

  if (!funnelData) {
    return;
  }

  const labels = ['Saved', 'Applied', 'Screening', 'Interview', 'Offer'];
  const data = [
    funnelData.saved,
    funnelData.applied,
    funnelData.screening,
    funnelData.interview,
    funnelData.offer
  ];
  const textColor = getChartTextColor();

  // Gradient colors from light to dark
  const colors = [
    'rgba(59, 130, 246, 0.3)',
    'rgba(59, 130, 246, 0.45)',
    'rgba(59, 130, 246, 0.6)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(59, 130, 246, 1)'
  ];

  if (funnelChart) funnelChart.destroy();

  funnelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // Render conversion rates
  renderFunnelConversions(funnelData);
}

// Render funnel conversion rates
function renderFunnelConversions(funnelData) {
  const container = elements.funnelConversions;
  if (!container) return;

  container.innerHTML = `
    <div class="conversion-item">
      <div class="conversion-rate">${funnelData.appliedToScreening}%</div>
      <div class="conversion-label">Applied → Screening</div>
    </div>
    <div class="conversion-item">
      <div class="conversion-rate">${funnelData.screeningToInterview}%</div>
      <div class="conversion-label">Screening → Interview</div>
    </div>
    <div class="conversion-item">
      <div class="conversion-rate">${funnelData.interviewToOffer}%</div>
      <div class="conversion-label">Interview → Offer</div>
    </div>
  `;
}

// Calendar Heatmap - delegates to HeatmapRenderer module
export function renderHeatmap(dailyCounts) {
  if (window.HeatmapRenderer) {
    window.HeatmapRenderer.render('#activity-heatmap', dailyCounts);
  }
}

// Time-in-Status Chart
export function renderTimeStatusChart(timeInStatus) {
  const ctx = document.getElementById('time-status-chart');
  if (!ctx) return;

  // Check if we have any data
  const hasData = timeInStatus &&
    Object.values(timeInStatus).some(v => v !== null);

  if (!hasData) {
    // Show empty state in the canvas container
    const container = ctx.parentElement;
    if (container && !container.querySelector('.time-status-empty')) {
      ctx.style.display = 'none';
      const emptyState = document.createElement('div');
      emptyState.className = 'time-status-empty';
      emptyState.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>Not enough status history<br>to calculate time data</p>
      `;
      container.appendChild(emptyState);
    }
    return;
  }

  // Remove empty state if it exists
  const container = ctx.parentElement;
  const emptyState = container?.querySelector('.time-status-empty');
  if (emptyState) emptyState.remove();
  ctx.style.display = 'block';

  const labels = ['Saved', 'Applied', 'Screening', 'Interview'];
  const data = [
    timeInStatus.saved || 0,
    timeInStatus.applied || 0,
    timeInStatus.screening || 0,
    timeInStatus.interview || 0
  ];
  const textColor = getChartTextColor();

  // Status-specific colors
  const colors = [
    STATUS_COLORS.saved,
    STATUS_COLORS.applied,
    STATUS_COLORS.screening,
    STATUS_COLORS.interview
  ];

  if (timeStatusChart) timeStatusChart.destroy();

  timeStatusChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Days',
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Average Days',
            color: textColor
          },
          ticks: {
            color: textColor
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.1)'
          }
        },
        y: {
          ticks: {
            color: textColor
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return value !== null ? `${value} day${value !== 1 ? 's' : ''}` : 'No data';
            }
          }
        }
      }
    }
  });
}
