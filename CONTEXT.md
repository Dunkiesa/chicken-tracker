# ChickenTrack — Context

Egg-production tracking for a single small backyard flock (currently 5 birds; designed for ~20, with a practical ceiling of ~100). A responsive Next.js web app (mobile = quick egg entry at the coop; desktop = enrollment and analysis) backed by one RESTful API and a SQL Server Express database, all run via Docker on a personal Ubuntu server.

The system is **always-online over the local network** — the coop has reliable WiFi and a LAN to the server, so there is no offline/PWA support. Internet is needed only for remote (out-of-house) access and for Google sign-in.

## Roles & access

- **Admin** — enrolls chickens, manages profiles, manages the dynamic lists and the user allowlist, views the dashboard. Can mutate data.
- **Viewer** — reads data and logs eggs (and edits/deletes their own egg entries), but cannot enroll or edit chickens.

Identity comes from **Google login**, but access is restricted by an **allowlist**: only emails in the `users` table may use the system. Google authenticates (proves who you are); the allowlist authorizes (decides if you're allowed in) and assigns the role. An account not on the allowlist is denied even after signing in to Google. The first Admin is seeded from configuration to avoid lockout; Admins manage the allowlist thereafter. Sessions are **long-lived** and validated locally against the allowlist on every request, so routine coop logging works over the LAN without re-contacting Google — only the occasional sign-in/re-login needs internet. The user base is small and trusted, so long-lived tokens are an acceptable risk.

## Glossary

- **Chicken** — an individual bird, identified by an auto-assigned internal **unique ID**. The human identifier is the **Name** (unique across the flock, never reused — including after departure) together with the bird's **primary photo**, since birds are recognized by appearance, not physical tags. Carries Name, Sex, Breed, Origin Source, Acquisition Type, photos, notes, and a departure status.
- **Sex** — a fixed enumeration: **Hen**, **Rooster**, or **Unknown**. **Laying-eligible** birds are Hens and Unknowns; Roosters are hidden from the egg picker by default (with a "show all" escape hatch) and excluded from production metrics. Eligibility follows the current sex value (correctable).
- **Dynamic list** — a value set that grows on use. Breed, Origin Source, and Acquisition Type are dynamic lists: entry is **pick-first** (choose an existing value; typing a new one is secondary) with **case-insensitive, trimmed matching** to avoid near-duplicates. Admins can **rename, remove, and merge** values (merge re-points affected chickens to the canonical value).
- **Egg** — a single egg attributed to **exactly one** chicken (the user always decides, even for the ~1% resolved by judgment from recent laying and egg characteristics). Has a **weight in grams to 2 decimal places** (e.g. 58.34 g) and a date. At most one egg per chicken per day is expected, enforced as a **soft, overridable warning** — not a hard block. Weights outside ~20–200 g warn but are not blocked. Eggs can be edited and deleted (Viewers their own, Admins any).
- **Quick Log** — the mobile fast-path for egg entry: date defaults to today, the most-recently-used chicken is pre-selected, so only the weight is needed.
- **Photo** — an uploaded image of a chicken with a free-form description and timestamp. The file lives in the server's **local image folder** (a durable Docker volume); only its path is stored in the database. One photo is the **primary photo** (thumbnail in lists and the egg picker). Photos render as a chronological **gallery** on the profile.
- **Note** — a dated free-text entry in a chicken's chronological **notes log** (e.g. vet visits, medications). Notes can be added, edited, and deleted.
- **Departure / status** — whether a chicken has left the flock, with a **date** and a structured **reason** (died/illness, sold, predator, gave away, **Other** + free-text). Departure is a status change, never a delete: all history is retained. Departed birds are hidden from the egg picker and the default list (with a "show departed" toggle) but their profile stays viewable and annotatable. The reason is the primary signal; it drives coop-security and care decisions.

## Derived metrics (dashboard)

Computed from egg and chicken data, never stored. All obey one **date-range selector**, defaulting to the **last 12 months**, and are computed over laying-eligible birds (departed birds' history counts within their active periods):

- **Production over time** — egg counts per day/week/month, flock-wide and per hen.
- **Average weight** — mean egg weight per hen and flock-wide.
- **Egg weight variance** — min / max / standard deviation of a hen's egg weights.
- **Most productive chicken** — hens ranked by egg count (show all; top-N fallback at scale).
- **Production consistency** — laying rate as a percentage: eggs ÷ days in the window, per hen.
- **Dry period** — per hen, the current dry streak (days since last egg) and longest historical streak; hens past the threshold (configurable, **default 4 days**) are surfaced prominently as a broodiness/molting care signal.
- **Seasonal trends** — production by calendar month / Southern-Hemisphere season across years.
- **Attrition** — a **by-reason breakdown of departures** (primary), with the attrition rate (departures ÷ average flock size) as a secondary figure.

## Scope

Single flock only. **Backups are out of scope** — the operator has their own backup systems; the app's responsibility ends at keeping data on durable Docker volumes. Also out of scope: IoT sensors / automatic feeders, external marketplace integration, real-time chat. A possible future enhancement (not now): a notification when a hen crosses the dry-period threshold.

## Decisions

Architectural decisions are recorded in `docs/adr/`.
