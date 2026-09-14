# Backup/restore drill — 2026-09-14

- Scope: synthetic application recovery; no hosted project accessed
- Source: disposable `tennisapp-restore-source`, loopback port 56432
- Target: clean disposable `tennisapp-restore-target`, loopback port 57432
- Command: `npm run db:restore-drill`
- Result: pass

The source contained three synthetic Auth/profile users, one group, three
memberships, three matches covering confirmed, pending, and void states, and six
sets. The role, schema, application-owned Auth trigger, and data dumps were
restored into a clean target.

Source and target matched on row counts, stable content hash, schema/function/
trigger hash, RLS/policy/table/routine-grant hash, and derived rating hash. The
restored target then passed all 194 pgTAP assertions across six files. Temporary
plaintext artifacts were deleted by the script.

The production-to-disposable-cloud recovery rehearsal remains pending until the
production project exists. That exercise requires protected operator approval
and privacy-safe evidence; it must not restore over preview or production.
