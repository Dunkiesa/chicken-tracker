## Agent skills

### Issue tracker
Issues are tracked as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels
The project uses the canonical triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs
The project uses a single-context layout with `CONTEXT.md` at the root. See `docs/agents/domain.md`.

## Improve skill workflow

When using the `improve` skill's `execute` variant, use a **named branch + worktree** approach:

1. Create a branch from `HEAD`: `git branch improve/<plan-number>-<slug> HEAD`
2. Create a worktree from that branch: `git worktree add <worktree-path> improve/<plan-number>-<slug>`
3. Dispatch the executor to work in the worktree and commit to the branch
4. Leave both the branch and worktree in place for the user to inspect and merge

Do NOT use a detached HEAD worktree, and do NOT remove the worktree after review. The user reviews the diff at their convenience and merges when ready.

## Tests

The project has two Jest configs with separate runners:

| Command | Config | Tests | Suites |
|---------|--------|-------|--------|
| `npm test` | `jest.config.ts` | Unit/integration (node env) | 7 |
| `npm run test:components` | `jest.component.config.ts` | Component (jsdom, JSX) | 5 |
| `npm run test:all` | both | All of the above | 12 |
| `npm run test:integration` | `jest.integration.config.ts` | Integration | — |

`jest.config.ts` excludes `tests/components/` via `testPathIgnorePatterns` — component tests require `jsdom` and a JSX-aware `tsconfig.jest.json`.
