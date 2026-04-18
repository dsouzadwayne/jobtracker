# Dashboard.js Modularization Plan

## Overview

The current `dashboard.js` file (~3000 lines) handles all dashboard functionality. This plan outlines how to split it into smaller, focused modules for better maintainability and code organization.

## Current File Structure

The file has these major sections:
- Theme Management (lines 8-77)
- Message Types & State (lines 79-172)
- Core Functions (loadApplications, updateStats, applyFilters, render)
- Application Card/Table Rendering
- Charts (status, timeline, platform, funnel, heatmap, time-status)
- Phase 3: Advanced Analytics (date range filter)
- View Toggle & Table Rendering
- CSV Export
- Navigation (page switching, sidebar)
- Phase 4: Intelligence Panel (goals, insights, recommendations)
- CRM Enhancement (tags, deadlines, interviews, tasks, activities)
- Details Panel

---

## Proposed Module Structure

### 1. `dashboard-core.js` (Main Entry Point)
**Responsibility:** Application initialization, state management, and coordination between modules.

```javascript
// Contents:
- State variables (applications, filteredApplications, selectedAppId, etc.)
- ThemeManager object
- MessageTypes constants
- DOM element initialization
- DOMContentLoaded initialization
- BroadcastChannel setup
- Core utility functions:
  - escapeHtml()
  - formatDate() / formatDateInput() / formatDateTimeInput() / formatTime()
  - capitalizeStatus()
  - sanitizeStatus()
  - detectPlatform()
  - debounce()
  - isValidUrl() / sanitizeUrl()
- loadApplications() / applyFilters()
- showNotification()
- Main render() function (dispatches to view modules)
```

**Exports:** State getters/setters, utility functions, MessageTypes

---

### 2. `dashboard-views.js`
**Responsibility:** Card view, table view rendering, and view switching.

```javascript
// Contents:
- currentView state
- initViewToggle()
- updateViewToggleButtons()
- applyCurrentView()
- toggleView()
- renderTable()
- createAppCard()
- renderTagChips()
- getDeadlineBadge()
- exportToCSV()
```

**Exports:** View functions, createAppCard, renderTable

---

### 3. `dashboard-charts.js`
**Responsibility:** All Chart.js chart rendering and updates.

```javascript
// Contents:
- Chart instance variables (statusChart, timelineChart, etc.)
- STATUS_COLORS, PLATFORM_COLORS constants
- getChartTextColor()
- initCharts()
- renderStatusChart()
- renderTimelineChart()
- renderPlatformChart()
- renderFunnelChart()
- renderFunnelConversions()
- renderHeatmap() (delegates to HeatmapRenderer)
- renderTimeStatusChart()
```

**Exports:** initCharts, individual render functions

---

### 4. `dashboard-analytics.js`
**Responsibility:** Date range filtering and statistics.

```javascript
// Contents:
- currentDateRange state
- initDateRangeFilter()
- applyDateRange()
- updateStats()
```

**Exports:** initDateRangeFilter, applyDateRange, updateStats

---

### 5. `dashboard-intelligence.js`
**Responsibility:** Intelligence panel (goals, insights, recommendations).

```javascript
// Contents:
- currentGoalType state
- setupIntelligencePanel()
- loadIntelligencePanel()
- renderInsights()
- getInsightIcon()
- renderRecommendations()
- getRecommendationIcon()
- handleRecommendationAction()
- renderGoalProgress()
- openGoalModal()
- closeGoalModal()
- handleGoalSubmit()
```

**Exports:** setupIntelligencePanel, loadIntelligencePanel

---

### 6. `dashboard-crm.js`
**Responsibility:** CRM features - tags, deadlines, interviews, tasks, activities.

```javascript
// Contents:
- CRM state (allTags, selectedTags, upcomingInterviews, upcomingTasks)

// Tags & Deadlines
- loadTags()
- renderTagFilter()

// Interviews
- setupInterviewModal()
- loadUpcomingInterviews()
- renderUpcomingInterviews()
- openInterviewModal()
- closeInterviewModal()
- handleInterviewSubmit()

// Tasks
- setupTaskModal()
- loadUpcomingTasks()
- renderUpcomingTasks()
- completeTask()
- openTaskModal()
- closeTaskModal()
- handleTaskSubmit()

// Activities
- loadActivityTimeline()
- renderActivityTimeline()
- getActivityIcon()
- getTimeAgo()

// Setup
- setupCRMFeatures()
```

**Exports:** setupCRMFeatures, loadTags, loadUpcomingInterviews, loadUpcomingTasks, tag/deadline utilities

---

### 7. `dashboard-modals.js`
**Responsibility:** Application modal handling (add/edit applications).

