# Solid Drive Auto WA – dealership platform

Public website (browse stock, book test drives/inspections, pay a non-refundable deposit) and a private admin dashboard (inventory, expenses, sales, bookings, enquiries, Excel exports).

- Source of truth: [`Dealership Platform – Build Plan.md`](./Dealership%20Platform%20–%20Build%20Plan.md)
- Agent guide: [`docs/AGENTS.md`](docs/AGENTS.md) · Decisions log: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Repo layout

| Path | What |
| --- | --- |
| `apps/web` | Vite + React 19 SPA (React Router 7, TS, Tailwind v4, shadcn/ui) – public site `app/(site)` + admin `app/admin` (routes in `app/routes.tsx`), static deploy to Cloudflare Pages |
| `functions` | Firebase Cloud Functions (2nd gen, Node 20, region `australia-southeast1`) |
| `packages/shared` | `@sda/shared` – zod schemas, types, constants, money/GST, slug, status rules, finance calc, Perth time + slot helpers |
| `tests/rules` | Firestore + Storage security rules tests (`@firebase/rules-unit-testing`) |
| `scripts` | `seed.ts` (+ `seed.config.ts`), `with-java.sh` |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc` | Firebase config |

## Prerequisites

- Node 20+ (`.nvmrc` = 20; Node 22 works locally) and pnpm 11 (`corepack enable`)
- **Java 11+** for the Firestore/Storage emulators – `brew install openjdk@21`. `scripts/with-java.sh` finds it automatically even if the system Java is older.
- No Firebase login is needed for local dev: the emulators run the `demo-solid-drive` demo project.

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local       # emulator defaults
cp functions/.env.example functions/.env.local     # optional: functions env for the emulator

pnpm emulators     # builds functions, starts Auth, Firestore, Functions, Storage + UI (http://127.0.0.1:4010)
pnpm seed          # (new terminal) resets + seeds the emulators: settings, 20 cars, expenses, bookings, a sale, users
pnpm dev           # Vite dev server on http://localhost:3000  (admin at /admin)
pnpm dev:demo      # same, on the bundled demo data (no emulators needed)
```

Seed logins (emulator only; test values from `DEMO_ACCOUNTS` in `@sda/shared/demo`, passwords Demo-Admin-2026 / Demo-Staff-2026): `admin@soliddrive.test` (admin) and `staff@soliddrive.test` (staff).

Emulator ports are non-default so they don't clash with other Firebase projects: UI 4010, Auth 9109, Firestore 8188, Functions 5011, Storage 9209 (see `EMULATOR_PORTS` in `@sda/shared`). `pnpm emulators:persist` keeps data in `.emulator-data/` between runs.

### Checks

```bash
pnpm lint          # ESLint (flat config, whole repo)
pnpm typecheck     # tsc in every package + scripts/tests
pnpm test          # unit tests (shared helpers, functions core)
pnpm test:rules    # starts Firestore + Storage emulators and runs the rules tests (needs Java 11+)
pnpm --filter web build            # production build → apps/web/dist (+ sitemap.xml, robots.txt)
pnpm --filter web preview          # serve the last build locally (vite preview)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, both builds and the rules tests on every push.

## Conventions for contributors

- Import shared code from `@sda/shared` (schemas, `formatAUD`, `carSlug`, `canTransitionCar`, `calculateRepayments`, `formatInTz`, …).
- Money: integer cents (AUD), GST stored separately; GST rate is a percent setting (default 10).
- Client writes must include audit fields: `createFields(uid)` / `updateFields(uid)` from `apps/web/lib/firebase-writes.ts`. Soft delete only.
- ALL data access goes through `apps/web/lib/data`: public SSR reads from `@/lib/data/public`; admin reads/writes via `getAdminRepo()` and callables via `runAction()` from `@/lib/data`; auth via `useAuth()` from `@/lib/auth`. Both work in Firebase and demo mode.
- Every privileged write goes through a callable: `runAction('createBooking', input)` from `@/lib/data`; functions declare handlers with `defineCallable(name, handler)`.
- Car images: `carImageUrl(id, 'thumb' | 'card' | 'full')` from `apps/web/lib/images.ts`.
- shadcn/ui components are pre-installed in `apps/web/components/ui` – don't run the shadcn CLI concurrently from multiple agents.
- Log decisions not covered by the plan in `docs/DECISIONS.md`.

## Environments and deploy

| Alias (`.firebaserc`) | Firebase project | Web (Cloudflare Worker) |
| --- | --- | --- |
| `default` / `demo` | `demo-solid-drive` (emulator only) | `pnpm dev` |
| `staging` | `dealership-staging` | `solid-drive-web-staging` |
| `prod` | `dealership-prod` | `solid-drive-web` |

Real projects don't exist yet – create them per the plan's setup steps (Firestore/Auth/Storage/Functions in `australia-southeast1`) before deploying.

**Firebase (rules, indexes, functions)**

```bash
firebase login
# secrets (once per project): TURNSTILE_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
# RESEND_API_KEY, CF_IMAGES_API_TOKEN, CF_CACHE_PURGE_TOKEN, STOCK_FEED_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY --project staging
# plain env: functions/.env.dealership-staging (EMAIL_FROM, DEALERSHIP_NOTIFY_EMAIL, CF_ACCOUNT_ID, CF_ZONE_ID, SITE_URL)

