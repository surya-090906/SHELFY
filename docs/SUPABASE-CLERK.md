# Supabase database and Clerk email verification

The app defaults to Clerk email OTP authentication. There is no phone input or SMS flow. Live authentication requires keys from your own Clerk application; the app displays a setup message until a publishable key is supplied.

## Clerk setup

In the Clerk Dashboard, configure:

1. Email required, verify at sign-up with **Email verification code**.
2. Email sign-in with **Email verification code**.
3. Phone sign-up/sign-in and phone requirements disabled. Disable password and social sign-in for an email-only instance.
4. Open access, with no extra required profile fields or session tasks. Shelfy's invitations and company membership checks run separately on the backend.

Place these values in ignored local environment files, never in source control:

```env
# backend/.env
AUTH_PROVIDER=clerk
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,http://localhost:8080
```

```env
# frontend/.env.local
VITE_AUTH_PROVIDER=clerk
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

Restart the backend and Vite after changing environment variables. The keys must belong to the same Clerk application. For Docker, provide `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in the Compose environment and rebuild the frontend. Use your actual HTTPS frontend origin in `CLERK_AUTHORIZED_PARTIES` for hosted deployments.

Clerk delivers and verifies the code. Shelfy verifies the resulting token, its allowed origin, active provider session and verified primary email. Existing memberships link only when that verified email matches the email in the selected company. A Clerk account alone grants no company access. New users create a company or use an invitation whose email restriction and role are checked on the server. The same Clerk identity can belong to different companies.

Shelfy's short-lived access tokens retain company/role context. Refresh rechecks the Clerk session. Logging out signs out of both services. An already issued Shelfy access token lasts up to 15 minutes; role changes invalidate it through the database token version. Password changes and custom SMTP OTP routes are disabled in Clerk mode.

The old demo passwords work only with both `AUTH_PROVIDER=local` and `VITE_AUTH_PROVIDER=local`, an explicit development compatibility mode. The seeded example email addresses cannot receive real verification codes; use an email you own to create a company or accept an invitation.

Official references: [Clerk React setup](https://clerk.com/docs/react/getting-started/quickstart), [email sign-in-or-up flow](https://clerk.com/docs/guides/development/custom-flows/authentication/sign-in-or-up), [token verification](https://clerk.com/docs/reference/backend/verify-token).

## Supabase preparation

Create or select an empty Supabase project. From its Connect dialog, obtain the PostgreSQL **session pooler** URI (port 5432) or direct URI. The session pooler works on IPv4; the direct host normally requires IPv6. Use TLS (`sslmode=require`). Use the database connection string, not the project API URL or anon key.

Keep the local database selected until migration succeeds:

```env
# backend/.env — source remains local during preparation
DATABASE_URL=your_current_local_database_url
DIRECT_URL=your_current_local_database_url
SUPABASE_DIRECT_URL=your_target_supabase_session_or_direct_url
# Windows, if PostgreSQL tools are not on PATH:
PG_BIN=C:/Program Files/PostgreSQL/18/bin
```

Percent-encode special characters in the database password. Keep the target connection private.

From `backend`, run:

```sh
node scripts/migrate-supabase.cjs --check
```

The preflight reads counts and rejects targets that already contain Shelfy application or migration tables. It never overwrites an existing hosted inventory database.

Stop inventory writes for the transfer, then run:

```sh
node scripts/migrate-supabase.cjs --apply
```

The script creates a full local backup under ignored `artifacts/`, deploys the migrations to the empty target, restores inventory data in a transaction and compares every business table's row count. It excludes local OTPs and refresh sessions. It preserves the local source and does not switch credentials automatically. If restoration fails after schema deployment, keep using the source and investigate the target; do not drop tables containing business data just to retry.

After verification, update `DATABASE_URL` and `DIRECT_URL` to the Supabase session/direct URI and restart the backend. Both can use the port 5432 session pooler for this persistent Express server. If using the transaction pooler for runtime, use port 6543 with `pgbouncer=true` for Prisma 5, and retain the direct/session URI in `DIRECT_URL` for migrations.

The `202609260008_supabase_api_isolation` migration enables RLS and removes access for Supabase's `anon` and `authenticated` roles on Shelfy tables. Use the database owner connection for this server's Prisma repository. Browser clients access inventory through the tenant-scoped Express API; they must not query these tables through Supabase's Data API.

The supplied `docker-compose.yml` runs a local PostgreSQL container. For a hosted database deployment, set the backend's two database URLs to Supabase and remove its local `postgres` dependency/service; retain Redis if wanted. Never run the demo seed automatically against a real inventory database unless those demo companies are intended.

Official reference: [Supabase with Prisma](https://supabase.com/docs/guides/database/prisma).

## Theme behavior

Login includes Light and Dark controls and defaults to Light on a fresh browser. A visitor's explicit login theme is remembered locally. Signed-in users retain their saved account preference; new accounts default to Light. Existing deliberate Dark/System choices are preserved.

## Validation status

The production frontend builds, all six locale files validate, and backend tests cover Clerk identity checks and company authorization using mocked provider responses. Live Clerk email delivery and Supabase import require your service configuration and must be checked with a real mailbox/project before deployment.
