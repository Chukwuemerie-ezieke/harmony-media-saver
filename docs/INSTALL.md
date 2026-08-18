# Install Harmony Media Saver

The extension is not on the Chrome Web Store yet. Install it unpacked from this repository.

## 1. Download and unzip

1. Open https://github.com/Chukwuemerie-ezieke/harmony-media-saver
2. Click the green **Code** button
3. Choose **Download ZIP**
4. Unzip the file completely. Do not load the `.zip` itself.

After unzipping you should have this folder:

```text
harmony-media-saver-main/
  manifest.json
  service-worker.js
  content-script.js
  popup.html
  popup.js
  popup.css
  options.html
  options.js
  options.css
  docs/
  icons/
```

If you cloned with Git, the folder is `harmony-media-saver` instead of `harmony-media-saver-main`.

## 2. Load the inner folder

1. Open a new Chrome tab and type `chrome://extensions`
2. Turn on **Developer mode** in the top right
3. Click **Load unpacked**
4. Select the folder that **directly contains** `manifest.json`

Correct:

- `Downloads/harmony-media-saver-main`
- `Documents/harmony-media-saver`

Wrong:

- the `.zip` file
- `Downloads`
- `harmony-media-saver-main/docs`
- `harmony-media-saver-main/icons`

In the file picker, click the folder name once, then click **Select Folder**. You should see `manifest.json` listed inside that folder before you confirm.

## 3. Pin it

1. Confirm **Harmony Media Saver** appears and is enabled
2. Click the puzzle-piece icon in Chrome
3. Pin **Harmony Media Saver**

## First-run check

1. Open the extension **Options** page
2. Keep the default streaming-site blocklist
3. For HarmonyLearn or another LMS you operate, add that host to the allowlist

## Update

Download a fresh ZIP or run `git pull`, then click **Reload** on the extension card.

## Remove

On `chrome://extensions`, click **Remove**.

If Chrome still refuses to load the folder, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
