# Doryc operations

## Security checklist

- Keep `.env.local` out of Git. Only the Supabase publishable key belongs in the browser.
- Never add a Supabase service-role key to this application.
- Apply `supabase/schema.sql` and confirm RLS is enabled on every public financial table.
- Apply `supabase/optimize_financial_workflows.sql` and `supabase/launch_readiness.sql` after the base schema.
- Run the database linter in Supabase and verify that account deletion is executable only by `authenticated`.
- In Supabase Authentication, restrict redirect URLs to the local URL and the final production domain.
- Review Auth and API logs after repeated `401`, `500` or timeout responses.

## Backup and recovery

Before a schema change:

1. Create or download a Supabase database backup.
2. Save the SQL change as a new migration file under `supabase/`.
3. Apply it in a transaction whenever Supabase permits it.
4. Reload the PostgREST schema cache if the change adds API-visible columns.
5. Run the Doryc quality checks and verify login, dashboard loading and one read/write flow.

Do not use the reset scripts or seed data on the production project.

## Release checklist

1. Run lint, tests and the production build.
2. Confirm the loading screen hides zero-value dashboard content.
3. Test desktop, tablet and mobile widths.
4. Verify account balances, funding requirements and upcoming payments.
5. Verify create, edit, payment, undo and delete flows.
6. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS address.
7. Add that address to Supabase Auth redirect URLs.
8. Confirm the official support contact (`Richard Molina · ramolinap03@gmail.com`) remains current.
9. Configure the confirmation and password-recovery email templates.
10. Confirm automated quality checks pass on the release commit.

## Incident recovery

If data does not load, check the Supabase project status first. Doryc clears invalid local access tokens after a `401`, redirects to login and provides a retry action for transient API failures. Restart the Supabase project only when its services remain unhealthy; repeated restarts can prolong recovery.
