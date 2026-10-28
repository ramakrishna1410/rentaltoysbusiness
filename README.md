# RentalToys — toy rental subscriptions for Chennai

App-first MVP for a toy-rental subscription business:

| Package | What it is |
|---|---|
| `apps/customer` | Expo (React Native) customer app: signup with kid profile and interests, personalised catalog, plans, swaps |
| `apps/admin` | Expo admin/warehouse app: toy micro-details, QR labels, scan-driven stage moves, storage slotting, payments |
| `apps/api` | Node + Express + Prisma/PostgreSQL API used by both apps (and the future website) |
| `packages/shared` | Plans and pricing, toy lifecycle rules, QR payloads, slotting and recommendation algorithms, API client |

## Quick start

Requirements: Node 20+, PostgreSQL 16 (or Docker).

```bash
npm install
```

```bash
docker compose up -d
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
npm run db:setup
```

(`db:setup` pushes the schema and loads the **demo** data; see "Backend and data" below.)

```bash
npm run dev:api
```

```bash
npm run dev:customer
```

```bash
npm run dev:admin
```

Open the apps in Expo Go on a phone (set `EXPO_PUBLIC_API_URL` in `apps/<app>/.env` to your computer's LAN IP, e.g. `http://192.168.1.20:4000`) or press `w` for the browser.

Demo logins (from the seed):

| Who | Login | Password |
|---|---|---|
| Admin | `admin@rentaltoys.in` | `Admin@1234` |
| Warehouse staff | `staff@rentaltoys.in` | `Staff@1234` |
| Parent (kid Aadhya, 4 yrs, likes wooden/STEM/puzzles) | `parent@example.com` | `Parent@1234` |

Tests (the API tests need a database whose name ends in `_test`, e.g. `createdb rentaltoys_test`; override with `TEST_DATABASE_URL`):

```bash
npm test
```

```bash
npm run typecheck
```

## Backend and data

The apps have **no hardcoded data**: every screen reads and writes through the API (`apps/api`), which stores everything in
PostgreSQL through Prisma (`apps/api/prisma/schema.prisma`). There are two seeds:

| Command | Use | What it does |
|---|---|---|
| `db:seed:demo` (also `db:seed`) | local dev only | **Wipes all tables**, then loads 28 demo toys, 61 units, demo logins. Refuses to run with `NODE_ENV=production`. |
| `db:seed:base` | production | Creates the 9 plans, the warehouse layout and the first admin (from `ADMIN_*` env vars) if missing. Safe to re-run; never overwrites edited prices or passwords. |

Schema changes ship as Prisma migrations in `apps/api/prisma/migrations`. Production applies them on every start (`prisma migrate deploy`).

## Deploying (Render + managed PostgreSQL)

`render.yaml` defines everything:

- **API web service** (`rentaltoys-api`, Starter plan): installs only the API workspace, runs migrations on start, and is
  health-checked on `/health`.
- **PostgreSQL 16 database** (`rentaltoys-db`, Basic 256 MB): no public access; only Render services can connect to it.
- **Region:** both are in Singapore, the closest Render region to Chennai.
- **Cost:** about US$7 + US$6 a month to start. The free tier sleeps and its database expires, so don't use it for real customers.

1. Push this branch to GitHub and merge it into your default branch. Render deploys the default branch.
2. In Render: **New → Blueprint**, pick this repo, and approve the service and database it shows.
3. Fill in the prompted variables:
   - `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD`: your first admin. The password needs 10+ characters.
   - `CORS_ORIGINS`: leave empty until the website exists, then set e.g. `https://rentaltoys.in`.
   - `JWT_SECRET` and `DATABASE_URL` are filled in automatically.
4. When the first deploy is live, open the service's **Shell** tab and run this once:
   ```bash
   npm run -w @rentaltoys/api db:seed:base
   ```
5. Check `https://rentaltoys-api.onrender.com/health` (your URL may differ). It should return `{"ok":true}`.
6. Put that URL in `apps/customer/eas.json` and `apps/admin/eas.json`. Then build the apps with EAS:
   ```bash
   npx eas-cli build --profile preview --platform android
   ```
   Run it inside each app folder. For local testing, set `EXPO_PUBLIC_API_URL` in `apps/<app>/.env` instead.
7. Log in to the admin app with the admin from step 3. From there:
   - add staff (`POST /admin/staff`);
   - add toys and procure units (QR labels are created automatically);
   - scan the units into storage, which makes them show up in the customer catalog.

**Running it in production:**
- **Backups:** paid Render Postgres plans include daily backups. Do a test restore once before launch.
- **Secrets:** rotating `JWT_SECRET` logs everyone out; that is the intended way to revoke sessions.
- **QR images** are stored in Postgres (`QrImage`), which is fine for thousands of toys. Move them to S3 or Cloudflare R2
  when photo upload is added.
- **Custom domain:** add `api.rentaltoys.in` under the service's Settings → Custom Domains. Render issues the TLS certificate.
- **Security:** the API sends security headers (helmet), rate-limits login and signup (20 per 15 minutes per IP), and won't
  start in production with a weak `JWT_SECRET`.

## Landing page and "Get started"

Logged-out visitors (app and website) land on `/`. It has:
- the brand at top left, with Home, About us, Plans (wide screens) and Login at top right;
- a muted, auto-advancing carousel of 5 videos with arrows and dots;
- the intro and a **Get started** button;
- the 9 plans.

**Get started** asks 4 quick questions:
1. the kid's name, date of birth and (optionally) gender;
2. favourite colours;
3. toy types they love;
4. where they play, what matters most, and a pincode check.

It then shows a catalog ranked for those answers **without signing up**. Tapping + on a toy asks the parent
to sign up, with the kid's answers already filled in, and the picked toy waits in their box. The answers
(favourite colours, play place, goals) are saved on the kid profile and boost matching toys in "For you".

**Videos:** put the 5 clips in `apps/api/media/landing/`, using the names and suggested free stock clips
listed in that folder's README. A missing clip shows a coloured panel with its caption.

## Toy photos

Staff add up to 6 photos per toy in the admin app: **Toys → open a toy → Photos**. They can take a photo with the
camera on a phone, or choose from the gallery (or upload files in the browser). Photos are resized on the device to
about 1200 px JPEG before upload and stored in Postgres (`ToyImage`). They're served from `GET /images/:id`, and the
first photo is the cover shown in the catalog. Toys without photos show a "photo coming soon" tile.

## Testing on a phone

The QR code Expo shows must contain your PC's **Wi-Fi IP**, not `127.0.0.1`. Use the phone scripts:

- `npm run phone:customer` / `npm run phone:admin`: LAN mode. If the QR code still shows the wrong IP,
  set `REACT_NATIVE_PACKAGER_HOSTNAME` to your Wi-Fi IP first.
- `npm run tunnel:customer` / `npm run tunnel:admin`: works on any network, but is slower.

Also set `EXPO_PUBLIC_API_URL=http://<Wi-Fi IP>:4000` in `apps\customer\.env` and `apps\admin\.env`, and allow TCP
ports 4000, 8081 and 8082 through Windows Firewall on private networks.

## Subscription plans

There are 3 durations × 3 tiers, which makes 9 plans. All numbers are placeholders seeded into the DB, and admins can change prices
(`PATCH /admin/plan-prices/:id`). Source: `packages/shared/src/plans.ts`.

**Toy credits:** a standard toy costs 1 credit and a large toy costs 2. So "2 credits" means 2 toys or 1 large toy.

| Per month | Basic | Pro | Ultra |
|---|---|---|---|
| Toy credits at home | 2 | 3 | 5 |
| Swaps | 1 | 2 | 4 |
| Free doorstep deliveries | 1 | 2 | 4 + express |
| Base price | ₹799 | ₹1,199 | ₹1,699 |

| | Monthly | Quarterly | Yearly |
|---|---|---|---|
| Price vs base | 100% | 90% | 80% |
| How you can pay | monthly | monthly, or quarterly (−5%) | monthly, quarterly (−3%), or yearly (−8%) |
| Unused swaps roll over | – | ✓ | ✓ |
| Pause | – | 7 days | 28 days |
| "Keep it" buy-out discount | – | 10% | 20% |
| Extras | – | – | birthday surprise toy, early access |

Compared with theelefant.ai (quarterly and yearly only), this adds a monthly option, three tiers, monthly instalments on long plans,
the credit system for large toys, swap rollover, pause and buy-out.

Payments are manual for now. A subscription starts as `PENDING_PAYMENT` with one invoice per instalment. An admin marks an
instalment paid with its UPI or bank reference, and the first payment activates the plan. Razorpay can replace this step later.

## Toy lifecycle, scanned with QR codes

When a toy is procured, the API creates a QR code for the unit and one for **every piece**. The PNG/SVG images are stored in
Postgres (`QrImage`) and served from `GET /qr/:id.png`, so labels can be reprinted at any time. A label holds only an ID
(`RT:U:<unit>`, `RT:P:<unit>:<n>/<total>`, `RT:B:<bin>`), so it never goes out of date.

Every stage change is a scan. The app shows the **current stage (before)**, staff choose the **next stage (after)**, and the
API checks the move against one transition table (`packages/shared/src/lifecycle.ts`):

```
PROCUREMENT   → SANITATION | STORAGE | DAMAGE
SANITATION    → STORAGE | DAMAGE
STORAGE       → IN_TRANSIT (must be reserved for the order) | SANITATION | DAMAGE
IN_TRANSIT    → WITH_CUSTOMER | SANITATION (back at warehouse) | DAMAGE
WITH_CUSTOMER → IN_TRANSIT (pickup)
DAMAGE        → SANITATION (repaired) | SCRAP
```

- `WITH_CUSTOMER` was added to your six stages. Without it, a toy at a customer's home would show as "in transit" for weeks.
- When a toy leaves the warehouse or comes back, **every piece must be scanned**. A return with missing pieces can only go to
  DAMAGE; the pieces are marked missing and the customer's subscription is flagged.
- Each scan writes a `StageMovement` row with: before, after, who scanned, when, the bins involved, the order, and the
  piece-scan result.
- A stale screen or a double scan is rejected (409), because the API checks that the stage hasn't changed since the scan.
- **Only units in STORAGE that are not reserved appear in the customer catalog**, and dispatch can only pick those units.

## Algorithm 1: where to store a toy (`packages/shared/src/algorithms/slotting.ts`)

This follows the approach quick-commerce dark stores and fulfilment centres use:

1. **ABC velocity.** Toys are ranked by rentals (Pareto split). The ones that make up the first 80% of rentals are class A,
   the next 15% are B, and the rest are C. New toys start as B.
2. **Hard filters.** The toy must fit in any of its 6 rotations. The bin must have weight capacity and remaining volume
   (with an 85% packing factor). Multi-piece toys are never split across bins.
3. **Score.** Each bin that passes gets a weighted score:
   - space best-fit (35%): least leftover volume, and a bin sized like the toy, so small toys don't use up large bays;
   - velocity/zone match (30%): A goes to the FAST zone near dispatch, C to the SLOW zone at the back;
   - ergonomics (20%): heavy toys on low shelves;
   - affinity (15%): same SKU or same age band together.
4. The admin app shows the top 3 bins with reasons, and staff confirm by **scanning the bin label**.
5. A re-slot report lists toys whose demand no longer matches their zone.

## Algorithm 2: personalised catalog (`packages/shared/src/algorithms/recommend.ts`)

This is a hybrid ranker that works from the first login and improves as you collect data.

- **Signals:**
  - kid's age, computed live from date of birth (so results "age up" automatically);
  - interests picked at signup: electric, STEM, wooden, plush, pretend play, puzzles, blocks, outdoor, musical, arts;
  - behaviour: views 0.1, wishlist 0.5, rentals 1.0, ratings ±1, with a 30-day half-life.
- **Toy features:** taken from its metadata. Material WOODEN → wooden, FABRIC_PLUSH → plush, power ELECTRIC → electric,
  plus interest tags.
- **Score:** 0.35 · age fit + 0.35 · interest match (cosine) + 0.15 · popularity (rentals + Bayesian rating)
  + 0.10 · availability + 0.05 · newness. Toys the kid has already rented are scored lower.
  Toys outside the age window, or larger than the plan allows, are filtered out.
- **Diversity:** an MMR re-rank keeps the first screen varied. Each card shows why it was picked
  ("Matches: Wooden, STEM").
- **Next step** once rentals build up: item-to-item collaborative filtering ("kids who rented X also rented Y") added to the score.

## Project layout

```
apps/api/prisma/schema.prisma     data model (toys, units, pieces, QR images, warehouse, plans, subscriptions, orders)
apps/api/prisma/seed.ts           9 plans, 3-zone warehouse, 28 toys / 61 units put away through the real scan flow
apps/api/src/services/inventory.ts procurement + QR, scan resolution, stage moves, slot suggestions, reports
apps/api/src/routes/              auth, kids, catalog, plans/subscriptions/orders, admin
apps/customer/app/                expo-router screens (welcome, signup, home, catalog, toy, plans, my toys, profile)
apps/admin/app/                   expo-router screens (dashboard, scan, toys, toy form, unit, orders, warehouse, subscriptions)
```

## Roadmap

- Razorpay subscriptions and mandates; phone OTP login (MSG91).
- Next.js website on the same API and `@rentaltoys/shared` client.
- Delivery-partner view (scan at doorstep), real product photos and image upload.
- Collaborative filtering, and ratings prompts after each return.
