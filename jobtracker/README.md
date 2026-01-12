# JobTracker - Job Application Tracker & Autofill

A privacy-first Chrome extension for tracking job applications and autofilling job application forms. 100% local storage, no external servers, fully open source.

## Features

- **Comprehensive Profile Management**: Store your personal info, work history, education, skills, and custom Q&A for quick autofill
- **Smart Autofill**: Automatically fill job application forms with your profile data
- **Application Tracking**: Keep track of all your job applications in one place
- **Auto-Detection**: Automatically detect and log job applications when you submit on supported job boards
- **Export/Import**: Backup and restore your data with JSON export/import
- **Privacy-First**: All data stored locally in your browser - no servers, no tracking, no analytics

## Supported Job Boards

- LinkedIn (Easy Apply)
- Indeed
- Glassdoor
- Greenhouse
- Lever
- Workday
- iCIMS
- SmartRecruiters
- Generic support for other job sites

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `jobtracker-extension` folder
5. The extension icon should appear in your toolbar

### From Chrome Web Store

Coming soon!

## Usage

### Setting Up Your Profile

1. Click the JobTracker icon in your toolbar
2. Click "Profile" in the navigation
3. Fill in your personal information, work history, education, and skills
4. Your data is automatically saved as you type

### Autofilling Applications

1. Navigate to a job application page
2. Click the floating "Autofill" button that appears, or
3. Click the JobTracker icon and select "Autofill This Page", or
4. Use the keyboard shortcut `Alt+Shift+F`

### Tracking Applications

Applications are tracked automatically when:
- You submit an application on a supported job board
- You manually add them via the popup or applications page

To manually add an application:
1. Click the JobTracker icon
2. Click "Add Application"
3. Fill in the job details and click "Add"

### Managing Applications

1. Click "View All" or navigate to the Applications page
2. Filter by status or search by company/position
3. Click on an application to see details
4. Update status by clicking on the status badge

### Export/Import Data

To export your data:
1. Go to Profile > Settings
2. Click "Export"
3. Save the JSON file

To import data:
1. Go to Profile > Settings
2. Click "Import"
3. Select your JSON backup file
4. Choose to merge or replace existing data

## Keyboard Shortcuts

- `Alt+Shift+F` - Trigger autofill on current page

## Privacy

JobTracker is designed with privacy as a core principle:

- **100% Local Storage**: All your data is stored in Chrome's local storage on your device
- **No External Servers**: The extension never sends your data to any external servers
- **No Analytics**: No tracking, no telemetry, no analytics of any kind
- **No Account Required**: Works completely offline, no sign-up needed
- **Open Source**: Full source code available for review

## Development

### Project Structure

```
jobtracker-extension/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js             # Main content script
├── floating-button.js/css # Autofill button UI
├── popup.html/js/css      # Extension popup
├── profile.html/js/css    # Profile editor page
├── applications.html/js/css # Applications manager
├── lib/                   # Shared libraries
│   ├── storage.js         # Chrome storage wrapper
│   ├── utils.js           # Utility functions
│   ├── field-matcher.js   # Form field matching
│   └── form-utils.js      # Form utilities
├── *-autofill.js          # Platform-specific autofill
├── *-detect.js            # Platform-specific detection
└── generic-autofill.js    # Generic autofill fallback
```

### Building

No build step required! The extension uses vanilla JavaScript and can be loaded directly in developer mode.

### Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with inspiration from various job application tools, designed to be the open-source, privacy-respecting alternative.
