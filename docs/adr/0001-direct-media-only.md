# ADR 0001: Direct media only

## Status

Accepted — 2026-08-18

## Context

Generic "download any video" extensions often stitch HLS/DASH segments or target commercial streaming catalogs. That violates copyright expectations and Chrome Web Store policy.

Harmony Digital Consults needs a safer tool for LMS assets, training recordings, and other files a school already has the right to keep.

## Decision

v1 only downloads URLs that are already ordinary HTTP(S) media files. Streaming playlists are visible but not saved as videos. Major streaming hosts are blocked by default.

## Consequences

Some sites will show no downloadable file. That is expected. Future work may add an authorized workflow for media Harmony hosts, using signed URLs from our own API rather than scraping third-party players.
