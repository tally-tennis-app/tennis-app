# Tennis App

An online-first tennis community app for private groups, opponent-confirmed match scores, standings, and derived global and group Elo ratings.

## Prerequisites

- Node.js 24 LTS (`nvm use` reads the committed `.nvmrc`)
- npm 11 or newer
- Supabase CLI plus a container runtime for local data-backed work

## Local setup

```bash
git clone https://github.com/tally-tennis-app/tennis-app.git
cd tennis-app
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Start the local Supabase stack and place its browser-safe URL and publishable key in `.env.local`. Never commit `.env.local`, secret/service-role keys, database passwords, or access tokens.

Open [http://localhost:3000](http://localhost:3000). Authenticated screens require the configured database.

## Commands

| Command                    | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | Start the Next.js development server     |
| `npm run build`            | Produce a production build               |
| `npm run start`            | Serve the production build               |
| `npm run format:check`     | Verify Prettier formatting               |
| `npm run lint`             | Run ESLint                               |
| `npm run typecheck`        | Check TypeScript without emitting files  |
| `npm test`                 | Run unit and component tests once        |
| `npm run test:e2e`         | Run desktop/mobile browser smoke tests   |
| `npm run db:test`          | Run database policy and validation tests |
| `npm run db:restore-drill` | Verify a disposable backup and restore   |

Install the Playwright browser once before the first local end-to-end run:

```bash
npx playwright install chromium
```

## Collaboration

- Create a short-lived branch from `main` for each change.
- Open a pull request and wait for CI plus one approval from the other technical owner.
- Resolve review conversations before merging.
- Squash-merge approved pull requests and delete the source branch.
- Use issues for product ideas and bugs so non-technical teammates can participate through the Triage role.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete working agreement.

## Environments and deployment

- Pull requests use the preview deployment and `tennis-preview` Supabase Cloud project.
- `main` uses the production deployment and independent `tennis-production` project.
- The only browser-exposed values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

See [cloud environments](docs/operations/environments.md), [deployment and rollback](docs/operations/deploy-rollback.md), and [backup verification](docs/operations/backup-restore.md).

## Install as a desktop app

The foundation is an online-only Progressive Web App. In a supported desktop Chrome or Edge browser, open the deployed site and choose **Install Tennis App** from the address bar or browser menu. The installed app opens in its own window and remains network-dependent.

Native installers are intentionally deferred. See [the desktop decision record](docs/decisions/0001-online-first-pwa.md) for the Tauri evaluation gate.

## Product boundaries

The pilot includes authentication, groups, verified singles matches, standings, and derived Elo. Scheduling, tournaments, push notifications, doubles, and offline synchronization remain outside the pilot. Product decisions are recorded in [docs/product-questions.md](docs/product-questions.md), with match immutability and ratings in [ADR 0002](docs/decisions/0002-match-immutability-and-derived-ratings.md). Current delivery status is in [nextsteps.md](nextsteps.md).

## License

No open-source license has been granted. The repository is publicly readable, but all rights remain reserved by the project owners.
