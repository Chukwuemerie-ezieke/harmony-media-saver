# Chrome Web Store listing

Copy these fields into the Chrome Web Store Developer Dashboard. Images are in [`store/`](../store). Review the current [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies) before each submission: extensions that enable unauthorized downloading of streaming media are not allowed, so keep the wording below about authorized, direct files.

## Package

Run `npm run package` and upload `dist/harmony-media-saver-<version>.zip`. GitHub Actions also builds it on every push (see the **package** artifact on the Validate run).

## Store listing tab

**Name** (from the manifest): Harmony Media Saver

**Summary** (from the manifest, 132 characters max):

> Finds direct downloadable audio and video files on the current page and saves them with Chrome's download manager.

**Description:**

```text
Harmony Media Saver helps teachers, students and school ICT teams keep a local copy of lesson videos, recordings and audio that a website already offers as ordinary files, such as MP4, WebM, MP3 and M4A on a school learning platform.

How it works
• Open a page you are allowed to save media from and start playback if needed.
• Click the Harmony Media Saver icon. It lists the direct video and audio files on the page with their real name, type and size.
• Download one file, or tick several and download them together, with live progress.
• Asks before downloading very large files, to help protect mobile data.
• Files are saved by Chrome's own download manager.

Keep downloads organised
• Choose a download folder and a file name pattern such as {site}/{title}/{filename} to sort files by website and course automatically.
• Download history stays on your computer.

Built for schools
• Allowlist your learning platform so only it is scanned.
• Export settings and import them on other computers.
• ICT teams can set the folder, allowlist and blocklist centrally for managed Chrome browsers through Chrome policy.
• Interface in English, Hausa, Yorùbá, Igbo and Nigerian Pidgin.

Responsible by design
This is not a YouTube or streaming downloader. It only saves files that a site already serves as a normal file. It does not bypass DRM, logins or paywalls, and it does not stitch HLS/DASH streams. YouTube, Netflix, Disney+, Spotify, TikTok, Instagram, Facebook, Twitch and similar services, including their embedded players and media servers, are blocked by default.

Privacy
No account, no analytics and no servers. Media addresses, settings and history are stored only in your browser.

Only save media you own, are licensed to use, or have permission to download.

Made by Harmony Digital Consults Ltd.
```

**Category:** Education (Productivity also fits)

**Language:** English

**Graphic assets:**

| Field | File |
| --- | --- |
| Store icon (128×128) | `icons/icon-128.png` |
| Screenshots (1280×800) | `store/screenshot-1-popup.png`, `store/screenshot-2-organise.png`, `store/screenshot-3-schools.png` |
| Small promo tile (440×280) | `store/promo-small-440x280.png` |

**Official URL / Homepage:** https://www.harmonydigitalconsults.com.ng (or the GitHub repository)

**Support URL:** https://github.com/Chukwuemerie-ezieke/harmony-media-saver/issues

## Privacy practices tab

**Single purpose:**

> Detect direct audio and video files on the current tab and download the files the user selects through Chrome's download manager.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `downloads` | Starts the download of the media file the user selects, through Chrome's download manager. |
| `webRequest` | Reads response headers (content type, size, file name) in observe-only mode to recognise direct audio and video files the page loads. Requests are never blocked, modified or redirected. |
| `tabs` | Reads the active tab's address and title to show that tab's files, apply the user's blocklist/allowlist to the page, and name download folders after the site or page. |
| `storage` | Saves the user's settings, the files found on open tabs, and local download history. Also reads settings an organisation sets through Chrome policy. |
| `contextMenus` | Adds "Save media" to the right-click menu on video and audio players and on links to media files. |
| Host permission `<all_urls>` | Media can be served from any website or content server the user visits, such as a school's learning platform or its CDN. Detection runs locally; nothing is sent anywhere. Users can restrict scanning to an allowlist. |

**Remote code:** No, I am not using remote code. (All JavaScript is in the package.)

**Data usage:** The extension does not collect or transmit user data. Media addresses, page titles, settings and history are processed and stored only in the browser. Leaving every data category unticked matches that. If a reviewer reads "handling" more broadly, the closest category is *Web history*, described as processed locally only and never transmitted.

Tick all three certifications (no selling data, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/Chukwuemerie-ezieke/harmony-media-saver/blob/main/PRIVACY.md

## Distribution tab

* **Visibility:** start with **Unlisted** (installable only by link) or **Private** to your Google Workspace domain while schools pilot it. Switch to **Public** later.
* **Regions:** All regions, or Nigeria first.
* **Pricing:** Free.

## Notes for the reviewer (optional field)

```text
Test page: run "npm run example" in the repository and open http://localhost:8080/test-media.html, or open any page with a direct MP4/MP3 file. The extension only lists direct files a page already loads; streaming services are blocked by default (Options > Blocked hosts). webRequest is used in observe-only mode to read content-type and size headers.
```
