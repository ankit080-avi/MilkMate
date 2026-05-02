# MilkMate — Project Reference & Deploy Guide

A **multi-tenant SaaS PWA** for dairy operations.

- The **software admin (you)** sells the app to dairy shopkeepers ("owners").
- Each owner runs their own dairy: customers, delivery boys, products, prices, UPI — all isolated per owner.
- Owners pay you a monthly / quarterly / yearly subscription. Admin records payments manually.
- Backed by **Supabase** (Postgres + Realtime), hosted on **GitHub Pages**, wrapped as an **Android APK**.

> **IMPORTANT:** This file contains context to resume work in a fresh Claude session. The repo is **private** — do not make it public without first stripping mobile numbers / demo logins below.

---

## Live URLs & resources

| What | Where |
|---|---|
| **Live site** | https://ankit080-avi.github.io/MilkMate/ |
| **GitHub repo** | https://github.com/ankit080-avi/MilkMate |
| **Pages settings** | https://github.com/ankit080-avi/MilkMate/settings/pages |
| **Actions / deploy logs** | https://github.com/ankit080-avi/MilkMate/actions |
| **Supabase project** | https://supabase.com/dashboard/project/kmauurezrgovucpbkekq |
| **Supabase API URL** | `https://kmauurezrgovucpbkekq.supabase.co` |
| **Supabase Table Editor** | https://supabase.com/dashboard/project/kmauurezrgovucpbkekq/editor |
| **Supabase SQL Editor** | https://supabase.com/dashboard/project/kmauurezrgovucpbkekq/sql/new |
| **Local working folder** | `D:\milkmate` |
| **Latest backup zip** | `D:\milkmate-backup-YYYYMMDD-HHMMSS.zip` |

## Credentials

### Supabase
- **Project ref:** `kmauurezrgovucpbkekq`
- **Publishable key (anon, safe to share):** `sb_publishable_a3klASpmaN__EX38mCq9Ew_l_cUpUr3`
  - Hardcoded in `app.js` — that's by design (public client key)
- **Region:** Asia-Pacific

### GitHub
- **Account:** `ankit080-avi`
- **Repo:** `ankit080-avi/MilkMate` (private)
- Push to `main` → GitHub Actions deploys to Pages automatically.

---

## Roles

| Role | Who | Login | What they see |
|---|---|---|---|
| **Software Admin** | You (the seller) | Mobile `8858141463` → OTP `1235` | All dairy owners, all data, plans CRUD, payment recorder, approval queue |
| **Owner** | A dairy shopkeeper | Mobile + **password** (set during signup; legacy owners hit "Set a password" on first v8 login) | Only their own customers / boys / products / settings |
| **Customer** | An end customer of a dairy | Mobile + password (set on first login) | Their own orders, bill, schedule, extras catalog |
| **Delivery Boy** | An employee of a dairy | Mobile + password | Today's route (their assigned customers) |

The admin user is `id='u_admin'` in the `users` table. Don't delete this row.

---

## Architecture

```
[Phone APK]  ──HTTPS──▶  [GitHub Pages CDN]  ──serves──▶  index.html, app.js, styles.css
                                                                  │
                                                                  ▼
                                          [Supabase Postgres + Realtime + Presence]
```

- **APK** is a Capacitor thin shell that loads the GitHub Pages URL in a webview.
- **GitHub Pages** serves the static PWA files; service worker caches them.
- **Supabase** is the database. Every table is scoped by `ownerId` so data from one dairy never leaks to another.
- **Realtime Presence** powers the "online" green dot on customer avatars (no DB writes for this).
- **localStorage** is a write-through cache for fast first paint and offline reads. Writes go to localStorage immediately AND debounce-upsert to Supabase (300ms).

### Multi-tenant key
Every record (`deliveries`, `pauses`, `extra_orders`, `payments`, `notifications`, `holidays`, `products`, `product_ratings`, `dairy_settings`) carries an `ownerId text` column pointing at `users.id` of the owner. Customers/boys also carry `ownerId` to indicate which dairy they belong to. The owner's own row has `ownerId = NULL` (they ARE the dairy).

