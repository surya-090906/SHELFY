# Shelfy — Multi-Tenant Inventory Management

**Current authentication:** Clerk email OTP is the default; there is no mobile verification. Configure Clerk keys before signing in. Login now has Light/Dark controls and defaults to Light. See [Supabase and Clerk setup](docs/SUPABASE-CLERK.md) for configuration, database migration and validation status. The local password/SMTP behavior described below is available only in explicit `local` compatibility mode.

React, Tailwind CSS, Zustand, i18next, Express, Prisma/PostgreSQL, Redis, Socket.io and Nodemailer. Each company has independent users, products, warehouses, operations, ledger and audit history. Stock is calculated from an immutable ledger rather than a mutable product quantity.

## Run

```sh
docker compose up --build
```

Open http://localhost:8080. Compose starts PostgreSQL and Redis, deploys migrations, seeds demo companies and serves the frontend through Nginx. Existing data is preserved. Docker was unavailable in the implementation environment, so a Compose run has not been verified there.

In explicit local compatibility mode, both demo company codes, `SHELFY` and `NOVA`, support these accounts:

| Role | Login ID | Password |
|---|---|---|
| Inventory Manager | `manager` | `Manager@123` |
| Warehouse Staff | `staff01` | `Staff@123` |

Existing StockSense installations migrate into SHELFY with their original records and credentials. The database name and browser session storage keys retain their original names for compatibility. Old authentication sessions are invalidated by migration; users sign in again with a company code.

## Local development

Requires Node.js 22+, PostgreSQL 14+, and optionally Redis. Windows users can use `npm.cmd` and `npx.cmd` if PowerShell blocks script wrappers.

```sh
cd backend
cp .env.example .env
# Configure DATABASE_URL, JWT_SECRET and JWT_REFRESH_SECRET.
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/socket.io` to port 5000. Optional frontend overrides: `VITE_API_URL`, `VITE_SOCKET_URL`.

For an original database created before migrations, mark its existing baseline once before deploying:

```sh
npx prisma migrate resolve --applied 202609260001_baseline
npx prisma migrate deploy
```

Do not baseline an empty database. Back up existing databases before schema upgrades. Seeds preserve populated companies rather than deleting records.

## Companies and access

Creating a company makes its founder the first Inventory Manager and creates a starter warehouse, Stock location and General category. The warehouse uses the company short code for references such as `COMPANY/IN/0001`.

Additional users join through manager-created invitations. Company and role come from the server's invitation record, never a signup role selector. Invitations optionally restrict an email, expire after seven days, are single use and can be revoked. A company cannot demote its last manager. Role changes invalidate existing tokens, refresh sessions and sockets.

| Capability | Manager | Staff |
|---|---|---|
| Read dashboard, catalog, stock and movement history | Yes | Yes |
| Operate receipts, deliveries and transfers | Yes | Yes |
| Maintain catalog, stock counts, warehouses and locations | Yes | No |
| Delete records | Yes, with integrity checks | No |
| Personal profile, password, language and appearance | Yes | Yes |
| Company settings, invitations and user roles | Yes | No |
| View and filter audit logs | Yes | No |

Permissions are enforced by the API. Company and Audit controls are absent from the staff interface.

## Tenant isolation

Tenant-scoped models carry `tenant_id`. Requests derive company context from a verified JWT and current database user. The ORM repository fails without company context and scopes reads, aggregates, writes and nested records. Client-supplied company IDs cannot override it. Composite database foreign keys prevent cross-company relationships.

Stock locks, reference counters, dashboard totals, Redis keys/pub-sub channels and Socket.io rooms are company scoped. Integration checks cover guessed foreign IDs, nested relationships, duplicate identities/SKUs across companies, invitation misuse, OTP isolation, independent counters and cache/socket isolation.

## Inventory and auditing

- Receipts progress Draft → Ready → Done. Validation receives stock once.
- Deliveries progress Draft → Ready → Done or wait for stock. Reservations prevent competing ready deliveries from dispatching the same stock. Incoming movements recheck waiting deliveries.
- On Hand is the ledger sum. Free to Use subtracts open delivery demand and can be negative.
- Stock counts write counted-minus-current adjustments. Transfers write equal and opposite movements in one transaction.
- Transaction locks prevent duplicate validation and overselling within each company.
- PostgreSQL blocks ledger and audit updates/deletes. Business mutations and server-generated before/after audit snapshots commit together. Audit failures roll back the mutation; credential fields are redacted.
- Manager audit views filter by user, action, entity and date, paginate 50 entries, and expand into field comparisons.
- List/Kanban views and printing for completed receipt/delivery documents are available.

