# Tennis App

An online-first tennis community app for logging verified match scores, deriving fair standings, and coordinating the next match. The current repository is the application foundation; authentication, groups, matches, ratings, and tournaments have not been implemented yet.

## Prerequisites

- Node.js 24 LTS (`nvm use` reads the committed `.nvmrc`)
- npm 11 or newer
- A Supabase project when working on data-backed features

## Local setup

```bash
git clone https://github.com/tally-tennis-app/tennis-app.git
cd tennis-app
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Replace the example values in `.env.local` with the development project's browser-safe Supabase URL and publishable key. Never commit `.env.local`, service-role keys, database passwords, or access tokens.

Open [http://localhost:3000](http://localhost:3000). The current landing page does not contact Supabase, so it can be previewed before credentials are added.

## Commands

| Command                | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the Next.js development server    |
| `npm run build`        | Produce a production build              |
| `npm run start`        | Serve the production build              |
| `npm run format:check` | Verify Prettier formatting              |
| `npm run lint`         | Run ESLint                              |
| `npm run typecheck`    | Check TypeScript without emitting files |
| `npm test`             | Run unit and component tests once       |
| `npm run test:e2e`     | Run the Chromium foundation smoke test  |

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

- Pull requests receive Vercel preview deployments.
- `main` deploys to production.
- Foundation previews and production may share the empty development Supabase project.
- Create a separate production Supabase project before any pilot user or match data is stored.
- The only browser-exposed values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Install as a desktop app

The foundation is an online-only Progressive Web App. In a supported desktop Chrome or Edge browser, open the deployed site and choose **Install Tennis App** from the address bar or browser menu. The installed app opens in its own window and remains network-dependent.

Native installers are intentionally deferred. See [the desktop decision record](docs/decisions/0001-online-first-pwa.md) for the Tauri evaluation gate.

## Product boundaries

This foundation contains no database schema, authentication flow, score parsing, Elo calculation, scheduling, tournament engine, push notifications, or offline synchronization. The open decisions that must precede those features are tracked in [docs/product-questions.md](docs/product-questions.md).

## License

No open-source license has been granted. The repository is publicly readable, but all rights remain reserved by the project owners.