### Loading is scoped per session
On every login, the client filters queries by the active dairy:
- Owner: filter by `ownerId = me.id` (plus `ownerId IS NULL` legacy fallback during migration)
- Customer / boy: filter by `ownerId = me.ownerId`
- Admin: no filter — sees everything

---

## Subscription model

Each owner has:
- `subscription_plan text` — current plan key (e.g., `monthly_basic`)
- `subscription_started_at timestamptz` — when the current paid period started
- `subscription_expires_at timestamptz` — hard expiry
- 2-day grace period after `subscription_expires_at` (configurable in code, see `GRACE_DAYS`)

### Default plans (admin can edit)
| Plan key | Name | Price | Duration |
|---|---|---|---|
| `monthly_basic` | Monthly | ₹200 | 30 days |
| `quarterly_basic` | Quarterly | ₹500 | 90 days |
| `yearly_basic` | Yearly | ₹1500 | 365 days |

Stored in the `subscription_plans` table.

### Trial
When admin approves a new owner, they get **7 free days**. After that, they must pay or be cut off.

### Expiry behavior
- **0 days remaining ≤ X ≤ grace (2)**: app still works, big "Renew now" banner on owner home. Customers/boys still log in fine.
- **Past grace (X > 2)**: hard cutoff.
  - Owner: can log in but lands on the locked **Renew now** screen — no other actions.
  - Customers / boys: login is blocked with "Service expired — contact your dairy owner".
  - Already-logged-in customers/boys: auto-logged-out on next navigate.

### Renewal flow (manual, no payment gateway)
1. Owner taps a plan in the **Renew now** screen.
2. App opens WhatsApp deep-link to the admin (`8858141463`) with a prefilled message including the owner's id, plan, and amount.
3. Owner pays admin (UPI / cash / however).
4. Admin opens admin panel → owner detail → **Mark as paid** → picks the plan → optional note → expiry is extended by `plan.duration_days` (or set to `today + duration` if currently expired).
5. Owner gets a notification. They can resume normal use.

### Quota (separate from subscription)
Each approved owner can create up to **10 IDs** (customers + delivery boys combined) by default. To add more they tap "Request more IDs" → admin gets a notification → admin grants new limit in the **Grant more IDs** modal.

---

## Demo logins

- **Software Admin:** `8858141463` / OTP `1235` *(only role using OTP)*
- **Owner (Dairy 1):** `9999900001` / password *(legacy owner — first login routes to "Set a password" screen)*
- **Owner (Dairy 2):** `7887268581` / password *(same — set on first v8 login)*
- **Customer / Delivery boy:** mobile + password (set on first login if no `password_hash` exists)

To reset all data: in browser console run `MM.reset()` then `location.reload()`. To clear local cache: `localStorage.clear()` then reload.

---

## Daily workflow — making code changes & deploying

### 1. Run locally
```bash
python -m http.server 8766 --directory D:\milkmate
# open http://127.0.0.1:8766/
```

### 2. Edit files
- `app.js` — all logic, views, routing, multi-tenant scoping, subscription enforcement
- `styles.css` — design system
- `index.html` — script tags, modal layer

### 3. Bump cache version
In `index.html`, increment the `?v=N` query strings on `app.js` and `styles.css` so the service worker picks up new code:
```html
<link rel="stylesheet" href="styles.css?v=N+1"/>
<script src="app.js?v=N+1" defer></script>
```
And bump in `sw.js`:
```js
const VERSION = 'milkmate-vN+1';
```

### 4. Deploy to production
Just commit and push — the GitHub Actions workflow at `.github/workflows/deploy.yml` deploys to Pages automatically (~1 min).
```bash
cd D:\milkmate
git add -A
git commit -m "describe what changed"
git push
```
Watch the deploy at https://github.com/ankit080-avi/MilkMate/actions.

### 5. Verify deploy
```bash
curl -s https://ankit080-avi.github.io/MilkMate/app.js | wc -c
# size should match local file
```

