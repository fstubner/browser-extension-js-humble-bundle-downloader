# Humble Bundle Downloader

A Chrome extension (Manifest V3) that lets you preview and batch-download your purchased Humble Bundle content directly from the browser — no manual clicking through each order.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-informational?style=flat-square)

## Features

- Detects your active Humble Bundle session automatically
- Lists all downloadable items across your entire purchase history
- Filter by content type: **Books**, **Comics**, or **Audio**
- For ebooks: filter by format (**EPUB**, **MOBI**, **PDF**, **CBZ**)
- Preview matched download links before committing
- One-click batch download — triggers a `chrome.downloads` entry for each file

## How it works

The extension uses your browser's existing Humble Bundle session cookie (`_simpleauth_sess`) — no password is stored or transmitted. It calls two internal Humble Bundle API endpoints:

1. `/api/v1/user/order` — fetches all your order keys
2. `/api/v1/orders?gamekeys=...` — fetches order contents in batches of 40

Download links are extracted client-side from the order data, filtered by your chosen content type and format, and handed directly to `chrome.downloads.download`.

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle top-right).
4. Click **Load unpacked** and select this folder.
5. Navigate to [humblebundle.com](https://www.humblebundle.com) and log in.
6. Click the extension icon to open the popup.

## Usage

1. Open the popup — it checks your session automatically.
2. Select a **Content type** (Books / Comics / Audio).
3. For Books, optionally select a **Format** (EPUB / MOBI / PDF / CBZ).
4. Click **Preview links** to see what will be downloaded.
5. Click **Download all** to start the batch download.

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Read the Humble Bundle session cookie to verify login |
| `downloads` | Trigger file downloads via `chrome.downloads` |
| `host_permissions: humblebundle.com` | Fetch order data from the Humble Bundle API |

## Notes

- Downloads are for **personal use only** — only content you have purchased will appear.
- Humble Bundle rate-limits their API; large libraries may take a moment to load.
- The extension does not store any credentials or order data between sessions.

## License

MIT
