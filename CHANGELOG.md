# Changelog

## 1.2.0 — 2026-11-09

### Added

- **Batch download**: tick several files (or "Select all") in the popup and download them in one go. Batch downloads go straight to the download folder without a Save As dialog per file.
- **File name patterns**: save files into subfolders such as `{site}/{title}/{filename}`. Tokens: `{filename}` `{name}` `{ext}` `{site}` `{title}` `{date}` `{kind}`. Options shows a live example. The default `{filename}` keeps the old behaviour.
- **Settings export and import** as a JSON file, for copying a setup between computers.
- **Central settings for schools** through Chrome policy (`managed_schema.json`). Managed values override the user's settings and are locked in Options; managed blocked hosts are added on top of the user's list. See `docs/ADMIN_GUIDE.md`.
- **Interface languages**: English, Hausa, Yorùbá, Igbo and Nigerian Pidgin, chosen in Options (or automatic from the browser language). The non-English translations are drafts awaiting native-speaker review; missing strings fall back to English.
- Download history records the full saved path and whether a file came from the popup, a batch or right-click.

### Fixed

- Options page text boxes overflowed their card on the right.

## 1.1.0 — 2026-11-09

### Fixed

- Blocklist now also checks the page you are on and the site that requested the media, and blocks the CDNs streaming sites use (for example `googlevideo.com`, `fbcdn.net`, `nflxvideo.net`). Previously YouTube media could still be listed because it is served from `googlevideo.com`. Existing installs get the new CDN entries added once on update.
- Detections arriving at the same time no longer overwrite each other
- File size is read from `Content-Range`, so streamed videos show their full size instead of one chunk
- Right-click menu only appears on media links, not every link
- Audio players with no file extension are no longer labelled as video
- Downloads keep a proper extension (from `Content-Disposition` or the content type)
- Single-page apps that change the URL without reloading keep their detected list
- Media inside embedded frames is now detected
- Right-click downloads are recorded in history
- History in Options is rendered as text, not HTML
- Settings are validated and clamped in the service worker; privileged messages are accepted only from extension pages
- The test page is served over http (`npm run example`); `file://` pages are not scanned, and the popup now says so

### Added

- PNG toolbar and store icons (16, 32, 48, 128)
- Popup list updates live while it is open
- Shared helper module (`shared.js`) with unit tests (`npm test`)
- Validator checks icons, version consistency, referenced files and script syntax; CI runs validation and tests

## 1.0.1 — 2026-08-18

- Remove SVG extension icons so Chrome can load the unpacked package
- Clarify the exact folder to select in Load unpacked
- Add a local test page and troubleshooting guide

## 1.0.0 — 2026-08-18

- Initial Manifest V3 release
- Detect direct audio and video files from response headers and media elements
- Popup downloader with type filters and copy-URL action
- Options for folder name, Save As, blocklist, allowlist, and local history
- Context menu on video, audio, and media links
- Default blocklist for major streaming platforms
