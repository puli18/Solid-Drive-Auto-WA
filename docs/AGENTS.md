# Agent guide – Solid Drive Auto WA

Every agent working on this repo reads this file and `Dealership Platform – Build Plan.md` (the source of truth) first.

## Client and brand

- Client: **Solid Drive Auto WA** (short mark: **SDA WA**), a used-car dealership in Western Australia (time zone `Australia/Perth`).
- Logos: `brand/logo_with_full_name.png|pdf` (full wordmark) and `brand/logo_without_full_name.png|pdf` (SDA WA mark). Both are chrome/silver lettering and a red swoosh car on pure black.
- Palette derived from the logo: near-black `#0A0A0B`, graphite `#17181B`, chrome/silver `#C9CCD1` → `#F4F5F7`, signal red `#D7261E` (accent, used sparingly like the orange in the reference), white surfaces `#FFFFFF` / `#F5F5F4` for the light sections.
- Design reference: `brand/design_reference.webp` (the "REVEX" landing page). Follow its structure and rhythm: dark photographic hero with a search bar overlay, big bold headline with a muted second line, bento grid "about" block, category cards, "latest cars" grid with New/Used tabs, a dark featured-car section with stats, a search/promo block, newsletter, giant wordmark footer. Swap REVEX's orange for the SDA red and the REVEX wordmark for "SOLID DRIVE" / SDA WA.
- All design tokens are CSS variables (plan says brand must be swappable).

## Stack (as in the plan; do not change without asking the orchestrator)

pnpm monorepo: `apps/web` (Vite + React 19 SPA with React Router 7, TS, Tailwind v4, shadcn/ui; static deploy to Cloudflare Pages – see DECISIONS "Web: Next.js → Vite"), `functions/` (Firebase Functions v2, Node 20, TS), `packages/shared` (zod schemas, types, constants).
Local dev uses the Firebase Emulator Suite with project id `demo-solid-drive` (the `demo-` prefix means no real Firebase project is needed). Real Stripe/Resend/Cloudflare/Turnstile keys are not available yet: code against env vars from `.env.example`, use Turnstile's always-pass test keys, and make functions degrade gracefully (log the email instead of sending) when a key is missing.

## Ownership (to avoid agents overwriting each other)

| Area | Owner |
| --- | --- |
| Root config, `packages/shared/**`, `firestore.rules`, `storage.rules`, `firebase.json`, seed script, `apps/web/components/ui/**` (shadcn), `apps/web/app/globals.css` tokens, `apps/web/lib/firebase*` | Foundation agent |
| `apps/web/app/(site)/**`, `apps/web/components/site/**`, `apps/web/public/images/**` usage | Public site agent |
| `apps/web/app/admin/**`, `apps/web/components/admin/**` | Admin agent |
| `functions/src/**` (beyond the skeleton) | Functions agent |
| `assets/generated/**`, `apps/web/public/images/**` files | Assets agent |

If you need something in an area you don't own: add a NEW file next to it rather than editing an existing one, and note it in `docs/DECISIONS.md`. Never delete or rewrite another owner's files. Do not run `git commit`; the orchestrator commits.

## Client preview deploy (demo mode) – required

The owner deploys to Cloudflare Pages (`pnpm --filter web deploy:preview`, https://solid-drive-preview.pages.dev) to show the client a preview before Cloud Functions, Auth, Stripe, Resend or Cloudflare Images are live.

- **Cars live in Firestore, never in the app bundle.** The dealer's stock is seed data in `scripts/data/stock.ts` (imported ONLY by scripts), written by `pnpm seed:stock` (real project, dry run by default) and by `pnpm seed` (emulators). Do not add car data to `@sda/shared` or `apps/web`.
- `VITE_DEMO_MODE=true` switches the web app to a bundled demo data source for everything except cars: demo users and settings from ONE shared fixture module (`packages/shared/src/demo/`, also used by `scripts/seed.ts`); bookings, enquiries, expenses, vendors, sales, deposits and car financials start empty.
- Demo-mode cars: when a real Firebase config is given (`VITE_FIREBASE_PROJECT_ID` not `demo-*`, emulators off; `DEMO_LIVE_CARS` in `apps/web/lib/data/mode.ts`), the public site reads published cars from the live Firestore with the same queries as Firebase mode (`lib/data/public.ts`), and the demo admin/actions load the same cars read-only into the demo store (`lib/data/demo/live-cars.ts`). Demo mode never writes to Firestore. Without a real config demo mode has no cars and the empty states must render. The preview build uses Vite mode `preview` (`apps/web/.env.preview`).
- All data access goes through one repository layer in `apps/web/lib/data/` with two adapters (Firebase, demo). Pages and components never import Firestore directly. The `local:` image IDs already resolve to `/images/...`, which works on the preview.
- Public site in demo mode: every page renders from the fixtures plus the live cars. Forms (enquiry, trade-in, booking, reserve) validate with the zod schema and show the real success state, but don't send anything; availability slots are computed in-browser from `settings/booking` with the shared helpers. Reserve shows a "Demo – no payment taken" step instead of redirecting to Stripe.
- Admin in demo mode: login accepts the demo admin and staff accounts (shown on the login screen), the role switch works, and edits persist only in the viewer's browser (localStorage overlay on the fixtures and live cars) with a visible "Demo mode – changes are only saved in this browser" banner and a reset button. Excel exports may be generated client-side with exceljs in demo mode.
- A small "Preview" badge is visible on both sites in demo mode. Demo mode must never be on in production.

## Conventions

Money in integer cents (AUD), GST separate. Every write records createdAt/By, updatedAt/By. Soft delete. Log any choice not covered by the plan in `docs/DECISIONS.md` (append; one bullet per decision with your agent name).
