# Troubleshooting

## Chrome says it could not load the extension

Usually one of these is true:

1. The `.zip` was not extracted. Extract it first, then load the folder.
2. The parent folder was selected. Select the folder that contains `manifest.json`, not `Downloads`.
3. An older copy is still selected. Delete the old unpacked card, download the latest ZIP, and load again.

The exact folder to pick looks like this in the file picker:

```text
manifest.json
service-worker.js
popup.html
options.html
content-script.js
```

## Common Chrome errors

**Could not load icon ... icon.svg**  
Older copies used an SVG icon. Chrome only accepts PNG/JPEG/GIF/BMP/ICO for extension icons. Version 1.0.1 removes that icon requirement so the extension can load. Download the latest ZIP.

**Manifest file is missing or unreadable**  
You selected the wrong folder, or you selected the zip. Open the unzipped folder and confirm `manifest.json` is visible, then select that folder.

**Service worker registration failed**  
Click **Errors** on the extension card and reload. If it persists, make sure `service-worker.js` sits next to `manifest.json`.

## The extension loads but finds no media

- Open an `http` or `https` page, not `chrome://` or the Web Store
- Start playback, then click **Scan**
- Use [examples/test-media.html](../examples/test-media.html) as a known-good file
- YouTube, Netflix, and similar sites are blocked on purpose
- Many modern players never expose a single MP4 URL

## Edge

Use `edge://extensions`, enable Developer mode, then **Load unpacked** with the same folder.
