# ChickenTrack — Context

Egg-production tracking for a single small backyard flock. A responsive Next.js web app (mobile = quick egg entry in the coop; desktop = enrollment and analysis) backed by one RESTful API and a SQL Server Express database, all run via Docker on a personal Ubuntu server.

## Roles

- **Admin** — enrolls chickens, manages profiles, views the dashboard. Can mutate data.
- **Viewer** — reads data and logs eggs, but cannot enroll or edit chickens.

Identity comes from **Google login**, but access is restricted by an **allowlist**: only emails in the `users` table may use the system. Google authenticates (proves who you are); the allowlist authorizes (decides if you're allowed in) and assigns the role. An account not on the allowlist is denied even after signing in to Google. The first Admin is seeded from configuration to avoid lockout; Admins manage the allowlist thereafter.

## Glossary

- **Chicken** — an individual bird in the flock, identified by an auto-assigned **unique ID**. Carries a name, **Sex**, Breed, Origin Source, Acquisition Type, photos, notes, and a departure status.
- **Sex** — a fixed enumeration: **Hen**, **Rooster**, or **Unknown**.
- **Dynamic list** — a value set that grows on use. Breed, Origin Source, and Acquisition Type are dynamic lists: entering a new value adds it to the list and offers it as a choice thereafter. Contrast with Sex, which is fixed.
  - **Breed** — the chicken's breed.
  - **Origin Source** — where the chicken came from.
  - **Acquisition Type** — how the chicken was acquired.
- **Egg** — a single egg attributed to one chicken on one date, with a recorded **weight**. At most **one egg per chicken per day**.
- **Quick Log** — the mobile fast-path for egg entry: date defaults to today, the most-recently-used chicken is pre-selected, so only the weight is needed.
- **Photo** — an uploaded image of a chicken with a free-form description and timestamp. The file lives in the server's **local image folder**; only its path is stored in the database. Photos render as a chronological **gallery** on the profile.
- **Note** — a dated free-text entry in a chicken's chronological **notes log** (e.g. vet visits, medications). Notes can be added, edited, and deleted.
- **Departure / status** — whether a chicken has left the flock and why. The leaving reason includes an **"Other"** option with a free-text detail.

## Derived metrics (dashboard)

Computed from egg and chicken data, not stored:

- **Production over time** — eggs laid across a time range.
- **Average weight** — mean egg weight, overall and per chicken.
- **Most productive chicken** — the chicken with the highest production.
- **Production consistency** — regularity of laying.
- **Egg weight variance** — spread of egg weights.
- **Seasonal trends** — production patterns across seasons.
- **Dry period** — a stretch in which a chicken laid no eggs.
- **Attrition rate** — rate of chickens leaving the flock, derived from departures.

## Scope

Single flock only. Out of scope: IoT sensors / automatic feeders, external marketplace integration, real-time chat.

## Decisions

Architectural decisions are recorded in `docs/adr/`.
