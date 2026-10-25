# Dealership Platform – Build Plan

Oct 25, 2026 · @Pulindu

## Brief

Build a car dealership platform for a single client. It has two parts: a public website where customers browse stock, book test drives or inspections in real-time slots, and pay a fixed non-refundable deposit; and a private admin dashboard where the dealership manages inventory, per-car expenses, sales records and enquiries, and exports reports to Excel.

**How to use this plan**

- Build in the milestone order in the Build milestones section. Each milestone must meet its acceptance criteria before the next starts.
- Treat the Data model and Security rules sections as the source of truth. If a feature needs a new field, add it to the model and the rules together.
- Where this plan says **PLACEHOLDER**, use the default given and make it editable in admin settings. Don't block on it.
- Ask before changing the tech stack, adding paid services, or changing the deposit or role rules.
- Keep a `docs/DECISIONS.md` log of any choice not covered here.

## Tech stack and conventions

| Concern | Choice | Notes |
| --- | --- | --- |
| Hosting | Cloudflare | Public site and admin deployed to Cloudflare (Workers/Pages) |
| Frontend framework | Next.js (App Router, TypeScript) on Cloudflare via OpenNext | Assumed; SSR needed for SEO on car pages. Confirm before starting |
| Database | Cloud Firestore | Assumed as part of Firebase |
| Auth | Firebase Authentication | Email/password for admin and staff only; customers don't log in |
| Server logic | Firebase Cloud Functions (2nd gen, Node 20, TypeScript) | All privileged writes, Stripe, email, exports |
| Car photos | Cloudflare Images | Direct creator uploads; variants for thumb, card, full |
| Private files | Firebase Storage | Receipts, sale documents, generated exports |
| Payments | Stripe Checkout | Fixed deposit; card, Apple Pay, Google Pay |
| Email | Resend | Transactional emails with React Email templates |
| Bot protection | Cloudflare Turnstile | On every public form; token verified in the function |
| Styling | Tailwind CSS + a component library (e.g. shadcn/ui) | Mobile-first |
| Excel | exceljs (in Cloud Functions) | Real .xlsx with formulas |

**Conventions**

- Monorepo: `apps/web` (Next.js public site + `/admin`), `functions/` (Cloud Functions), `packages/shared` (types, zod schemas, constants)
- One zod schema per entity in `packages/shared`, used by both the frontend forms and the functions
- Money stored as integer cents (AUD); GST stored separately. GST rate is a setting, default 10%
- Dates stored as Firestore Timestamps; displayed in the dealership time zone (setting, default `Australia/Perth`)
- Every write records `createdAt`, `createdBy`, `updatedAt`, `updatedBy`
- Soft delete only (`deletedAt`); admin can restore
- Firebase Emulator Suite for local development, with seed data (20 cars, expenses, bookings, a sale)
- Lint, typecheck and unit tests run in CI on every push

## Architecture

&#91;embedded content: system architecture · Cloudflare, Firebase, Stripe, Resend\]

The web app reads public data and calls Cloud Functions for every write that matters. Functions talk to Stripe (Checkout and webhook), Resend (emails) and the Cloudflare APIs (image upload URLs, cache purge). Customers pay on Stripe's hosted Checkout page.

## Data model (Firestore)

Public-safe car data and cost data live in separate documents. Firestore rules work per document, so this is how staff and the public are kept away from purchase prices and profit.