### 6. Phone refresh
Force-stop the MilkMate app (Settings → Apps → MilkMate → Force stop), reopen — service worker pulls latest.

---

## Supabase schema (canonical)

If the project ever needs rebuilding from scratch, paste this in **SQL Editor**. It's idempotent — safe to re-run.

```sql
-- ====================================================================
-- USERS — supports admin / owner / customer / delivery_boy roles
-- ====================================================================
create table if not exists users (
  id text primary key,
  mobile text not null,
  name text not null,
  role text not null check (role in ('admin','owner','customer','delivery_boy')),
  address text,
  "dailyMl" int,
  plan text,
  "assignedBoyId" text,
  photo text,
  password_hash text,
  "ownerId" text,
  status text,
  customer_limit int,
  subscription_plan text,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists users_mobile_idx on users(mobile);
create index if not exists users_role_idx on users(role);
create index if not exists users_owner_idx on users("ownerId");
create index if not exists users_expiry_idx on users(subscription_expires_at) where role = 'owner';

-- ====================================================================
-- PER-DAIRY DATA TABLES — every row carries ownerId
-- ====================================================================
create table if not exists deliveries (
  id text primary key,
  "customerId" text not null,
  "ownerId" text,
  date date not null,
  status text not null check (status in ('delivered','skipped','pending')),
  ml int default 0,
  photo text,
  created_at timestamptz default now()
);
create unique index if not exists deliveries_customer_date_unique on deliveries("customerId", date);
create index if not exists deliveries_owner_idx on deliveries("ownerId");

create table if not exists pauses (
  id text primary key, "customerId" text not null, "ownerId" text,
  "from" date not null, "to" date not null,
  created_at timestamptz default now()
);
create index if not exists pauses_owner_idx on pauses("ownerId");

create table if not exists extra_orders (
  id text primary key, "customerId" text not null, "ownerId" text,
  "productKey" text not null, qty int not null,
  date timestamptz not null,
  status text not null check (status in ('pending','confirmed','delivered','cancelled')),
  created_at timestamptz default now()
);
create index if not exists extras_owner_idx on extra_orders("ownerId");

create table if not exists payments (
  id text primary key, "customerId" text not null, "ownerId" text,
  month text not null, amount numeric not null,
  date timestamptz not null,
  method text not null check (method in ('upi','cash')),
  created_at timestamptz default now()
);
create index if not exists payments_owner_idx on payments("ownerId");

create table if not exists notifications (
  id text primary key, "userId" text not null, "ownerId" text,
  type text not null, title text not null, body text,
  date timestamptz not null, read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_owner_idx on notifications("ownerId");

create table if not exists holidays (
  id bigserial primary key,
  "ownerId" text,
  date date not null,
  label text not null,
  created_at timestamptz default now(),
  unique ("ownerId", date)
);
create index if not exists holidays_owner_idx on holidays("ownerId");

create table if not exists products (
  "ownerId" text not null,
  key text not null,
  name text not null,
  price numeric not null,
  emoji text,
  active boolean default true,
  stock numeric default 0,
  created_at timestamptz default now(),
  primary key ("ownerId", key)
);

create table if not exists product_ratings (
  id text primary key,
  "customerId" text not null, "ownerId" text,
  "productKey" text not null,
  "orderId" text,
  rating int not null check (rating >= 1 and rating <= 5),
  review text,
  date timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists product_ratings_product_idx on product_ratings("productKey");
create index if not exists product_ratings_customer_idx on product_ratings("customerId");
create index if not exists ratings_owner_idx on product_ratings("ownerId");

-- ====================================================================
-- DAIRY SETTINGS — one row per owner (replaces app_settings singleton)
-- ====================================================================
create table if not exists dairy_settings (
  "ownerId" text primary key,
  "pricePerLitre" numeric default 60,
  "upiId" text default 'milkmate@upi',
  "upiName" text default 'MilkMate Dairy',
  "ownerWhatsApp" text default '',
  "businessName" text default 'My Dairy',
  "businessAddress" text default '',
  "businessPhone" text default '',
  language text default 'en',
  created_at timestamptz default now()
);

-- ====================================================================
-- SUBSCRIPTION SYSTEM
-- ====================================================================
create table if not exists subscription_plans (
  key text primary key,
  name text not null,
  price numeric not null,
  duration_days int not null,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);
insert into subscription_plans (key, name, price, duration_days, sort_order) values
  ('monthly_basic',   'Monthly',   200,  30, 1),
  ('quarterly_basic', 'Quarterly', 500,  90, 2),
  ('yearly_basic',    'Yearly',    1500, 365, 3)
on conflict (key) do nothing;

create table if not exists subscription_payments (
  id text primary key,
  "ownerId" text not null,
  plan_key text,
  amount_paid numeric not null,
  paid_at timestamptz default now(),
  expires_at timestamptz not null,
  marked_by_admin_id text,
  note text,
  created_at timestamptz default now()
);
create index if not exists sub_payments_owner_idx on subscription_payments("ownerId");

-- ====================================================================
-- SOFTWARE ADMIN — pre-seeded
-- ====================================================================
insert into users (id, mobile, name, role, status)
values ('u_admin', '8858141463', 'Software Admin', 'admin', 'approved')
on conflict (id) do update set role = 'admin', status = 'approved';

-- ====================================================================
-- RLS — anon allowed everywhere (tighten when adding real Supabase Auth)
-- ====================================================================
do $$ declare t text; begin
  for t in select unnest(array[
    'users','deliveries','pauses','extra_orders','payments','notifications',
    'holidays','products','product_ratings','dairy_settings',
    'subscription_plans','subscription_payments'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_all" on %I', t);
    execute format('create policy "anon_all" on %I for all to anon using (true) with check (true)', t);
    execute format('drop policy if exists "auth_all" on %I', t);
    execute format('create policy "auth_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ====================================================================
-- REALTIME
-- ====================================================================
do $$ declare t text; begin
  for t in select unnest(array[
    'users','deliveries','pauses','extra_orders','payments','notifications',
    'holidays','products','product_ratings','dairy_settings',
    'subscription_plans','subscription_payments'
  ]) loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
```

