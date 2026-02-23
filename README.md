# 🚗 D&K Car Rentals

A full-stack web app for managing D&K Car Rentals — built with **Next.js**, **Supabase**, and **Tailwind CSS**.

## What's Included

### 🌐 Public Website (`/`)
- Beautiful landing page showing available vehicles
- Fleet gallery with availability status
- Online booking request form
- Contact section

### 🔐 Admin Dashboard (`/admin`)
- **Dashboard** — overview stats (vehicles, rentals, revenue, unpaid balance)
- **Vehicles** — add/edit/delete vehicles, toggle availability
- **Rentals** — log new rentals, track payments, mark as paid
- **Renters** — customer database with search
- **Requests** — review & approve/reject online booking requests
- **Reports** — revenue by vehicle, collection rate, period filtering

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"**
3. Give it a name (e.g. "dk-car-rentals"), set a database password, pick a region
4. Wait for it to spin up (~1 min)

### Step 2 — Set Up the Database

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Copy the entire contents of **`supabase-schema.sql`** from this project
3. Paste it into the SQL Editor and click **Run**
4. You should see "Success" — your tables are created!

### Step 3 — Get Your Supabase Keys

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key** (long string)
   - **service_role key** (keep this secret!)

### Step 4 — Configure Environment Variables

1. In the project folder, copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open `.env.local` and fill in your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ADMIN_PASSWORD=choose_a_secure_password
   ```

### Step 5 — Install & Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the website!

Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin)  
Default admin password: `dkrentals2024` (change this in `.env.local`!)

---

## 🌍 Deploy to Vercel (Free)

1. Push this project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/dk-car-rentals.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → Sign up with GitHub

3. Click **"New Project"** → Import your GitHub repo

4. Add your environment variables (same as `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_ADMIN_PASSWORD` (your chosen password)

5. Click **Deploy** — your site will be live at `yourproject.vercel.app`!

---

## 📁 Project Structure

```
dk-car-rentals/
├── app/
│   ├── page.tsx              # Public website homepage
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── admin/
│       ├── layout.tsx        # Admin sidebar + login
│       ├── page.tsx          # Dashboard
│       ├── vehicles/         # Vehicle management
│       ├── rentals/          # Rental logging & tracking
│       ├── renters/          # Customer database
│       ├── requests/         # Online booking requests
│       └── reports/          # Financial reports
├── lib/
│   └── supabase.ts           # Supabase client + TypeScript types
├── supabase-schema.sql       # Run this in Supabase SQL Editor
└── .env.local.example        # Copy to .env.local and fill in
```

---

## 🔒 Security Notes

- The admin password is stored in environment variables — never commit `.env.local` to GitHub
- `.gitignore` already excludes `.env.local`
- For production, consider upgrading to Supabase Auth for proper login
- The `service_role` key has full database access — keep it server-side only

---

## 💡 Adding a Custom Domain

Once deployed on Vercel:
1. Buy a domain (e.g. `dkcarrentals.com` on Namecheap ~$10/year)
2. In Vercel project settings → Domains → Add your domain
3. Follow the DNS instructions — takes 1-24 hours to activate
