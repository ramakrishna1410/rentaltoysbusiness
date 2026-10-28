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
