# Harmony Media Saver

Manifest V3 Chrome extension from Harmony Digital Consults Ltd. It finds **direct**, user-accessible audio and video files on the current tab and saves the chosen file through Chrome's native download manager.

It does **not** rip DRM-protected streams, bypass paywalls, or download unauthorized content from YouTube or other streaming platforms.

## Features

- Detects media from network responses (`video/*`, `audio/*`, and common file extensions)
- Scans `<video>` and `<audio>` elements already exposed by the page
- Popup list with type, size, and source filename
- Optional "Save as" dialog and custom download folder name
- Download history stored locally in the browser
- Host blocklist (YouTube and major streaming sites blocked by default)
- Optional allowlist for school portals and your own LMS
- Streaming playlists (`.m3u8`, `.mpd`) are labeled unsupported in v1

## Install in Chrome

1. Download the latest ZIP from [the repository](https://github.com/Chukwuemerie-ezieke/harmony-media-saver)
2. Unzip it. You should see `harmony-media-saver-main/manifest.json`
3. Open `chrome://extensions` and enable **Developer mode**
4. Click **Load unpacked**
5. Select `harmony-media-saver-main` itself, not Downloads and not the zip
6. Pin **Harmony Media Saver** from the puzzle-piece menu

If Chrome refuses to load, you likely selected the parent folder or an older copy that used an SVG icon. Use this latest code and see [docs/INSTALL.md](docs/INSTALL.md).

## Use

1. Open a site that hosts a media file you are authorized to download
2. Start playback if the file is lazy-loaded
3. Click the extension icon
4. Choose **Download** on a detected file

Known-good test page: [examples/test-media.html](examples/test-media.html)

User guide: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## Permissions

| Permission | Why it is required |
| --- | --- |
| `downloads` | Start a normal Chrome download for a URL you selected |
| `webRequest` | Observe response headers to detect media files |
| `tabs` | Read the active tab so the popup can show that tab's files |
| `storage` | Save settings, session detections, and local history |
| `contextMenus` | Offer "Save media" on video, audio, and media links |
| `<all_urls>` | Detect media on the pages you visit |

See [PRIVACY.md](PRIVACY.md).

## Development

```bash
git clone https://github.com/Chukwuemerie-ezieke/harmony-media-saver.git
cd harmony-media-saver
npm run validate
```

Load the repo folder as an unpacked extension after each change, then click **Reload** on `chrome://extensions`.

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Compliance

Download only media you own, licensed content, or files a site already exposes as a normal downloadable resource. Do not use this extension to take copyrighted streaming catalogs. Chrome Web Store policy prohibits extensions that enable unauthorized downloading of streaming media.

## License

MIT © 2026 Harmony Digital Consults Ltd
