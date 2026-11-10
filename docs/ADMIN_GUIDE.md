# Admin guide: setting Harmony Media Saver centrally

School ICT teams can push settings to every managed Chrome browser instead of configuring each computer. Values set this way are applied on top of the user's own settings and appear locked (greyed out) on the Options page, with a notice that the organisation manages them.

## What you can set

| Key | Type | Effect |
| --- | --- | --- |
| `folderName` | string | Folder inside Downloads where files are saved |
| `filenameTemplate` | string | File name pattern, e.g. `{site}/{title}/{filename}` (see the user guide for tokens) |
| `saveAs` | boolean | Ask where to save each file |
| `showPlaylists` | boolean | Show streaming playlists as unsupported items |
| `maxCandidates` | integer | Items remembered per tab (5–100) |
| `largeFileWarningMB` | integer | Ask before downloading files larger than this many MB (0 = never ask) |
| `language` | string | `auto`, `en`, `ha`, `yo`, `ig` or `pcm` |
| `blockedHosts` | list of strings | **Added** to the user's blocklist; users cannot remove these |
| `allowlistHosts` | list of strings | When set, only these hosts are scanned; replaces the user's allowlist |

The full schema is in [`managed_schema.json`](../managed_schema.json). Values are validated the same way as settings typed into Options (hosts are normalised, numbers are clamped).

## Google Admin console (ChromeOS and managed Chrome browsers)

1. Go to **Devices → Chrome → Apps & extensions → Users & browsers** and pick the organisational unit.
2. Add the extension (by ID from the Chrome Web Store once published, or as a custom app).
3. Select it and paste a policy into **Policy for extensions**, for example:

```json
{
  "folderName": { "Value": "SchoolMedia" },
  "filenameTemplate": { "Value": "{site}/{title}/{filename}" },
  "saveAs": { "Value": false },
  "allowlistHosts": { "Value": ["learn.yourschool.edu.ng", "media.yourschool.edu.ng"] },
  "blockedHosts": { "Value": ["youtube.com", "googlevideo.com"] },
  "language": { "Value": "auto" }
}
```

## Windows (Group Policy / registry)

Write values under the extension's policy key, replacing `<extension-id>`:

```text
HKEY_LOCAL_MACHINE\Software\Policies\Google\Chrome\3rdparty\extensions\<extension-id>\policy
  folderName        REG_SZ     SchoolMedia
  saveAs            REG_DWORD  0
  allowlistHosts    (subkey with values 1, 2, ... holding each host)
```

## Linux

Create `/etc/opt/chrome/policies/managed/harmony-media-saver.json` (Chromium: `/etc/chromium/policies/managed/`):

```json
{
  "3rdparty": {
    "extensions": {
      "<extension-id>": {
        "folderName": "SchoolMedia",
        "saveAs": false,
        "allowlistHosts": ["learn.yourschool.edu.ng"]
      }
    }
  }
}
```

When any policy is set, the welcome guide is not opened on install, since the extension is already set up for the user.

## Checking it worked

Open `chrome://policy`, click **Reload policies**, and look for the extension's entries. Then open the extension's Options page: managed fields are greyed out and a yellow notice is shown.

## Without central management

Configure one computer, click **Export settings** on the Options page, copy the `.json` file to the other computers, and use **Import settings** there.
