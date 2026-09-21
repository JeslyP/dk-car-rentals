# 🚗 D&K Car Rentals

A full-stack web app for managing D&K Car Rentals — built with **Next.js 14**, **Supabase**, and **Tailwind CSS**.

## What's Included

### 🌐 Public Website (`/`)
- Landing page showing the vehicles listed for rent
- Real-time availability: pick dates and see which cars are free
- Online booking request form with server-side validation
- Optional email notification to you (and a confirmation to the customer) on every request

### 🔐 Admin Dashboard (`/admin`)
The admin side is built around the bookkeeping: what each vehicle earned, what it
cost to run, and what is left over at the end of the month.

- **Dashboard** — the month's statement: gross income from all vehicles, the government's percentage set aside, the cost of operation broken into repairs, gasoline, car washes and other, and the net profit left over
- **Money** — the monthly (or yearly) profit and loss statement: per-vehicle profit, cost breakdown, month-by-month history, print and CSV export
- **Rentals** — log rentals and record each payment with the date it arrived
- **Costs** — log fuel, repairs, insurance, registration and the rest, per vehicle or business-wide
- **Log sheet** — each vehicle has a printable page laid out like the paper sheet kept for that car (client, phone, from, to, days, charge, paid), with a quick-entry row for typing up a stack of sheets
- **Calendar** — month timeline showing who has which vehicle on which days
- **Vehicles** — add/edit/delete vehicles, list or unlist them from the website
- **Renters** — customer database with search and rental counts
- **Requests** — approve a booking request and turn it into a rental in one click, or reject it

### 📋 Typing up the paper sheets
Each car has a **Log sheet** page reached from the Vehicles list, laid out like the
paper sheet kept in the file: client name, phone, from, to, number of days, charge
and whether it was paid, in date order, with the totals at the bottom. It prints
onto one page.

At the bottom is a quick-entry row for working through a stack of sheets. Type the
name, the two dates and the charge, tick Paid, and press Add row. A customer name
that already exists is reused, a new one is created, and the From date carries over
to the next row so a sequence of rentals is fast to enter. Ticking Paid records the
full charge as received on the To date, which you can correct later if the money
actually arrived on a different day.

### 🧮 The monthly statement
The dashboard answers one question: what did the business actually keep this month?

```
  Gross income from all vehicles      money received in the month
− Government tax                      12% of the gross by default
− Cost of operation                   repairs + gasoline + car washes + other
─────────────────────────────────────
= Net profit
```

Repairs covers servicing, parts and tires. Other covers insurance, registration,
towing, financing and fees, so every cost lands in exactly one group and the four
always add up to the total. Use the arrows to step back through previous months,
and Print for a copy on paper.

The tax percentage is set with `NEXT_PUBLIC_TAX_RATE` (default 12). Change it in
`.env.local` or in Vercel and redeploy.

### 💵 How the money side works
- **Every payment carries its own date.** Money counts towards the month it was
  actually received, which is what you normally report for tax. A rental that ran
  in September but was paid in October shows as October income.
- A rental's paid total and status are calculated from its payments, so the two
  can never drift apart. You never type a "paid" figure directly.
- **Costs** are recorded against a vehicle, or against the business when they are
  not tied to one car. Categories are fuel, maintenance, repairs, tires, parts,
  insurance, registration, cleaning, towing, loan, fees and other.
- The report shows two views of income side by side: **money received** (cash
  basis, the profit headline) and **invoiced** (the full price of rentals that
  started in the period, paid or not) with the amount still owed.
- **Print** gives a clean one-page statement. **Export CSV** gives your
  accountant the same figures as a spreadsheet, plus a one-row-per-cost export
  from the Costs page.

### 🔒 Security model
- The admin password lives **only on the server** (`ADMIN_PASSWORD`). Logging in sets a signed, `httpOnly` cookie that expires after 7 days.
- All admin data goes through `/api/admin/*` route handlers, which verify that cookie and then use the Supabase **service role** key server-side.
- The browser only uses the public anon key, and row level security lets it read nothing but listed vehicles. The admin tables have no grants for that key at all, so a policy added by mistake later still cannot expose them.
- The database refuses overlapping rentals for the same vehicle and rentals whose end date is before their start date.

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"**
3. Give it a name (e.g. "dk-car-rentals"), set a database password, pick a region
4. Wait for it to spin up (~1 min)

### Step 2 — Set Up the Database

**New project:**
1. In Supabase, click **SQL Editor** in the left sidebar
2. Paste the entire contents of **`supabase-schema.sql`** and click **Run**

**Already running an earlier version of this app:**
Run the migration files in order in the SQL Editor, instead of the schema file:

1. **`supabase-migration-v2.sql`** — removes the old availability trigger, adds the
   constraints, and tightens the security policies without touching your data.
   If it reports that the overlap constraint could not be created, you have two
   rentals for the same vehicle with overlapping dates. Fix them in the admin,
   then run the file again.
2. **`supabase-migration-v3.sql`** — adds the `payments` and `expenses` tables that
   the money report needs. Any amount already marked as paid is converted into a
   payment dated on the rental's start date, so no money is lost. If some of those
   dates are wrong for your records, open the rental's Payment panel and re-enter
   them.
