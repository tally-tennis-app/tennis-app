# ADR 0003: Separate preview and production databases

- Status: accepted
- Date: 2026-09-14

## Decision

The pilot uses independent Supabase Cloud projects for preview and production.
Local Supabase remains isolated test infrastructure. Seeded browser tests run only
against loopback databases.

This supersedes ADR 0002's temporary allowance for previews and production to
share one project.

## Consequences

- Preview deployments cannot change production records or exercise production
  credentials.
- Migrations move through preview before production and must remain compatible
  with application rollback.
- Each environment needs its own Auth Site URL, redirect allow-list, public URL,
  publishable key, database password, and operator access.
- Supabase billing may be required because active free-project limits apply
  across organizations where an owner or administrator participates.