firebase deploy --project staging --only firestore:rules,firestore:indexes,storage
firebase deploy --project staging --only functions        # predeploy builds functions/lib
# production: same commands with --project prod
```

**Web (Cloudflare Pages, static SPA)**

The web app is a static build (`apps/web/dist`). `public/_redirects` serves `index.html` for every route; `public/_headers` sends `X-Robots-Tag: noindex` for `/admin` and long-cache headers for `/assets/*`. Build-time env: `VITE_*` (see `.env.example`) for the target environment, set in the Cloudflare Pages project (or `apps/web/.env.production`).

```bash
cd apps/web
npx wrangler login
pnpm build                                                     # refuses to run with VITE_DEMO_MODE=true
npx wrangler pages deploy dist --project-name <pages-project>  # or connect the repo in Cloudflare Pages: build command `pnpm --filter web build`, output `apps/web/dist`
```

## Client preview deploy (demo mode – no Firebase/Stripe accounts needed)

`VITE_DEMO_MODE=true` builds the site on the bundled sample data (`@sda/shared/demo`, the same data `pnpm seed` writes). Public pages render from the fixtures; forms validate and show their success state without sending anything; the admin accepts the demo accounts below and saves edits only in the viewer's browser (with a reset button).

| Account | Email | Password |
| --- | --- | --- |
| Admin | admin@soliddrive.test | Demo-Admin-2026 |
| Staff | staff@soliddrive.test | Demo-Staff-2026 |

```bash
pnpm install
pnpm --filter web dev:demo               # optional: dev server on the demo data (http://localhost:3000)
pnpm --filter web build:preview          # optional local check (demo build) …
pnpm --filter web preview                # … served locally
cd apps/web && npx wrangler login        # once – a free Cloudflare account is enough
pnpm --filter web deploy:preview         # demo build + `wrangler pages deploy dist --project-name solid-drive-preview` → https://solid-drive-preview.pages.dev
```

No other env vars are needed. Demo mode must never be used for production: `pnpm build` sets `SDA_DEPLOY_ENV=production` and `vite.config.ts` fails the build if demo mode is on.

## First admin

```bash
# emulator (pnpm seed already creates admin@soliddrive.test)
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9109 FIRESTORE_EMULATOR_HOST=127.0.0.1:8188 \
  pnpm create-admin --project demo-solid-drive --email you@example.com --name "Your Name" --password "a-test-password"

# staging / production (uses Application Default Credentials)
gcloud auth application-default login
pnpm create-admin --project dealership-staging --email owner@client.com.au --name "Owner Name"
```

Without `--password` the script prints a password-reset link so the admin sets their own password. The script sets the `role: 'admin'` custom claim and writes `users/{uid}`. Admins then enrol TOTP 2FA on first login. Further users are invited from `/admin/users`.