3. **`supabase-migration-v4.sql`** — makes a customer's phone number optional,
   because the paper sheets usually record a name only.
4. **`supabase-migration-v5.sql`** — removes any wide-open "Allow all" policies
   and takes the default table grants away from the public key. Worth running
   even on a database you believe is clean: permissive policies get added while
   debugging and then forgotten, and with them in place anyone who views the
   website's source can read and delete your customer and payment records.

All four files are safe to run more than once.

### Step 3 — Get Your Supabase Keys

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key**
   - **service_role key** (keep this secret — it is only ever used on the server)

### Step 4 — Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open `.env.local` and fill in the values. The required ones are:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ADMIN_PASSWORD=choose_a_long_random_password
   ```
   Optional extras (email notifications, invoice details, a dedicated cookie-signing secret) are documented inside the file.

### Step 5 — Install & Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the website.

Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin) — log in with the `ADMIN_PASSWORD` you chose. There is no default password.

### Step 6 — (Optional) Email notifications

1. Create a free account at [resend.com](https://resend.com) and add + verify your sending domain
2. Create an API key
3. Set `RESEND_API_KEY`, `NOTIFY_EMAIL` (your inbox) and `EMAIL_FROM` (an address on your verified domain) in `.env.local` / Vercel

Until all three are set, requests are still saved and shown in the admin; you just won't get an email.

---

## 🧪 Checks

```bash
npm run typecheck   # TypeScript
npm test            # unit tests (vitest) for rental and money maths, auth, validation, email
npm run build       # production build
```

The same three commands run in GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

---

## 🌍 Deploy to Vercel (Free)

1. Push this project to GitHub.
2. Go to [vercel.com](https://vercel.com) → Sign up with GitHub → **New Project** → import the repo. Vercel detects Next.js automatically; no build settings to change.
3. Under **Environment Variables** add, for Production (and Preview if you want):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET` (recommended — `openssl rand -hex 32`)
   - `NEXT_PUBLIC_SITE_URL` — your Vercel URL, used for links in emails
   - `NEXT_PUBLIC_TAX_RATE` — the government's percentage of gross income (default 12)
   - the optional `RESEND_*` / `NOTIFY_EMAIL` / `EMAIL_FROM` / `NEXT_PUBLIC_BUSINESS_*` values if you use them
4. Click **Deploy** — your site will be live at `yourproject.vercel.app`.
5. Changing an environment variable later? Redeploy from the Vercel dashboard so it takes effect.

---

## 📁 Project Structure

```
dk-car-rentals/
├── app/
│   ├── page.tsx                  # Public website homepage
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── admin/
│   │   ├── layout.tsx            # Admin login + sidebar
│   │   ├── page.tsx              # Dashboard (this month's money)
│   │   ├── expenses/             # Running costs per vehicle
│   │   ├── vehicles/[id]/log/    # Printable per-car log sheet + quick entry
│   │   ├── reports/              # Monthly profit and loss, print + CSV
│   │   ├── calendar/             # Month timeline of rentals per vehicle
│   │   ├── vehicles/             # Vehicle management
│   │   ├── rentals/              # Rental logging, payments
│   │   │   └── [id]/invoice/     # Printable invoice
│   │   ├── renters/              # Customer database
│   │   └── requests/             # Online booking requests
│   └── api/
│       ├── admin/login|logout|session   # Cookie-based admin auth
│       ├── admin/[resource]/...         # Admin CRUD (vehicles, renters, rentals, requests)
│       ├── availability/                # Public: booked vehicle ids for a date range
│       └── requests/                    # Public: submit a booking request (+ email)
├── lib/
│   ├── auth.ts                   # Session token signing/verification, rate limiting
│   ├── rentals.ts                # Date/money helpers (billable days, overlap, status)
│   ├── finance.ts                # Monthly totals, per-vehicle profit, CSV export
│   ├── validation.ts             # Input validation and writable-column allowlists
│   ├── email.ts                  # Resend integration (no-op when unconfigured)
│   ├── supabase.ts               # Browser client (anon key) + TypeScript types
│   └── supabase-admin.ts         # Server client (service role key)
├── middleware.ts                 # Protects /api/admin/*
├── tests/                        # Vitest unit tests
├── supabase-schema.sql           # Fresh install
├── supabase-migration-v2.sql     # Upgrade: constraints + RLS
├── supabase-migration-v3.sql     # Upgrade: payments + expenses (bookkeeping)
├── supabase-migration-v4.sql     # Upgrade: optional customer phone number
├── supabase-migration-v5.sql     # Upgrade: remove open policies, tighten grants
└── .env.local.example            # Copy to .env.local and fill in
```

---

## 💡 Adding a Custom Domain

Once deployed on Vercel:
1. Buy a domain (e.g. `dkcarrentals.com` on Namecheap ~$10/year)
2. In Vercel project settings → Domains → Add your domain
3. Follow the DNS instructions — takes 1-24 hours to activate
4. Set `NEXT_PUBLIC_SITE_URL` to the new domain and, if you send email, use an address on that domain for `EMAIL_FROM`