| Collection | Key fields | Who can read / write |
| --- | --- | --- |
| `cars/{carId}` | stockNo, slug, vin, rego, regoExpiry, make, model, variant, year, bodyType, transmission, fuel, engine, colour, km, features\[\], description, priceCents, status (draft / available / reserved / sold / withdrawn), published (bool), images\[\] (Cloudflare image IDs, order, isCover), syndication {carsales, gumtree, facebook: bool}, soldAt, reservedAt | Public reads where published = true; admin and staff write |
| `carFinancials/{carId}` | purchaseDate, purchasePriceCents, purchaseGstCents, source (auction / trade-in / private / wholesale), sellerName, notes | Admin only |
| `cars/{carId}/expenses/{expenseId}` | date, category, description, vendorId, vendorName, invoiceNo, amountExGstCents, gstCents, totalCents, receiptPath (Storage), loggedBy | Admin and staff read and create; admin edits and deletes |
| `sales/{saleId}` | carId, stockNo, saleDate, salePriceCents, saleGstCents, buyer {name, address, phone, email, licenceNo}, depositId, tradeIn {carId, valueCents}, paymentMethod, financeCompany, warranty, deliveryDate, salespersonUid, documents\[\] (Storage paths), notes | Admin full; staff read and create |
| `bookings/{bookingId}` | carId, type (test-drive / inspection), startAt, endAt, customer {name, phone, email}, licenceConfirmed, status (confirmed / cancelled / attended / no-show), manageToken (hashed), notes, source (web / staff) | Admin and staff; customers only through functions |
| `slotLocks/{carId_YYYYMMDD_HHmm}` | bookingId | Functions only (prevents double booking) |
| `slotCounts/{YYYYMMDD_HHmm}` | count | Functions only (capacity per slot) |
| `deposits/{depositId}` | carId, amountCents, customer {name, email, phone}, stripeSessionId, stripePaymentIntentId, status (pending / paid / expired / conflict), termsAcceptedAt, paidAt | Admin read; functions write |
| `enquiries/{enquiryId}` | type (general / trade-in), carId?, customer {name, phone, email}, message, tradeInVehicle {rego, make, model, year, km, condition, images\[\]}, status (new / contacted / booked / won / lost), assignedTo, notes\[\] | Admin and staff; created only through a function |
| `vendors/{vendorId}` | name, phone, email, abn | Admin and staff |
| `users/{uid}` | name, email, role (admin / staff), active | Admin write; user reads self |
| `settings/business` | name, abn, dealerLicenceNo, address, phone, email, hours, timezone, gstRate, logo | Public read (non-sensitive); admin write |
| `settings/booking` | slotMinutes, bufferMinutes, weeklyHours, blackoutDates\[\], maxPerSlot, minNoticeHours, maxDaysAhead | Public read; admin write |
| `settings/deposit` | amountCents, termsText, enabled | Public read; admin write |
| `settings/finance` | indicativeRatePct, disclaimer | Public read; admin write |
| `auditLog/{id}` | actorUid, action, entity, entityId, before, after, at | Admin read; functions write |

**Indexes**: cars (published, status, createdAt); cars (published, make, priceCents); bookings (startAt); bookings (carId, startAt); enquiries (status, createdAt); sales (saleDate); collection-group expenses (date).

## Auth, roles and security rules

Only dealership users log in. Roles are Firebase custom claims (`role: 'admin' | 'staff'`), and every privileged rule and function checks them.

- Login: email/password, password reset by email, 2FA (TOTP via Firebase multi-factor) required for admin and optional for staff
- No public sign-up. Admin invites users from the Users page, and a callable `setUserRole` sets the claim and the `users` doc
- The first admin is created with a one-off script `functions/scripts/createAdmin.ts`
- Deactivated users get their claims removed and their refresh tokens revoked

**Permission matrix**

| Area | Admin | Staff |
| --- | --- | --- |
| Cars: create, edit, photos, publish | Yes | Yes |
| carFinancials, profit, margins | Yes | No |
| Expenses: view, add with receipt | Yes | Yes |
| Expenses: edit, delete | Yes | No |
| Sales: view, create | Yes | Yes |
| Sales: edit, delete | Yes | No |
| Bookings and enquiries | Yes | Yes |
| Deposits view | Yes | No |
| Exports | Yes | No |
| Users and settings | Yes | No |

**Rules requirements**

- Firestore rules mirror the matrix exactly. Write rules unit tests with `@firebase/rules-unit-testing` covering an anonymous user, staff and admin for every collection
- Public writes are denied everywhere. Bookings, enquiries and deposits are created only by Cloud Functions using the Admin SDK
- Storage rules: `receipts/**` and `sales/**` need admin or staff, with deletes for admin only; `exports/**` is admin only and written by functions only
- Firebase App Check is on for Firestore, Storage and callable functions
- Staff UI must never request `carFinancials`; profit fields are hidden on the client and denied by the rules

## Public site

Car pages are server-rendered for SEO and cached at the edge. The cache is revalidated whenever a car is updated.