---

## File map

```
D:\milkmate\
├── index.html              shell + script tags + jsPDF + Supabase JS CDN
├── styles.css              mobile-first design system
├── app.js                  router + Store + multi-tenant logic + subscription guard
├── manifest.webmanifest    PWA manifest
├── sw.js                   network-first service worker (bump VERSION on changes)
├── qrcode.min.js           QR code generator (UPI payment QR)
├── icon-192.png / 512.png  home-screen icons
├── DEPLOY.md               this file
├── .gitignore              keeps backups, build artifacts, APKs out of git
├── .github/workflows/
│   └── deploy.yml          auto-deploys root to GitHub Pages on push to main
├── MilkMate.apk            wrapped Android APK (thin shell pointing at GitHub Pages URL) — gitignored
└── capacitor-app/          Capacitor project for rebuilding the APK
    ├── capacitor.config.json   has server.url → GitHub Pages URL
    ├── android/                Android Studio project
    └── www/                    web assets (re-copied from root on rebuild)
```

---

## Wrapping into APK

The APK is a Capacitor thin-shell that loads the live GitHub Pages URL. You don't need to rebuild it for code changes — only when you change `capacitor.config.json` or want a new version code.

```bash
cd D:\milkmate\capacitor-app
npx cap sync android
cd android
./gradlew assembleDebug
copy app\build\outputs\apk\debug\app-debug.apk ..\..\MilkMate.apk
```

`capacitor.config.json`:
```json
{
  "appId": "com.milkmate.app",
  "appName": "MilkMate",
  "server": {
    "url": "https://ankit080-avi.github.io/MilkMate",
    "androidScheme": "https",
    "cleartext": false
  }
}
```

Install on phone:
- Transfer `D:\milkmate\MilkMate.apk` → tap to install (allow "Install from unknown sources")
- Or: open https://ankit080-avi.github.io/MilkMate/ in Chrome → "Install app"

---

## Features

