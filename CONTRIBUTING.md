# Contributing

## Scope

This project accepts improvements to detection of **direct** media files, accessibility, documentation, and school/LMS workflows.

Do not open pull requests that:

- Bypass DRM, signed URLs, or authentication
- Mux HLS/DASH segments from third-party streaming platforms
- Target YouTube, Netflix, or similar catalogs
- Add remote code execution or obfuscated network calls

## Workflow

1. Fork and branch from `main`
2. Keep the branch focused
3. Run `npm run validate` and `npm test`
4. Load the unpacked extension and test a page you are authorized to use
5. Open a pull request using the template

## Translations

Interface text lives in `i18n.js`. English is the reference; the Hausa, Yorùbá, Igbo and Pidgin tables are drafts and corrections from native speakers are very welcome. Keep placeholders such as `{count}` exactly as written. A key you leave out falls back to English. `npm test` checks every key and placeholder.

## Code style

- Manifest V3 only
- No inline scripts in extension pages
- Keep permissions as narrow as the feature allows
- Prefer clear names over comments