| Route | Purpose |
| --- | --- |
| `/` | Hero, featured cars (latest 6 available), search bar, trust strip (licence no, address, hours), calls to action |
| `/cars` | Inventory grid with filters (make, model, year range, price range, km max, body, transmission, fuel) and sort (newest, price, year, km). Filters live in the URL query string |
| `/cars/[slug]` | Gallery (swipe, zoom), specs table, features, description, price, status badge, stock no, similar cars, and buttons for Book, Enquire and Reserve with deposit |
| `/cars/[slug]/book` | Booking flow (see Bookings and deposits) |
| `/cars/[slug]/reserve` | Deposit flow: customer details, non-refundable terms checkbox, redirect to Stripe Checkout |
| `/reserve/success`, `/reserve/cancelled` | Stripe return pages |
| `/booking/[id]?t=token` | Customer view of a booking with cancel/reschedule |
| `/trade-in` | Trade-in valuation form with up to 6 photos |
| `/finance` | Finance calculator and info |
| `/about`, `/contact`, `/warranty`, `/faq` | Content pages (contact includes map, hours, enquiry form) |
| `/privacy`, `/terms`, `/deposit-terms` | Legal pages; text editable in admin settings |

**Behaviour**

- Only `published = true` cars appear. Sold cars drop out of `/cars` but their page still loads with a Sold badge and similar cars
- Reserved cars show a Reserved badge and hide the Reserve and Book buttons (Enquire stays)
- Slug format: `{year}-{make}-{model}-{variant}-{stockNo}`, lowercased and hyphenated
- SEO: page title and description per car, Open Graph image (cover photo), schema.org `Car` structured data, `sitemap.xml`, `robots.txt`
- Finance calculator: inputs are price (prefilled from the car), deposit, term (12 to 84 months) and rate (default from settings). Outputs are weekly and monthly repayments, with the disclaimer always visible
- All forms use Turnstile, validate with the shared zod schema, and call a function. They show success and error states and never write to Firestore directly
- Performance target: Lighthouse mobile score of 90 or more on `/` and `/cars/[slug]`

## Admin dashboard

The admin lives under `/admin`, is client-rendered behind auth, is never indexed, and must work fully on a phone.

| Route | Purpose |
| --- | --- |
| `/admin/login` | Login, password reset, 2FA |
| `/admin` | Overview: in stock, reserved, sold this month, today's bookings, new enquiries, aged stock (over 60 days, PLACEHOLDER). Admin also sees stock value at cost, expenses this month and gross profit this month |
| `/admin/cars` | Table with search, status filter, and quick actions (publish, mark reserved/sold, withdraw) |
| `/admin/cars/new`, `/admin/cars/[id]` | Car form with tabs: Details, Photos, Expenses, Financials (admin only), Sale, Activity |
| `/admin/bookings` | Day/week calendar and list, plus Create booking (staff, for phone customers). Mark attended / no-show / cancel |
| `/admin/enquiries` | Inbox with type and status filters, assign, notes, convert to booking |
| `/admin/sales` | All sales, filter by date range, open a sale |
| `/admin/deposits` | Deposits with status; conflicts highlighted (admin) |
| `/admin/reports` | Export screen (admin) |
| `/admin/vendors` | Vendor list |
| `/admin/users` | Invite, set role, deactivate (admin) |
| `/admin/settings` | Business, booking rules, deposit, finance, legal text (admin) |

**Car form details**

- Photos: multi-select from phone camera or gallery, upload directly to Cloudflare Images with a progress bar, drag to reorder, set cover, delete. Max 30 photos per car
- Status change rules: Draft → Available (needs at least 1 photo, a price, and make/model/year) → Reserved → Sold; Withdrawn can be set from any state. Marking Sold opens the Sale form
- Expenses tab: list with running total; Add expense opens a sheet with fields from the data model, a vendor picker (create inline) and a receipt from camera or file (image or PDF, 10 MB max). GST auto-calculates from the total at the GST rate and can be overridden
- Financials tab (admin): purchase details, plus a live summary of purchase + expenses = total cost, and sale price − total cost = gross profit and margin %, all ex GST
- Sale tab: buyer, sale price, GST, linked deposit (auto-filled if one exists), trade-in (optionally creates a new Draft car linked back), payment method, finance company, warranty, delivery date, salesperson, document uploads
- Activity tab: audit log entries for this car

## Bookings and deposits logic

Both flows run entirely in Cloud Functions inside Firestore transactions, so two customers can never book the same car slot or reserve the same car.

**Availability (`getAvailability(carId, date)`)**

1. Load `settings/booking` and the car. Return no slots if the car isn't available or isn't published
2. Build slots from `weeklyHours` for that weekday in the dealership time zone, using `slotMinutes` plus `bufferMinutes`
3. Remove slots that are in the past, inside `minNoticeHours`, beyond `maxDaysAhead`, on a blackout date, already locked for this car, or at `maxPerSlot` capacity
4. Return slots as ISO strings with the time zone offset

