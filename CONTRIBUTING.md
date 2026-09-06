# Contributing

## Roles

- `maxsiska3` and `mateolfig` are technical owners and code owners.
- Marketing collaborators receive the GitHub Triage role after creating accounts. Triage can manage issues, labels, and planning without pushing application code.

## Change workflow

1. Open or claim an issue that states the player problem and acceptance criteria.
2. Branch from an up-to-date `main` using `feature/<short-name>`, `fix/<short-name>`, or `chore/<short-name>`.
3. Keep commits focused and never commit secrets or generated build output.
4. Open a pull request using the template and include screenshots for visual changes.
5. Wait for the `quality` check and one approval from the other technical owner.
6. Resolve every conversation, squash-merge, and delete the branch.

## Local quality gate

Run this sequence before requesting review:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` when routes, metadata, the manifest, browser behavior, or visible UI changes.

## Data and security

- Public Supabase publishable keys belong in environment variables, not hard-coded application modules.
- Service-role keys and database passwords are server-only secrets and must never use a `NEXT_PUBLIC_` prefix.
- No production user data may enter the shared development Supabase project.
- Every future user-data table requires Row Level Security policies and policy tests in the same pull request.
