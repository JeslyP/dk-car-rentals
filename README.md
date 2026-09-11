# 🚗 D&K Car Rentals

A full-stack web app for managing D&K Car Rentals — built with **Next.js 14**, **Supabase**, and **Tailwind CSS**.

## What's Included

### 🌐 Public Website (`/`)
- Landing page showing the vehicles listed for rent
- Real-time availability: pick dates and see which cars are free
- Online booking request form with server-side validation
- Optional email notification to you (and a confirmation to the customer) on every request

### 🔐 Admin Dashboard (`/admin`)
- **Dashboard** — vehicles free today, active and upcoming rentals, unpaid balance, month revenue
- **Calendar** — month timeline showing who has which vehicle on which days
- **Vehicles** — add/edit/delete vehicles, list or unlist them from the website
- **Rentals** — log rentals, record payments, edit, delete, and print an invoice
- **Renters** — customer database with search and rental counts
- **Requests** — approve a booking request and turn it into a rental in one click, or reject it
- **Reports** — revenue by vehicle, top renters, collection rate, period filtering

### 🔒 Security model
- The admin password lives **only on the server** (`ADMIN_PASSWORD`). Logging in sets a signed, `httpOnly` cookie that expires after 7 days.
- All admin data goes through `/api/admin/*` route handlers, which verify that cookie and then use the Supabase **service role** key server-side.
- The browser only uses the public anon key, and row level security lets it read nothing but listed vehicles.
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

**Already running the previous version of this app:**
1. Paste **`supabase-migration-v2.sql`** into the SQL Editor and click **Run** instead. It removes the old availability trigger, adds the constraints, and tightens the security policies without touching your data.
2. If it reports that the overlap constraint could not be created, you have two rentals for the same vehicle with overlapping dates. Fix them in the admin, then run the file again.

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
npm test            # unit tests (vitest) for rental math, auth tokens, validation, email
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
│   │   ├── page.tsx              # Dashboard
│   │   ├── calendar/             # Month timeline of rentals per vehicle
│   │   ├── vehicles/             # Vehicle management
│   │   ├── rentals/              # Rental logging, payments
│   │   │   └── [id]/invoice/     # Printable invoice
│   │   ├── renters/              # Customer database
│   │   ├── requests/             # Online booking requests
│   │   └── reports/              # Financial reports
│   └── api/
│       ├── admin/login|logout|session   # Cookie-based admin auth
│       ├── admin/[resource]/...         # Admin CRUD (vehicles, renters, rentals, requests)
│       ├── availability/                # Public: booked vehicle ids for a date range
│       └── requests/                    # Public: submit a booking request (+ email)
├── lib/
│   ├── auth.ts                   # Session token signing/verification, rate limiting
│   ├── rentals.ts                # Date/money helpers (billable days, overlap, status)
│   ├── validation.ts             # Input validation and writable-column allowlists
│   ├── email.ts                  # Resend integration (no-op when unconfigured)
│   ├── supabase.ts               # Browser client (anon key) + TypeScript types
│   └── supabase-admin.ts         # Server client (service role key)
├── middleware.ts                 # Protects /api/admin/*
├── tests/                        # Vitest unit tests
├── supabase-schema.sql           # Fresh install
├── supabase-migration-v2.sql     # Upgrade an existing database
└── .env.local.example            # Copy to .env.local and fill in
```

---

## 💡 Adding a Custom Domain

Once deployed on Vercel:
1. Buy a domain (e.g. `dkcarrentals.com` on Namecheap ~$10/year)
2. In Vercel project settings → Domains → Add your domain
3. Follow the DNS instructions — takes 1-24 hours to activate
4. Set `NEXT_PUBLIC_SITE_URL` to the new domain and, if you send email, use an address on that domain for `EMAIL_FROM`