```javascript
// Contents:
- formIsDirty, isSubmitting state
- previouslyFocusedElement, focusTrapHandler
- trapFocus()
- openModal()
- closeModalWithConfirm()
- closeModal()
- handleSubmit()
- handleDelete()
- showFormError() / hideFormError()
- setSubmitState()
- validateFormData()
```

**Exports:** openModal, closeModal, deleteApplication

---

### 8. `dashboard-navigation.js`
**Responsibility:** Page switching, sidebar, details panel.

```javascript
// Contents:
- currentPage state
- setupNavigation()
- switchPage()
- toggleMobileSidebar()
- checkUrlParams()

// Details Panel
- selectApp()
- showDetailsPanel()
- closeDetailsPanel()
- showDetailsOverlay() / hideDetailsOverlay()
- toggleDetailsDescription()
- formatJobDescription()
```

**Exports:** switchPage, selectApp, showDetailsPanel, closeDetailsPanel

---

### 9. `dashboard-keyboard.js`
**Responsibility:** Keyboard shortcuts and navigation.

```javascript
// Contents:
- keyboardShortcutHandler, escapeKeyHandler
- setupKeyboardShortcuts()
- navigateList()
- showKeyboardShortcutsHelp()
```

**Exports:** setupKeyboardShortcuts

---

## Implementation Strategy

### Phase 1: Create Module Files (No Breaking Changes)
1. Create each module file with its functions
2. Keep dashboard.js as the entry point that imports from modules
3. Use ES modules (`import`/`export`)

### Phase 2: Update HTML
```html
<script type="module" src="dashboard.js"></script>
```

### Phase 3: Gradual Migration
1. Start with isolated modules (charts, keyboard) that have minimal dependencies
2. Move to more complex modules (CRM, modals) once patterns are established
3. Keep a shared state module that all modules can access

---

## File Structure After Refactoring

```
pages/
├── dashboard.html
├── dashboard.css
├── dashboard.js              # Main entry point, imports all modules
├── modules/
│   ├── dashboard-core.js     # State, utilities, initialization
│   ├── dashboard-views.js    # Card/table rendering, view toggle
│   ├── dashboard-charts.js   # Chart.js chart rendering
│   ├── dashboard-analytics.js # Date range, stats
│   ├── dashboard-intelligence.js # Goals, insights, recommendations
│   ├── dashboard-crm.js      # Interviews, tasks, activities, tags
│   ├── dashboard-modals.js   # Application modal
│   ├── dashboard-navigation.js # Page switching, details panel
│   └── dashboard-keyboard.js  # Keyboard shortcuts
```

---

## Shared State Pattern

Use a centralized state object that modules can import and modify:

```javascript
// dashboard-state.js
export const state = {
  applications: [],
  filteredApplications: [],
  selectedAppId: null,
  currentView: 'cards',
  currentPage: 'applications',
  // CRM state
  allTags: [],
  selectedTags: [],
  upcomingInterviews: [],
  upcomingTasks: [],
  // Analytics state
  currentDateRange: null,
  // Intelligence state
  currentGoalType: 'weekly',
  // Form state
  formIsDirty: false,
  isSubmitting: false,
  cachedSettings: null
};

// Getter/setter functions for controlled access
export function getApplications() { return state.applications; }
export function setApplications(apps) { state.applications = apps; }
// ... etc
```

---

## Benefits of Modularization

1. **Maintainability:** Smaller files are easier to navigate and modify
2. **Testing:** Isolated modules can be unit tested independently
3. **Code Reuse:** Utilities can be shared across extension pages
4. **Team Collaboration:** Multiple developers can work on different modules
5. **Bundle Optimization:** Only load modules when needed (future lazy loading)
6. **Clear Responsibilities:** Each module has a single, focused purpose

---

## Migration Checklist

- [ ] Create `pages/modules/` directory
- [ ] Create `dashboard-state.js` with shared state
- [ ] Extract `dashboard-keyboard.js` (minimal dependencies)
- [ ] Extract `dashboard-charts.js` (self-contained)
- [ ] Extract `dashboard-analytics.js` (depends on charts)
- [ ] Extract `dashboard-views.js` (depends on state)
- [ ] Extract `dashboard-modals.js` (depends on state)
- [ ] Extract `dashboard-navigation.js` (depends on state, views)
- [ ] Extract `dashboard-intelligence.js` (depends on state, modals)
- [ ] Extract `dashboard-crm.js` (depends on state, modals, navigation)
- [ ] Create `dashboard-core.js` with remaining utilities
- [ ] Update `dashboard.js` to import and coordinate modules
- [ ] Update `dashboard.html` to use `type="module"`
- [ ] Test all functionality
- [ ] Update manifest.json if needed for ES modules