Redis caches stock and dashboard data. Writes invalidate caches after commit and emit company-scoped updates. Development falls back to in-process caching if Redis is unavailable.

## Languages and appearance

English, Hindi, Tamil, Telugu, Malayalam and Kannada are available through Settings and the top navigation. Language, light/dark/system theme and 90–130% font scale persist on the user record and are cached locally for initial rendering. Language dictionaries load on demand. Inventory/company data remains as entered.

The UI uses a plum brand palette, semantic CSS color tokens, consistent status colors, responsive layouts and keyboard focus indicators. Translations are machine assisted with reviewed core inventory terminology; native-speaker review is recommended before publication. Maintain dictionaries in `frontend/src/locales` and run the locale checker for matching keys and interpolation tokens.

Editable Figma blueprints cover 15 screens in light, dark and 130% typography variants: [Shelfy Inventory Workspace](https://www.figma.com/design/L1rjbYbxnYxJpsu7issXsb). These document hierarchy, layout and palette rather than reproducing the app pixel for pixel.

## Authentication and email

Clerk handles email OTP sign-in and signup. Mobile numbers, SMS verification and local passwords are not used in the default configuration. Configure the backend secret key and frontend publishable key from the same Clerk application using the [setup guide](docs/SUPABASE-CLERK.md).

The backend verifies Clerk's token, allowed frontend origin, active session and verified primary email before selecting a company membership. Roles and invitation restrictions remain server-controlled. Access tokens last 15 minutes, rotating refresh sessions last seven days, and refresh checks the Clerk session again. Existing demo credentials and SMTP recovery apply only in explicit local compatibility mode.

New companies and users default to Light. Login visitors can switch between Light and Dark; signed-in account preferences remain separate.

## API

Base path `/api`. Protected requests require `Authorization: Bearer <accessToken>`. Resource responses generally use `{ success, data }`.

| Endpoints | Purpose |
|---|---|
| `POST /auth/clerk/session` | Verified Clerk bearer token plus `intent` (`login`, `create`, `join`) and company/invitation fields |
| `POST /auth/signup` (local compatibility) | New company: `company_name`, `company_code`, account fields; join: `invite_code`, account fields |
| `POST /auth/login` (local compatibility) | `company_code`, `login_id`, `password` |
| `POST /auth/forgot-password`, `/auth/reset-password` (local compatibility) | Company-scoped OTP recovery |
| `POST /auth/refresh`, `/auth/logout`; `GET /auth/me` | Sessions |
| `GET/PUT /settings`; `POST /settings/password` | Personal profile/preferences/password |
| `GET/PUT /company`; `GET /company/users` | Manager administration |
| `PUT /company/users/:id/role` | Manager role assignment |
| `GET/POST /company/invites`; `DELETE /company/invites/:id` | Invitations |
| `GET /audit` | Manager filters: `user_id`, `action`, `entity_type`, `from`, `to`, `page` |
| `/products`, `/categories`, `/warehouses`, `/locations` | Scoped catalog/storage |
| `/receipts`, `/deliveries`, `/transfers`, `/adjustments` | Scoped inventory operations |
| `/dashboard`, `/move-history` | Dashboard and history |

## Verification

```sh
cd backend
npm test
cd ../frontend
npm run check:locales
npm run build
```

The integration suite creates/removes an isolated PostgreSQL schema; the database user needs schema creation permission. It passed 103 integration checks plus 10 Clerk identity unit tests for workflows, concurrency, authentication, invitations, tenant isolation, authorization, audit rollback, caches and sockets. All six language dictionaries passed key/interpolation checks and the production frontend build passed. Browser checks cover manager/staff visibility, audit expansion, translated navigation, appearance controls and preference persistence. The new login Light/Dark switch was verified across reloads. Clerk provider calls are mocked in automated tests; live email delivery and Supabase import await service credentials.
