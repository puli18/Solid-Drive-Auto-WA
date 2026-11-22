# Foundation status – complete

All foundation (M1) deliverables plus the demo-mode data layer are in place. Nothing committed.

## Verified (2026-10-25)

| Check | Result |
| --- | --- |
| `pnpm install` | OK (store on internal disk) |
| `pnpm lint` | OK, 0 warnings |
| `pnpm typecheck` (shared, functions, web, scripts/tests) | OK |
| `pnpm test` | shared 33/33, functions 6/6 |
| `pnpm --filter web build` (emulator env) | OK |
| `NEXT_PUBLIC_DEMO_MODE=true next build` with no env file | OK |
| `opennextjs-cloudflare build` in demo mode + `wrangler dev --env preview` | OK – `/`, `/admin`, `/robots.txt`, `/images/cars/car-01.webp`, `/brand/logo-full.png` all 200; home renders fixture cars + Preview badge |
| `pnpm --filter functions build` + all emulators | OK – all 22 functions load (sendBookingReminders skipped: no pubsub emulator) |
| `pnpm seed` (shared dataset) | cars 20, carFinancials 20, vendors 7, bookings 5, enquiries 4, sales 1, deposits 1, expenses 53 |
| Firestore REST (public read path) against seeded emulator | published query 17 cars; unfiltered query, carFinancials denied; settings/business readable |
| `pnpm test:rules` (JDK 21 via scripts/with-java.sh) | 41/41 (Firestore 32, Storage 9) |

## Not verified

- Real deploys (`deploy:preview`, staging, prod) – need a Cloudflare login / real Firebase projects.
- CI workflow has not run on GitHub (no remote).
- Browser interaction of demo login / overlay writes (code path type-checked and SSR-rendered only).

# Functions progress (paused by the orchestrator, 2026-10-25 ~21:35)

## Done
- `@sda/shared/reports` (multi-file, `./reports` subpath, exceljs dependency): `buildCarReport`, `buildStockReport`, `stockSummaryCsv`, `expensesCsv`, `carReportDataFromSource`, `stockReportDataFromSource`, `reportSourceFromDemo`, `plainDates`, file-name helpers. Shared tests: 42/42 (33 Foundation + 9 reports). Shared typecheck clean.
- Every function in the plan is implemented in `functions/src/**`, plus `cleanupExports` (hourly, deletes exports older than 24 h). React Email templates are in `functions/emails/`. Functions typecheck and build are clean. Lint is clean for functions and shared (the one repo warning is in `apps/web/app/(site)/page.tsx`).
- Functions unit tests: 9/9. Emulator tests (`pnpm --filter functions test:emulator`): 24/24. They cover: 10 concurrent bookings for one car + slot → exactly 1 created; capacity under concurrency; blackout dates; cancel / reschedule / trigger releasing the slot; reminders; webhook replay (no change); two payments → 1 paid + 1 conflict; signature check; staff calling an export → permission-denied; export files downloaded and checked; users; stock feed.

## Shared core restore – what happened
- Cause: tsup `clean: true` in `functions/tsup.config.ts` followed the `functions/lib/node_modules → ../node_modules` symlink that `prepare-deploy.mjs` creates. A build at ~17:07 deleted files (directories survived) in `packages/shared` (through the `@sda/shared` workspace link), in `functions/node_modules/*` and in their root `.pnpm` copies. Fixed: `clean: false` plus `functions/scripts/clean-lib.mjs`, which empties `lib/` without following symlinks. Two consecutive builds were then verified to leave shared and node_modules untouched.
- Restore: src files came byte-identical from the Next dev source maps; the other files came from the Foundation agent's own heredocs, prettier-formatted (settings, booking, deposit, user, auditLog, schemas/index, index.ts + demo export, package.json with all 14 subpath exports, tsconfig `types: []`, vitest.config, all 7 Foundation tests). The partial reconstruction made at ~19:09 is saved at `/private/tmp/claude-501/-Volumes-Seagate-Expansion-Drive-Solid-Drive-Auto-WA/e3c9c540-1702-41ad-aa95-90b3ab9bc391/scratchpad/reconstructed-1909`. Some of its files had been made immutable (`chflags uchg`). I cleared the flag only on the files I restored, and have NOT re-locked them yet (paused).

## Left / not verified
- `pnpm typecheck` for web fails: the stray `apps/web/node_modules.broken-*` / `.hollow-*` backup directories are picked up by tsc, and there are 17 errors in admin/site code (nullable `next/navigation` params, a Firestore type). None involve `@sda/shared` or functions; they belong to other owners, and the backup directories need deleting by whoever created them. Scripts typecheck passes.
- Not verified (no keys): real Stripe Checkout / webhook from Stripe, Resend sending, Cloudflare Images upload/delete, cache purge, Turnstile with a real secret, V4 signed export URLs in production.

# Functions deployed (2026-11-22)

Live on `solid-drive-auto-wa`, 2nd gen, Node 22 (deploy: `FUNCTIONS_DISCOVERY_TIMEOUT=120 npx firebase deploy --only functions --project solid-drive-auto-wa`).
- `australia-southeast1` (21): callables getAvailability, createBooking, cancelBooking, rescheduleBooking, getManagedBooking, staffCreateBooking, createEnquiry, getTradeInUploadUrls, createDepositCheckout, getDepositStatus, getImageUploadUrl, deleteCarImage, exportCarReport, exportStockReport, setUserRole, inviteUser, deactivateUser; HTTP stockFeed, stripeWebhook; scheduled sendBookingReminders, cleanupExports (hourly).
- `australia-southeast2` (2, the Firestore database's location): onCarWrite, onBookingStatusChange.
- Secrets in Secret Manager: STOCK_FEED_KEY has a real random value; TURNSTILE_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, CF_IMAGES_API_TOKEN, CF_CACHE_PURGE_TOKEN are `unset`. Env (`functions/.env.solid-drive-auto-wa`): SITE_URL=https://soliddriveauto.com.au, ENFORCE_APP_CHECK=false. Artifact Registry cleanup policy: 1 day in both regions.
- Checked: stockFeed without key → 401; stripeWebhook → 503 "Webhook not configured"; getAvailability with empty input → 400 INVALID_ARGUMENT; no startup errors in logs.
- Not working until keys arrive: Stripe deposits (deposits are created `pending` without charging; webhook 503), emails (logged only), Turnstile (test secret, always passes), Cloudflare Images uploads (`failed-precondition`) and cache purge (logged).
- Not set up yet: default Storage bucket (exports, receipt/trade-in storage paths and cleanupExports need it); exports' signed URLs also need *Service Account Token Creator* on the runtime service account; no Auth users / admin account yet. The web app on the domain still runs the demo build, so nothing calls these functions yet.
