# 5. Always-online over the local network (no offline support)

- Status: Accepted
- Date: 2026-06-30

## Context

Eggs are logged from a mobile device at the coop. A common worry for such apps is connectivity dead zones — but here the coop has reliable WiFi and sits on the same LAN as the Ubuntu server. Internet is only needed for out-of-house access and for the one-time Google sign-in. The question was whether to build offline-first (a PWA with a local queue and sync) or always-online.

## Decision

Build the app **always-online over the local network**. No service worker, local write queue, or sync/conflict machinery. The client talks to the API over the LAN; if it cannot reach the API, the action fails and is retried.

To keep this consistent with Google login (which needs the internet), **sessions are long-lived and validated locally** against the allowlist over the LAN — routine logging never re-contacts Google (see ADR 0003). Only the occasional initial sign-in or re-login needs internet.

## Consequences

- Far simpler client: no offline storage, no sync reconciliation, no conflict resolution.
- Day-to-day egg logging works whenever the LAN is up, even if house internet is down.
- If a long-lived session expires while internet happens to be down, that user must wait for internet to sign back in — acceptable given internet is usually present and the flock is small.
- This decision is safe only because coop connectivity is reliable; it would need revisiting if the app were ever used somewhere with spotty local networking.

## Alternatives considered

- **Offline-first PWA** — robust to dead zones, but a large amount of complexity (service worker, queued writes, sync, conflict resolution) that buys nothing given reliable coop WiFi. Rejected.
