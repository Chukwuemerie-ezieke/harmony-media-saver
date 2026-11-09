# User Guide

## What you can save

- Direct video files such as `.mp4`, `.webm`, `.mov`
- Direct audio files such as `.mp3`, `.m4a`, `.wav`
- Media already attached to a `<video>` or `<audio>` element as an `http(s)` URL, including players inside embedded frames

## What you cannot save

- DRM-protected movies and series
- YouTube, Netflix, and other blocked streaming catalogs
- Encrypted Media Extensions output
- `blob:` and Media Source buffers
- HLS/DASH playlists (`.m3u8`, `.mpd`) as if they were a finished MP4

## Daily use

1. Open the lesson page, LMS resource, or other authorized media page
2. Press play if the file is requested only after playback starts
3. Click the teal Harmony Media Saver icon
4. Use **Scan** if the list is empty
5. Click **Download** and choose a destination if Save As is enabled

The toolbar badge shows how many downloadable files were found on the current tab.

## Download progress

After you click **Download**, the file shows its progress in the popup. When it finishes, **Show in folder** opens it in your file manager. If it fails or you cancel it, **Retry** starts it again. Progress is kept if you close and reopen the popup.

## Large files and data use

Files larger than the limit in Options (500 MB by default) show their size in amber, and **Download** asks once more ("Download 1.2 GB?") before starting. For batch downloads the total of the selected files is checked. Set the limit to 0 in Options to turn the question off.

## Download several files at once

When two or more files are listed, tick the ones you want (or **Select all**) and click **Download selected**. Batch downloads go straight to your download folder, even if **Ask where to save each file** is on, so you are not shown one dialog per file.

## Organise downloads into folders

In Options, **File name pattern** decides where each file goes inside your download folder. Use `/` for subfolders. Tokens:

| Token | Meaning | Example |
| --- | --- | --- |
| `{filename}` | Original file name with extension | `Week 3 Lecture.mp4` |
| `{name}` | File name without extension | `Week 3 Lecture` |
| `{ext}` | Extension | `mp4` |
| `{site}` | Website the file was found on | `learn.yourschool.edu.ng` |
| `{title}` | Title of the page | `Biology SS2` |
| `{date}` | Today's date | `2026-11-09` |
| `{kind}` | `video` or `audio` | `video` |

For example, `{site}/{title}/{filename}` saves to `HarmonyMedia/learn.yourschool.edu.ng/Biology SS2/Week 3 Lecture.mp4`. Options shows a live example as you type. The file always keeps its extension.

## Language

Choose **Language** in Options: English, Hausa, Yorùbá, Igbo or Nigerian Pidgin, or **Automatic** to follow the browser. Every screen is translated, but the non-English translations are drafts; please report wording that is wrong or unclear.

## Welcome guide

A short guide opens once when the extension is first installed. Open it again any time from **Why is nothing showing?** at the bottom of the popup.

## Copy your setup to another computer

In Options, click **Export settings** to save a `.json` file. On the other computer, click **Import settings** and pick that file. Schools with managed Chrome can push settings centrally instead; see the [admin guide](ADMIN_GUIDE.md).

## Right-click

On a video or audio player, choose **Save media with Harmony Media Saver**. On a link that ends in a media extension (such as `.mp4` or `.mp3`), choose **Save linked media with Harmony Media Saver**. Right-click downloads appear in the local history.

## Filters

- **All** shows downloadable audio and video
- **Video** / **Audio** narrow the list
- **Playlists** shows detected streaming manifests so you know why a site has no file

## Options worth setting in a school

- Set **Allowlist hosts** to your LMS and content domain
- Keep YouTube and commercial streamers blocked
- Turn on **Ask where to save each file** for shared computers
- Clear local history on staff devices at the end of term

## If nothing appears

- Confirm the page is `http` or `https` (pages opened from disk as `file://` are not scanned)
- Confirm you are allowed to use that file
- Start playback, then scan again
- Check that the host is not blocked and is on the allowlist if you enabled one
- Remember that many modern players never expose a single file URL
