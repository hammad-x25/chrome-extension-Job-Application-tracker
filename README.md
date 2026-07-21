# Job Application Tracker Chrome Extension

A JavaScript-based Chrome extension that helps users extract, save, organize, search, update, and export job applications directly from their browser.

## Features

- Save job applications manually
- Extract job details from the current webpage
- Store applications using `chrome.storage.local`
- Edit existing applications
- Delete applications
- Search jobs by title or company
- Filter jobs by application status
- Track total applications, applied jobs, and interviews
- Prevent duplicate job URLs
- Export saved applications as a CSV file
- Open job links directly from the extension
- Use a Chrome side panel interface 

## Supported Job Data

Each saved application can include:

- Job title
- Company name
- Job URL
- Application status
- Application date
- Notes
- Created date
- Last updated date

## Application Statuses

- Saved
- Applied
- Interview
- Rejected
- Offer

## Project Structure

```text
job-application-tracker/
├── manifest.json
├── README.md
│
├── sidepanel/
│   ├── sidepanel.html
│   └── styles.css
│
└── scripts/
    ├── background.js
    ├── storage.js
    ├── content.js
    └── sidepanel.js
```

## JavaScript Files

### `background.js`

Runs as the extension service worker.

It configures Chrome so the extension side panel opens when the user clicks the extension icon.

### `storage.js`

Handles all Chrome storage operations.

It contains reusable functions for reading, saving, adding, updating, deleting, finding duplicate URLs, and clearing stored jobs.

```text
Read existing jobs
        ↓
Modify the jobs array
        ↓
Save the complete updated array
```

### `content.js`

Runs inside the currently opened webpage.

It reads job information from the page DOM and sends the extracted data back to the side panel.

It supports structured `JobPosting` JSON-LD, LinkedIn, Indeed, Glassdoor, and generic job listing pages.

### `sidepanel.js`

Controls the main extension interface.

It handles form submission, adding, updating, deleting, rendering, searching, filtering, statistics, current-page extraction, CSV export, and error messages.

## Technologies Used

- JavaScript
- HTML
- CSS
- Chrome Extensions Manifest V3
- Chrome Storage API
- Chrome Side Panel API
- Chrome Scripting API
- Chrome Tabs API
- DOM API
- Blob API for CSV export

## Installation

1. Clone or download this repository.

```bash
git clone https://github.com/your-username/job-application-tracker-extension.git
```

2. Open Google Chrome.

3. Visit:

```text
chrome://extensions
```

4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the project folder.
7. Pin the extension.
8. Click the extension icon to open the side panel.

## Required Permissions

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "sidePanel"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ]
}
```

- `storage` saves job applications locally.
- `activeTab` accesses the current tab.
- `scripting` injects `content.js`.
- `sidePanel` shows the extension interface.
- `host_permissions` allows extraction from normal websites.

## How It Works

```text
User opens a job listing
          ↓
Clicks "Get Current Job"
          ↓
sidepanel.js contacts content.js
          ↓
content.js reads the webpage DOM
          ↓
Extracted data fills the form
          ↓
User saves the job
          ↓
storage.js reads existing jobs
          ↓
Adds the new job
          ↓
Saves the updated array
```

## CRUD Operations

### Create

```text
Read jobs → Add new job → Save updated jobs
```

### Read

```text
Read jobs → Display jobs
```

### Update

```text
Read jobs → Find matching job → Apply changes → Save
```

### Delete

```text
Read jobs → Remove matching job → Save remaining jobs
```

## Limitations

- Job websites frequently change their HTML structure, so selectors may require updates.
- Chrome blocks script injection on protected pages such as `chrome://extensions`, `chrome://settings`, and Chrome Web Store pages.
- Extraction accuracy depends on the current webpage.
- Data is stored locally and is not synchronized online.

## Planned Improvements

- Follow-up reminders
- Resume version tracking
- Contact person details
- Salary and location filters
- JSON backup and restore
- Chrome notifications
- Cloud synchronization
- React interface
- Next.js dashboard
- Resume and job-description keyword comparison

## Development Status

This project is actively being developed as part of my JavaScript learning journey.

The current goal is to understand and implement each feature using vanilla JavaScript before rebuilding the interface with React.

## Author

**Hammad Ashfaq**


## License

This project is open source and available for learning and personal use.