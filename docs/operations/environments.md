# Cloud environments

The pilot uses two independent Supabase Cloud projects in the
`tally-tennis-app` organization:

| Environment | Supabase project                             | Application deployment                              |
| ----------- | -------------------------------------------- | --------------------------------------------------- |
| Preview     | `tennis-preview` (`ubbsiozrhpypjlsztwxk`)    | Pending Vercel GitHub integration and first preview |
| Production  | `tennis-production` (`ryowfnsbwdyrqpxsyvfp`) | <https://tennis-app-vert.vercel.app>                |

Local Supabase is test data only. Preview must never connect to production, and
production must never use a loopback URL.

## Values and secret scopes

Set these two browser-safe variables independently in each deployment scope:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Preview values come from `tennis-preview`; production values come from
`tennis-production`. Database passwords, secret/service-role keys, Supabase
access tokens, and connection strings stay in the deployment secret store or a
password manager and never use a `NEXT_PUBLIC_` prefix.

## Provisioning

1. Create both projects in the same nearby region and record their project refs
   and passwords in the team password manager. Completed 2026-09-14 in
   `us-east-1`; database passwords and publishable keys are stored in macOS
   Keychain under the corresponding project names.
2. Run the local release gate from a clean commit.
3. Link and push migrations to preview first. Discover flags with
   `supabase link --help` and `supabase db push --help`; confirm the displayed
   project ref before every push. Never include seed data.
4. Run `supabase db advisors --linked --type security --level warn`. Fix every
   unexpected finding. The remaining warnings are the authenticated
   `SECURITY DEFINER` RPCs and policy helpers whose authorization behavior is
   covered by pgTAP; there must be no anonymous or error-level findings.
5. Configure preview Auth Site URL and redirect allow-list for the preview host,
   including `/auth/callback` and `/update-password` flows.
6. Deploy the preview application with only preview public variables. Verify
   signup confirmation, login, session reload, group membership, match submit,
   opponent confirmation, standings, ratings, profile update, and logout.
7. Repeat migration dry-run, push, advisors, Auth URL configuration, and smoke
   checks against production. Use only production variables in the production
   deployment.

## Current deployment state

The Vercel project is `max-be74/tennis-app`. Its Preview and Production scopes
contain independent Supabase URLs and publishable keys. The first deployment of
commit `5473e15` established the production alias and passed signed-out route,
manifest, Supabase REST, and Supabase Auth endpoint checks on 2026-09-14.

Vercel could not connect the GitHub repository because its GitHub app does not
currently have access to `tally-tennis-app/tennis-app`. Grant that repository to
the Vercel GitHub app, connect it to the project, and create the first pull-request
preview before completing the authenticated preview smoke test. After pull
request #20 merges, deploy the merge commit to production and repeat the smoke
test; do not treat the initial branch deployment as the final pilot release.

Supabase recommends separate local, staging, and production environments:
[Managing environments](https://supabase.com/docs/guides/deployment/managing-environments).
The application uses committed migrations as the schema source of truth; do not
edit application schema in the Dashboard.

## CI safety

CI starts an isolated local Supabase stack and generates short-lived test users.
It refuses non-loopback fixture URLs. CI never links to or mutates a hosted
project. Hosted schema pushes remain a deliberate operator action until GitHub
environments, protected reviewers, and separate secrets exist.