Defaults (PLACEHOLDER): 45-min slots, 15-min buffer, Mon–Fri 9:00–17:00, Sat 9:00–13:00, max 2 per slot, 2 h notice, 30 days ahead.

**Create booking (`createBooking`)**

- Input: carId, type, startAt, customer, licenceConfirmed (required for test drives), turnstileToken
- Verify Turnstile, validate with zod, then in one transaction re-check availability, create `slotLocks/{carId_date_time}` (fails if it exists), increment `slotCounts`, and write the booking with a random manage token (store only its hash)
- After commit, send Resend emails: a customer confirmation with an .ics attachment and a manage link, and a dealership notification
- `cancelBooking` / `rescheduleBooking` need the token, release the lock, decrement the count, and send emails
- Scheduled function hourly: send a reminder 24 h before each confirmed booking

**Deposits (fixed, non-refundable)**

- Amount comes from `settings/deposit.amountCents` (PLACEHOLDER default $500). Charge exactly that amount. Stripe fees are absorbed by the business; never add a surcharge
- `createDepositCheckout(carId, customer, termsAccepted, turnstileToken)`: verify the car is available, require termsAccepted, create a `deposits` doc (pending), and create a Stripe Checkout Session (mode payment, AUD, line item "Deposit – {year make model} ({stockNo})", customer email, metadata depositId and carId, expires in 30 min). Return the session URL
- Show the non-refundable terms on the reserve page and again in the Checkout custom text. Store `termsAcceptedAt` and the terms version
- `stripeWebhook` (HTTPS, verify signature, idempotent on event ID):
  - `checkout.session.completed`: in a transaction, if the car is still available set it to reserved and the deposit to paid; otherwise set the deposit to **conflict** and email the admin to resolve it manually
  - `checkout.session.expired`: set the deposit to expired
- After payment, email the customer a receipt-style confirmation stating the deposit is non-refundable, and notify the dealership
- No refund button in the app. A conflict is handled by the admin in the Stripe dashboard and marked resolved in admin
- A reserved car stays reserved until staff mark it sold or admin releases it. Releasing it doesn't refund the deposit
- The success page reads deposit status via a callable; never trust the redirect alone

## Cloud Functions and integrations

Every function validates input with the shared zod schema, checks the role where needed, and writes an audit log entry for privileged actions.

| Function | Type | Access | Does |
| --- | --- | --- | --- |
| `getAvailability` | callable | public | Open slots for a car and date |
| `createBooking`, `cancelBooking`, `rescheduleBooking` | callable | public (Turnstile / token) | Booking flow |
| `staffCreateBooking` | callable | staff, admin | Booking on behalf of a caller, without Turnstile |
| `createEnquiry` | callable | public (Turnstile) | General and trade-in enquiries; emails dealership and customer |
| `getTradeInUploadUrls` | callable | public (Turnstile) | Signed upload URLs for trade-in photos |
| `createDepositCheckout` | callable | public (Turnstile) | Stripe Checkout session |
| `getDepositStatus` | callable | public | Status for the success page by session ID |
| `stripeWebhook` | HTTPS | Stripe signature | Payment completion and expiry |
| `getImageUploadUrl` | callable | staff, admin | Cloudflare Images direct creator upload URL |
| `deleteCarImage` | callable | staff, admin | Removes an image from Cloudflare Images and the car |
| `onCarWrite` | Firestore trigger | system | Generates slug, purges the edge cache for the car page and `/cars`, writes the audit log |
| `exportCarReport`, `exportStockReport` | callable | admin | Builds .xlsx and returns a signed URL (15 min) |
| `setUserRole`, `inviteUser`, `deactivateUser` | callable | admin | User management |
| `sendBookingReminders` | scheduled (hourly) | system | 24 h reminders |
| `stockFeed` | HTTPS | secret key | Phase 3: listing feed for marketplaces |

**Cloudflare Images**: store image IDs on the car. Use variants `thumb` (400w), `card` (800w) and `full` (1600w). Serve through the delivery URL with format auto. Trade-in photos are uploaded through the same path, under a separate prefix.