### Software Admin
- **Owner approval queue** — review pending applications, approve / reject
- **Per-owner dashboard** — drill into any owner to see customer count, boy count, quota usage, subscription days remaining, recent payments
- **Per-owner customer drill-down** — admin can see every dairy's customer list (name, mobile, address, dues)
- **Plans CRUD** — edit Monthly / Quarterly / Yearly prices and durations, create custom plans
- **Mark as paid** — record an owner's payment, extend their `subscription_expires_at`
- **Grant more IDs** — bump an owner's `customer_limit` past 10
- **Suspend / reactivate** — flip an owner's status
- **Hard delete owner** — cascade-deletes the owner + all their customers/boys/data

### Owner (dairy shopkeeper)
- **Subscription card** on home — countdown ("18 days left"), plan name, color-coded urgency
- **Renew now** button → plans modal → tap plan → opens WhatsApp to admin
- **Locked-down renewal screen** when past grace period — only renew button is interactive
- **Home dashboard** — clickable stat cards (Today / Customers / Revenue / Dues), procurement card, today's deliveries
- **Customers** — search, sort, add (quota-checked), edit, delete (cascade), reset password, send WhatsApp / bill PDF
- **Today** — Pending / Delivered / Skipped chips, bulk "Mark all delivered"
- **Settings** — own profile, business info, pricing, holidays, products CRUD (with emoji picker, stock, ratings), delivery boys CRUD
- **Reports** — period filters + 5 drill-downs (Volume, Deliveries, Collected, Outstanding, Extras) + print
- **Realtime sync** — changes propagate to all open clients within ~1s
- **Online presence** — green dot on customer avatars when they're using the app

### Customer
- Today / Schedule / Bill / Extras tabs
- Place / edit / cancel extras orders (stock-aware: blocks if `qty > stock`)
- Rate delivered products (1-5 ★ + optional review)
- Pause/resume delivery (vacation mode)
- Tap any avatar to view full-size photo
- View bill, pay via UPI (deep-link or QR)

### Delivery Boy
- Today route (only assigned customers)
- Mark delivered with photo proof
- Print route sheet

### Cross-cutting
- **i18n** — English / Hindi / Marathi
- **Print stylesheet** for all detail views
- **PDF bills** with business header, line items, total, amount in Indian-words, UPI footer
- **Holiday calendar** in Settings + banner on Today screen
- **Notifications management** — every role can manage their bell-icon inbox:
  - Tap bell → see all notifications (read + unread)
  - **☑ Select** mode → tap rows or "Select all" → "🗑 Delete (N)" to bulk-delete
  - **Mark all as read** — clears unread badges
  - **🗑 Delete all notifications** — wipes the user's entire inbox after confirm

---

## Common debugging

| Problem | Fix |
|---|---|
| App shows old version | Force-stop app (Settings → Apps → MilkMate → Force stop). Bump `?v=N` in index.html and SW VERSION. |
| Admin can't log in | Check `users` table has `id='u_admin'`. Re-run the canonical schema's "SOFTWARE ADMIN" insert if missing. |
| Owner sees no customers | Check the customer rows in Supabase have `ownerId` set to that owner's id. Backfill with `update users set "ownerId" = '<owner-id>' where role = 'customer' and "ownerId" is null;` |
| Owner can't login (was working) | Check `subscription_expires_at` — they may be past grace. Admin → owner detail → Mark as paid. |
| Customer/boy can't log in | Their owner is past grace OR the customer's `password_hash` is wrong. Owner can reset password from customer-edit form. |
| Two dairies showing each other's customers | Realtime fired before scoping rebuilt cache; reload the app. |
| Realtime not working | In SQL Editor: `select * from pg_publication_tables where pubname = 'supabase_realtime';` — should list all tables. Re-run realtime block from canonical schema if missing. |
| Bill amount wrong | Check `customerMonthBill()` — only delivered extras count. |
| "users_role_check" violation when seeding admin | Drop and recreate the constraint to include `'admin'`. See canonical schema. |
| Profile photo not showing | The `photo` column is a base64 dataURL. Long-term: move to Supabase Storage. |
| PDF preview fails on Android | Android Chrome doesn't render PDFs in iframes — that's why we render HTML preview, then generate PDF only on Download/Share click. |
| GitHub Pages deploy failed | Check https://github.com/ankit080-avi/MilkMate/actions — usually a YAML issue or Pages disabled in repo settings. |

