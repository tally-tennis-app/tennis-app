# Deploy and rollback

## Release

1. Require green formatting, lint, type checking, unit tests, production build,
   pgTAP, transaction-concurrency tests, type drift, and desktop/mobile browser
   tests.
2. Push migrations to preview, run Supabase security advisors, then deploy the
   preview application.
3. Complete the preview smoke test in `environments.md`.
4. Review every production migration for backward compatibility with the
   currently deployed application. Prefer additive changes and delay destructive
   cleanup to a later release.
5. Push production migrations, run advisors, deploy the same reviewed commit,
   and repeat the production smoke test.
6. Search runtime logs for `application_error`. These structured logs are a
   pilot diagnostic path, not durable alerting; configure a retained log drain or
   error service before the pilot needs paging or long-term incident history.

## Application rollback

If the application release is bad and the database remains compatible, stop new
deployments and roll the production alias back to the last known-good deployment.
Vercel supports an instant rollback from the deployment menu or CLI; follow the
current [production rollback instructions](https://vercel.com/docs/deployments/rollback-production-deployment).
Then run the production smoke test and record the failed and restored commit IDs.

An application rollback does not reverse a database migration. This is why each
release must keep the new schema compatible with the previous application.

## Database recovery

For a harmful database change or data loss:

1. Pause application writes or place the application in maintenance mode.
2. Preserve logs and take a fresh backup if the database remains reachable.
3. Identify the recovery point and impact. Obtain explicit operator approval
   before any destructive cloud restore.
4. Restore or duplicate into a new Supabase Cloud project using Supabase's
   supported recovery flow. Do not restore over preview or production as a test.
5. Compare counts, schema, RLS, policies, function grants, and derived ratings;
   run a private smoke test.
6. Change the production deployment to the recovered project's public URL/key,
   verify Auth redirect configuration, deploy, and only then resume writes.

The logical sequence and encrypted-data limitations are documented by Supabase:
[Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