**Resend emails** (React Email templates in `functions/emails`, sender on the client's domain once bought, PLACEHOLDER):

- Booking confirmed (customer, with .ics), booking notification (dealership), reminder, cancelled, rescheduled
- Enquiry received (customer), new enquiry (dealership)
- Deposit paid (customer, states non-refundable), deposit received (dealership), deposit conflict (admin)
- User invite and password reset (Firebase default or custom)

**Stripe**: Checkout only, with automatic payment methods. Use test mode keys until launch. The webhook endpoint listens for `checkout.session.completed` and `checkout.session.expired`.

## Excel exports

There are two admin-only exports, built with exceljs in a function, saved to `exports/{uid}/` in Storage (auto-deleted after 24 h), and downloaded through a signed URL.

**Formatting for every sheet**: bold header row with a fill colour, frozen header, autofilter on, column widths fitted, AUD currency format `$#,##0.00`, dates `dd/mm/yyyy`, a totals row using `SUM` formulas (not hard-coded values), and the business name plus the report period in the sheet header/footer.

**Car Report** (`exportCarReport(carId)`), file name `CarReport_{stockNo}_{year}-{make}-{model}.xlsx`

| Sheet | Columns / content |
| --- | --- |
| Summary | Label/value pairs: Stock no, VIN, Rego, Car, Km, Status, Purchase date, Purchase price ex GST, Total expenses ex GST, GST on expenses, Total cost, Sale date, Sale price ex GST, Gross profit (formula), Margin % (formula), Days in stock |
| Expenses | Date, Category, Description, Vendor, Invoice no, Amount ex GST, GST, Total inc GST, Receipt (hyperlink to admin receipt viewer), Logged by |
| By Category | Category, Amount ex GST, GST, Total inc GST (SUMIF formulas against Expenses) |

**Stock & Sales Report** (`exportStockReport({from, to, status?, category?})`), file name `StockReport_{from}_to_{to}.xlsx`

| Sheet | Columns / content |
| --- | --- |
| Overview | Period, Cars purchased, Cars sold, Revenue ex GST, Expenses ex GST, Gross profit, Average margin %, Average days to sell |
| Stock Summary | Stock no, Car, VIN, Rego, Status, Purchase date, Purchase price, Expenses total, List price, Sale price, Sale date, Gross profit, Margin %, Days in stock |
| Expenses | Stock no, Car, Date, Category, Description, Vendor, Invoice no, Amount ex GST, GST, Total inc GST, Logged by |
| Sales | Stock no, Car, Sale date, Buyer, Sale price ex GST, GST, Deposit, Trade-in value, Payment method, Finance company, Salesperson |
| By Category | Category, Amount ex GST, GST, Total inc GST |

- Gross profit = sale price ex GST − purchase price ex GST − expenses ex GST, written as a cell formula
- Each export can also be downloaded as CSV (Stock Summary / Expenses only) for future accounting imports
- Receipt hyperlinks point to `/admin/receipts/{path}`, which checks auth before redirecting to a short-lived Storage URL; never embed raw signed URLs in the file
- Write a unit test that generates both files from seed data and checks the sheet names, headers and totals

## Build milestones

Build in this order. M1–M6 make up the launch, M7 adds deposits and the extras, and M8 adds syndication. Tick each box only when its acceptance criteria pass on staging.

**M1 – Foundation**

- [ ] Monorepo, TypeScript, lint, CI, Firebase project (staging + production), Emulator Suite, seed script
- [ ] Next.js deployed to Cloudflare staging; Functions deployed to staging
- [ ] Shared zod schemas and types for every collection
- [ ] Firestore and Storage rules plus rules unit tests

* Acceptance: CI is green; rules tests prove an anonymous user can only read published cars and settings, staff can't read `carFinancials`, and only functions can create bookings, enquiries and deposits

**M2 – Auth and admin shell**

- [ ] Login, reset, 2FA for admin, role claims, `createAdmin` script, Users page (invite, role, deactivate)
- [ ] Admin layout with mobile nav and role-based menu

* Acceptance: staff never see Financials, Exports, Deposits, Users or Settings; a deactivated user is logged out within one token refresh

**M3 – Inventory and photos**

- [ ] Car list and form (all tabs except Sale), status rules, slug generation
- [ ] Cloudflare Images upload from a phone, reorder, cover, delete
- [ ] Expenses with vendors and receipts; Financials tab with live profit

* Acceptance: a car with 20 photos can be created on a phone in under 5 minutes; profit maths matches a hand calculation for the seed data

**M4 – Public site**

- [ ] Home, inventory with filters, car page, content and legal pages, SEO, sitemap, edge cache revalidation
- [ ] Enquiry and trade-in forms with Turnstile and Resend emails

* Acceptance: editing a car's price in admin shows on the public page within 60 seconds; Lighthouse mobile score of 90 or more; enquiries land in the admin inbox and both emails arrive

**M5 – Bookings**

- [ ] Booking settings, availability, booking flow, manage link, staff bookings, calendar, reminders

* Acceptance: a concurrency test firing 10 simultaneous bookings at the same car and slot creates exactly 1; capacity and blackout rules are respected; the .ics file opens in Google and Apple calendars

**M6 – Sales and exports**

- [ ] Sale form, trade-in creates a linked draft car, sale documents, sales list
- [ ] Both Excel exports plus CSV, and the Reports page

* Acceptance: the exports open cleanly in Excel and Google Sheets; totals are formulas; staff calling an export function get permission-denied

**M7 – Deposits and extras**

- [ ] Deposit settings, reserve page, Stripe Checkout, webhook, success/cancel pages, deposit emails, Deposits page with conflicts
- [ ] Finance calculator page and car-page widget

* Acceptance: in Stripe test mode a paid deposit sets the car to Reserved and hides Book/Reserve; two near-simultaneous payments produce one Reserved car and one conflict that is emailed to admin; replaying a webhook event changes nothing

**M8 – Listing syndication**

- [ ] `stockFeed` endpoint and per-car toggles, a sync log, and a "copy listing" export fallback

* Acceptance: the feed only includes published, available, toggled cars, and a sold car disappears from the feed on the next request

**Launch checklist**: production Firebase and Stripe live keys, domain and DNS on Cloudflare, Resend domain verified, App Check enforced, backups (scheduled Firestore export), uptime and error monitoring, admin accounts created, seed data removed.

## Environment and setup

Secrets live in Firebase Secret Manager (functions) and Cloudflare environment variables (web). Never commit them; ship a `.env.example` listing every key.

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, appId) | web | Firebase client config |
| `NEXT_PUBLIC_APPCHECK_SITE_KEY` | web | App Check |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | web | Turnstile widget |
| `NEXT_PUBLIC_CF_IMAGES_DELIVERY_URL` | web | Image delivery base URL |
| `NEXT_PUBLIC_SITE_URL` | web | Canonical URL, sitemap, emails |
| `TURNSTILE_SECRET_KEY` | functions | Verify Turnstile tokens |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | functions | Checkout and webhook |
| `RESEND_API_KEY`, `EMAIL_FROM`, `DEALERSHIP_NOTIFY_EMAIL` | functions | Emails |
| `CF_ACCOUNT_ID`, `CF_IMAGES_API_TOKEN` | functions | Image upload URLs and deletes |
| `CF_ZONE_ID`, `CF_CACHE_PURGE_TOKEN` | functions | Purge car page cache |
| `STOCK_FEED_KEY` | functions | Protect the syndication feed (M8) |

