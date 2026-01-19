# Vendor Libraries

This directory contains third-party libraries used by JobTracker.

## Libraries

### Search & Filtering

#### Fuse.js
Lightweight fuzzy-search library for searching applications.
- **File:** `fuse.min.js`
- **Size:** ~24KB
- **License:** Apache 2.0
- **URL:** https://fusejs.io/

### Data & Storage

#### idb
Tiny Promise wrapper around IndexedDB by Jake Archibald.
- **File:** `idb.min.js`
- **Size:** ~1.2KB
- **License:** ISC
- **URL:** https://github.com/jakearchibald/idb

#### Zod
Runtime schema validation library.
- **File:** `zod.min.js`
- **Size:** ~57KB
- **License:** MIT
- **URL:** https://zod.dev/

### Date Formatting

#### Day.js
Lightweight date manipulation library (Moment.js alternative).
- **Files:** `dayjs.min.js`, `dayjs-relativetime.min.js`
- **Size:** ~2KB (core) + ~1KB (plugin)
- **License:** MIT
- **URL:** https://day.js.org/

### Resume Parsing Libraries

### 1. PDF.js (pdfjs-dist)

Used for parsing PDF files.

**IMPORTANT:** You must use the legacy/browser build (NOT the .mjs ES module build).

**Required Files:**
- `pdf.min.js` - Main library (must expose `pdfjsLib` globally)
- `pdf.worker.min.js` - Web Worker for PDF parsing

**Quick Download (from cdnjs - RECOMMENDED):**
```bash
cd jobtracker/lib/vendor
curl -o pdf.min.js https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
curl -o pdf.worker.min.js https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
```

**Alternative (from unpkg - use legacy build for v4+):**
```bash
curl -o pdf.min.js https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js
curl -o pdf.worker.min.js https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js
```

**Note:** Version 4.x only provides ES module builds. Use version 3.x for browser script compatibility.

### 2. Mammoth.js

Used for parsing DOCX files.

**Download:**
- Go to: https://github.com/mwilliamson/mammoth.js/releases
- Or use npm: `npm install mammoth`

**Required File:**
- `mammoth.browser.min.js` - Browser-ready bundle

**Quick Download (from unpkg):**
```bash
curl -o mammoth.browser.min.js https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js
```

## Installation

1. Download all required files to this directory
2. The extension will automatically load them when the profile page is opened

## Note

These libraries are required for the "Import from Resume" feature. Without them, only TXT file parsing will work (which uses the native FileReader API).
