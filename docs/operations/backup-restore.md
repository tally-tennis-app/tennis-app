# Backup and restore verification

Run the synthetic recovery rehearsal with:

```bash
npm ci
npm run db:restore-drill
```

The script creates two disposable local Supabase projects on loopback ports
56432 and 57432. It refuses the repository's normal and active test project IDs
and ports. It migrates a source, inserts synthetic auth users, memberships, and
confirmed/pending/void matches, creates checksummed role/schema/data dumps,
restores a clean target, and compares:

- application row counts and stable content hashes;
- tables, views, function signatures, and application-owned Auth/Storage
  triggers;
- RLS flags, policies, and routine grants;
- global derived ratings;
- the complete pgTAP policy and validation suite on the restored target.

Temporary files use owner-only permissions and are deleted on exit. `--keep-artifacts`
is for local diagnosis only and may retain synthetic plaintext dumps. Never add
those files to Git.

This proves the application-level logical recovery mechanism. It does not prove
a production recovery because Supabase-managed encrypted values can depend on a
project encryption root. After production is provisioned and before real pilot
data is considered recoverable, repeat a read-only production backup into a
disposable target using Supabase's supported cloud restore/duplicate flow and
record privacy-safe evidence. Database backups also exclude Storage objects; add
a separate object-backup procedure if uploads are introduced.

Current source: [Supabase CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
