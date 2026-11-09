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
| `shared.js` | Pure helpers (classification, file names, sizes, host policy, settings validation); unit tested in `test/` |
| `service-worker.js` | Detection merge (serialized), policy checks, downloads, message routing |
| `content-script.js` | Reads `video`/`audio` URLs already in the DOM, in every frame |
| `popup.*` | Operator UI for the active tab |
| `options.*` | Local policy and history |

## Policy enforcement

Every candidate must pass:

1. URL is `http` or `https`
2. None of the media host, the tab's page, the frame, or the request initiator is on the blocklist (so an embedded YouTube player or a `googlevideo.com` request is blocked even on an allowed page)
3. At least one of those hosts is on the allowlist when that list is non-empty
4. Resource looks like direct media or an explicit playlist
5. Playlists cannot be sent to `chrome.downloads` as a fake video file

## Messaging

Extension pages (popup, options) may call every message type. Content scripts may only send `PAGE_CANDIDATES`, and the tab is taken from the sender, not the message.

## Tab lifecycle

A top-frame navigation request (`main_frame`) clears that tab's list. URL changes made with `history.pushState` do not, so single-page LMS apps keep their detections.

## Non-goals

Segment stitching, decrypting Widevine/PlayReady, or impersonating streaming clients are out of scope. See `docs/adr/0001-direct-media-only.md`.
