# Shelfy — Multi-Tenant Inventory Management

React, Tailwind CSS, Zustand, i18next, Express, Prisma/PostgreSQL, Redis, Socket.io and Nodemailer. Each company has independent users, products, warehouses, operations, ledger and audit history. Stock is calculated from an immutable ledger rather than a mutable product quantity.

## Run

```sh
docker compose up --build
```

Open http://localhost:8080. Compose starts PostgreSQL and Redis, deploys migrations, seeds demo companies and serves the frontend through Nginx. Existing data is preserved. Docker was unavailable in the implementation environment, so a Compose run has not been verified there.

Both demo company codes, `SHELFY` and `NOVA`, support these accounts:

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

Sign in using company code, login ID/email and password. Signup requires a 6–12 character login ID and matching passwords of at least eight characters with uppercase, lowercase and a special character. Access JWTs expire after 15 minutes; rotating HTTP-only refresh cookies last seven days. Password changes/resets revoke all sessions. Logout revokes its refresh session; already issued access tokens expire normally.

Recovery requires company code and email. OTPs are hashed, rate limited, single use and expire after five minutes. Configure real email delivery:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM=Shelfy <noreply@example.com>
```

Development without SMTP uses a console mailbox. Production recovery requires SMTP; real SMTP delivery has not been tested. Use `COOKIE_SECURE=true` behind HTTPS and replace demo/database credentials and JWT secrets before public hosting.

## API

Base path `/api`. Protected requests require `Authorization: Bearer <accessToken>`. Resource responses generally use `{ success, data }`.

| Endpoints | Purpose |
|---|---|
| `POST /auth/signup` | New company: `company_name`, `company_code`, account fields; join: `invite_code`, account fields |
| `POST /auth/login` | `company_code`, `login_id`, `password` |
| `POST /auth/forgot-password`, `/auth/reset-password` | Company-scoped OTP recovery |
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

The integration suite creates/removes an isolated PostgreSQL schema; the database user needs schema creation permission. It passed 90 checks for workflows, concurrency, authentication, invitations, tenant isolation, authorization, audit rollback, caches and sockets. All six language dictionaries passed key/interpolation checks and the production frontend build passed. Browser checks cover manager/staff visibility, audit expansion, translated navigation, appearance controls and preference persistence.
