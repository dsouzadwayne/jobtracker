# Privacy Policy

**Last Updated:** April 28, 2026

## Overview

JobTracker is a browser extension that helps you track job applications and autofill application forms. This privacy policy explains how JobTracker handles your data.

**The short version:** JobTracker does not collect, transmit, or share any of your data. Everything stays on your device.

## Data Storage

### What Data is Stored

JobTracker stores the following information locally on your device:

- **Profile Information:** Name, email, phone, address, work history, education, skills, certifications, and social links that you voluntarily enter
- **Job Applications:** Company names, positions, application dates, status, and notes for jobs you apply to
- **Settings:** Your extension preferences

### Where Data is Stored

All data is stored locally using:
- The browser's WebExtension Storage API (`browser.storage.local`)
- IndexedDB (browser's built-in database)

Your data never leaves your browser. There are no external servers, databases, or cloud storage involved.

## Data Collection

### What We Do NOT Collect

JobTracker does **not** collect:
- Browsing history
- Cookies or tracking data
- Personal identifiers
- Usage analytics or telemetry
- Crash reports
- Any data transmitted to external servers

### No Third-Party Services

JobTracker does not integrate with any third-party services, analytics platforms, or advertising networks.

## Data Sharing

JobTracker does **not** share your data with anyone. Your data remains entirely on your device and under your control.

- We do not sell user data
- We do not transfer user data to third parties
- We do not use data for advertising
- We do not use data for creditworthiness or lending purposes

## Data Security

Your data is protected by your browser's built-in security mechanisms. Since no data is transmitted over the internet, there is no risk of data interception during transmission.

## Your Control Over Your Data

You have complete control over your data:

- **View:** Access all your data through the extension's dashboard and profile pages
- **Edit:** Modify your profile and application records at any time
- **Export:** Download your data as JSON files for backup
- **Import:** Restore your data from previously exported files
- **Delete:** Clear all data through the dashboard or by uninstalling the extension

## Permissions Explained

JobTracker requests the following Firefox permissions:

| Permission | Type | Purpose |
|------------|------|---------|
| `storage` | Required | Save your profile and application data locally on your device |
| `activeTab` | Required | Access the current tab when you trigger autofill |
| `scripting` | Required | Fill form fields with your profile data |
| `alarms` | Required | Schedule periodic reminders for application follow-ups |
| `unlimitedStorage` | Required | Allow large local data (resumes, cover letters, AI model cache) without quota limits |
| `<all_urls>` (host permission) | Required | Detect job application forms and run autofill on any job site you visit |
| `https://huggingface.co/*`, `https://*.hf.co/*` | Optional | Only requested when you opt in to AI features. Used solely to download NLP/NER models that then run locally inside the extension. No personal data is sent to HuggingFace. |

These permissions are used solely for the extension's core functionality. No data collected through these permissions is transmitted externally.

The Firefox manifest declares `data_collection_permissions: { required: ["none"] }`, which is Mozilla's machine-readable signal that this extension performs no data collection.

## AI Features (Optional)

JobTracker includes optional AI-powered features (smart field detection, job description parsing) that run **entirely on your device** using ONNX Runtime Web. When you enable these features for the first time, the extension will:

1. Ask permission to access `huggingface.co` (Firefox will show a permission prompt).
2. Download pre-trained NLP/NER model files from HuggingFace.
3. Cache the model files locally so they only download once.
4. Run all inference locally in your browser — no text, profile data, or job content is ever sent to HuggingFace or any external server.

You can disable AI features at any time, and the optional permission can be revoked from Firefox's add-on settings.

## Children's Privacy

JobTracker is intended for adult job seekers. We do not knowingly collect information from children under 13 years of age.

## Open Source

JobTracker is open source software. You can review the complete source code to verify our privacy practices:

https://github.com/dsouzadwayne/jobtracker

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date at the top of this document. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact

If you have questions about this privacy policy or JobTracker's privacy practices, please open an issue on our GitHub repository:

https://github.com/dsouzadwayne/jobtracker/issues

---

**Summary:** JobTracker is a privacy-first extension. Your data stays on your device. We don't collect, transmit, or share anything.
