# Architecture

Harmony Media Saver is a Manifest V3 Chrome extension with no backend.

```text
Page media elements          Network responses
        \\                       /
         \\                     /
        Content script    webRequest headers
                   \\         /
                    \\       /
                 Service worker
                 session store
                      |
           Popup  /  Options  /  Context menu
                      |
              chrome.downloads
```

## Why this shape

Chrome no longer allows a persistent background page. The service worker can sleep, so live detections are written to `chrome.storage.session`. Settings and history use `chrome.storage.local`.

`webRequest` is used in non-blocking observe mode only. The extension never redirects, strips signatures, or rewrites media traffic.

## Modules

| File | Role |
| --- | --- |
| `manifest.json` | Permissions, entry points, content script |
| `service-worker.js` | Detection merge, policy checks, downloads |
| `content-script.js` | Reads `video`/`audio` URLs already in the DOM |
| `popup.*` | Operator UI for the active tab |
| `options.*` | Local policy and history |

## Policy enforcement

Every candidate must pass:

1. URL is `http` or `https`
2. Host is not on the blocklist
3. Host is on the allowlist when that list is non-empty
4. Resource looks like direct media or an explicit playlist
5. Playlists cannot be sent to `chrome.downloads` as a fake video file

## Non-goals

Segment stitching, decrypting Widevine/PlayReady, or impersonating streaming clients are out of scope. See `docs/adr/0001-direct-media-only.md`.
