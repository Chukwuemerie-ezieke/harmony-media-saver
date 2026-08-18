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
3. Run `npm run validate`
4. Load the unpacked extension and test a page you are authorized to use
5. Open a pull request using the template

## Code style

- Manifest V3 only
- No inline scripts in extension pages
- Keep permissions as narrow as the feature allows
- Prefer clear names over comments
