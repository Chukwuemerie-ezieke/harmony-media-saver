# Publishing to the Chrome Web Store

Harmony Digital Consults has to do the first publication itself: it needs the company's Google account and a one-time developer registration. Everything else (package, listing text, images, privacy answers) is prepared in this repository. Later updates can be published from GitHub Actions.

## 1. One-time setup (about 20 minutes)

1. Sign in with the Google account that should own the extension. A company account such as a Google Workspace account is better than a personal one.
2. Turn on **2-Step Verification** for that account. The Web Store requires it to publish.
3. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), accept the developer agreement and pay the one-time registration fee (US$5).
4. In **Account**, set the publisher name to *Harmony Digital Consults Ltd*, add a contact email and verify it. Verifying the website (harmonydigitalconsults.com.ng) through Google Search Console adds a verified badge.

## 2. First submission

1. Build the package: `npm run package`, or download the **package** artifact from the latest successful *Validate* run on GitHub. Upload `harmony-media-saver-<version>.zip` with **New item**.
2. Fill in the **Store listing**, **Privacy practices** and **Distribution** tabs by copying from [STORE_LISTING.md](STORE_LISTING.md). Images are in [`store/`](../store).
3. Click **Submit for review**.

Review usually takes from a few days to a few weeks. Extensions with access to all sites and `webRequest` get an in-depth review, so expect the longer end. If the reviewer asks questions, answer from the permission justifications in STORE_LISTING.md.

## 3. After approval

* Note the **extension ID** (32 letters, shown in the dashboard and in the store URL). Use it in the [admin guide](ADMIN_GUIDE.md) policy examples, and share the store link with schools.
* Google Admin console users can then add the extension by ID and push settings to it.

## 4. Publishing updates from GitHub (optional)

The **Publish to Chrome Web Store** workflow (`.github/workflows/publish.yml`) builds the package, uploads it and submits it for review. It only runs when started by hand from the Actions tab.

Setup, once:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, enable the **Chrome Web Store API**, configure the OAuth consent screen, and create an OAuth client of type *Web application* with `https://developers.google.com/oauthplayground` as a redirect URI.
2. In the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground), use your own client ID and secret (gear icon), authorize the scope `https://www.googleapis.com/auth/chromewebstore` **with the account that owns the extension**, and exchange the code for a refresh token.
3. In the Developer Dashboard, copy the **publisher ID** (Publisher › Settings) and the **extension ID**.
4. In GitHub, go to **Settings › Secrets and variables › Actions** and add these secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`.

Each release:

1. Raise `version` in **both** `manifest.json` and `package.json` (the validator checks they match; the store rejects a version it has seen before), update `CHANGELOG.md`, and merge to `main`.
2. Open **Actions › Publish to Chrome Web Store › Run workflow**. Leave *Submit for review* ticked to publish, or untick it to upload a draft only.

If you change the item's visibility in the dashboard, publish once manually from the dashboard before using the workflow again.

## Keep in mind

* Keep the listing wording about *authorized, direct* files. Describing it as a general video downloader, or naming streaming sites as things it can save, is the most likely reason for rejection.
* Update the screenshots in `store/` when the interface changes noticeably.
* Get the Hausa, Yorùbá and Igbo translations reviewed by native speakers before promoting those languages in the listing.
