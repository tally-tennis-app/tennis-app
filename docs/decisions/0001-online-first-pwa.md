# Decision 0001: Start with an online-first PWA

- **Status:** Accepted
- **Date:** 2026-09-06

## Context

The first audience is one invite-only tennis group. The team needs one maintainable product surface more than it needs app-store distribution or operating-system integrations.

## Decision

Ship the responsive Next.js site as an installable Progressive Web App. The v1 experience requires a network for every screen and action. Do not cache authenticated records, queue match submissions, or attempt background synchronization.

The manifest provides standalone display and launcher icons. Browser installation is the only desktop distribution mechanism during the pilot.

## Why not a desktop wrapper now?

Tauri 2 can package a web frontend into small native bundles, but its supported Next.js path expects a static export. Committing to static output now would constrain server rendering and server actions before a desktop installer has demonstrated value. Electron provides a mature Node.js desktop runtime but adds a larger bundle and another signing, updating, and security surface.

## Revisit after the pilot

Run a time-boxed Tauri feasibility spike only when pilot evidence shows at least one of these needs:

- users need downloadable installers or app-store delivery;
- browser PWA installation is a material onboarding barrier;
- the product needs tray behavior, filesystem access, or another native API;
- desktop-specific notifications provide measurable value.

The spike must compare static export with a hosted-webview approach, verify Supabase authentication and deep-link handling, build macOS and Windows packages, document signing costs, and test updates. Electron is considered only if required Node-native libraries make Tauri impractical.

## References

- [Installable PWAs](https://web.dev/learn/pwa/installation)
- [Tauri with Next.js](https://tauri.app/start/frontend/nextjs/)
- [Tauri distribution](https://tauri.app/distribute/)
- [Next.js deployment modes](https://nextjs.org/docs/app/getting-started/deploying)