### Useful console commands

```js
// Inspect data
MM.Store.data.users
MM.Store.data.users.filter(u => u.role === 'owner')
MM.Store.data.dairySettings
MM.Store.data.settings.products

// Force a re-fetch from Supabase
MM.Store.loadFromRemote()

// Reset local cache (keeps remote intact)
localStorage.clear(); location.reload();

// Reset everything (clears localStorage + reseeds; will re-upload to Supabase if remote is empty)
MM.reset()

// Switch role for debugging (bypasses login)
MM.App.user = MM.Store.data.users.find(u => u.role === 'admin')
sessionStorage.setItem('milkmate-session', JSON.stringify(MM.App.user))
MM.navigate('admin')
```

---

## Onboarding a new dairy shopkeeper

1. Shopkeeper opens the app → enters their 10-digit mobile → app shows "Apply for owner account" form (name, dairy name, WhatsApp, **password**).
2. They submit → status `pending`. You get an in-app notification.
3. You log in as admin → **Pending applications** → tap their card → **Approve owner**. They get a 7-day free trial.
4. Owner gets a notification "Account approved 🎉" and can now log in with their **mobile + the password they chose at signup**. They land on the owner dashboard.
5. Owner adds up to 10 customers / delivery boys. If they need more, they tap "Request more IDs" → you get a notification → you grant a higher limit.
6. Before their 7 free days expire, they tap **Renew now** → pick a plan → WhatsApp you. They pay you. You log in as admin → owner detail → **Mark as paid** → pick the plan → expiry extended.

> **Note on auth (changed in v8):** Owner / customer / delivery boy all log in via **password** now, not OTP. Only the software admin uses OTP (`1235`). Existing owners with no password set will be routed to a "Set a password" screen on their next login.

---

## What's NOT done yet (open follow-ups)

1. **Real authentication** — currently demo OTP `1234` for owner, `1235` for admin. Replace with Supabase Auth (Phone OTP via Twilio, ~₹6/SMS in India) when going to scale.
2. **Tighten Row-Level Security** — anon can read every user's `password_hash` today. After moving to Supabase Auth, replace `using (true)` policies with per-user policies.
3. **Photos in Supabase Storage** — currently base64 in DB column. Fine at small scale, eventually move to Storage bucket (`/avatars/`, `/delivery-proofs/`).
4. **Offline write queue** — reads work offline (cache). Writes currently fail silently if offline.
5. **Push notifications when app is closed** — needs Web Push subscription + backend (Edge Function).
6. **Auto-recurring billing** — admin marks payments manually for now. Later: integrate Razorpay/Stripe + automatic plan renewal.
7. **Dunning** — WhatsApp owners 5/2/0 days before expiry. Currently no automated reminders.
8. **Subscription audit log** — `subscription_payments` table is in place but admin UI for viewing payment history is minimal. Expand if needed.

---

## Quick "resume work" checklist for a new Claude session

If a new chat session starts and you want to continue:

1. Tell Claude: *"Read `D:\milkmate\DEPLOY.md` first."*
2. Claude has all the context it needs from this file.
3. Make changes locally → `git add -A && git commit -m "..." && git push`. GitHub Actions deploys to Pages automatically.
4. If state has drifted (Supabase paused, Pages broken, etc.), use the troubleshooting section above.

---

*Last updated: v10 — migrated from Netlify to GitHub Pages. Owner login via password (admin keeps OTP `1235`), notifications inbox got multi-select + delete-all, subscription system live (Monthly ₹200 / Quarterly ₹500 / Yearly ₹1500 + 2-day grace + 7-day trial), per-owner customer drill-down for admin, hard-delete owner with cascade. Backup at `D:\milkmate-backup-20260430-190523.zip`.*