**Setup steps**

1. Create Firebase projects `dealership-staging` and `dealership-prod` (Australian region, `australia-southeast1`) with Firestore, Auth, Storage and Functions
2. Create the Cloudflare account resources: Workers/Pages project, Images, Turnstile widget, and API tokens scoped to the minimum permissions
3. Create a Stripe account in test mode and add the webhook endpoint for staging
4. Create a Resend account; use a test sender until the domain is bought and verified
5. Run `pnpm install`, `pnpm emulators`, then `pnpm seed`, then `pnpm dev`
6. Write the README covering local dev, deploy commands per environment, and how to create the first admin

## Placeholders and out of scope

**Placeholders** (use the default shown; keep each editable in admin settings or as content):

| Item | Default until confirmed |
| --- | --- |
| Deposit amount | $500, non-refundable |
| Deposit terms text | Generic non-refundable wording, flagged for the client to review |
| Booking hours and slots | See Bookings and deposits defaults |
| Aged stock threshold | 60 days |
| Finance indicative rate | 9.99% p.a. with an "estimate only" disclaimer |
| Business details (name, ABN, dealer licence no, address, phone) | Lorem placeholders in `settings/business` |
| Logo, colours, fonts | Neutral theme with CSS variables, swapped when brand assets arrive |
| Domain and email sender | Staging URLs and a Resend test sender |
| Marketplace feed formats | Generic JSON/XML feed until each site's spec is supplied |

**Out of scope for now**

- Customer accounts or logins
- Deposit refunds in the app
- SMS notifications
- Accounting integration (Xero/MYOB); the CSV exports cover this for now
- Tax invoice PDF generation
- Live finance applications or credit checks
- Multi-location or multi-dealer support
