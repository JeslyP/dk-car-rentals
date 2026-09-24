# What each file does, and what happens if you change it

A map of this project written for the person who has to maintain it. It answers
two questions: where do I go to change a given thing, and what will I break.

Nothing here is needed for day-to-day use of the app. This is only for editing
the code.

---

## Start here: I want to change...

| What you want to change | Where to go |
| --- | --- |
| Wording on the public site, the hero, the About text | `app/page.tsx` |
| Colours, light or dark | the tokens at the top of `app/globals.css` |
| The tax percentage | `NEXT_PUBLIC_TAX_RATE` in Vercel, then redeploy |
| The admin password | `ADMIN_PASSWORD` in Vercel, then redeploy |
| Business phone, email, address on invoices | `NEXT_PUBLIC_BUSINESS_*` in Vercel |
| What the money report calculates | `lib/finance.ts` |
| The list of cost categories | `lib/finance.ts` **and** the database, see the two-places rules |
| The admin menu items | the `navItems` list in `app/admin/layout.tsx` |
| A single admin screen | the matching `app/admin/<name>/page.tsx` |

Changing anything in Vercel needs a redeploy before it takes effect. Changing
code needs a push and a merge.

---

## How risky is each area

**Safe to edit freely.** Wording, colours, layout, the order of columns. If you
get it wrong the page looks odd and you change it back.

- `app/page.tsx`, any `app/admin/**/page.tsx`
- `app/globals.css`
- `components/ThemeToggle.tsx`, `components/UndoBar.tsx`

**Edit carefully, the tests will catch mistakes.** These decide what the numbers
say. Run `npm test` after any change.

- `lib/finance.ts`, `lib/rentals.ts`, `lib/upload.ts`

**Think twice.** These protect the data or the money. A mistake here is not
visible on screen.

- `lib/auth.ts` — who is allowed in
- `lib/validation.ts` — what the API will accept and write
- `middleware.ts` — the lock on every admin API route
- `lib/supabase-admin.ts` — the key that bypasses all database security
- `app/api/**` — every route handler

**Leave alone unless you know why.** Already applied to the live database.
Editing one changes nothing; you would need a new migration file instead.

- `supabase-schema.sql`, `supabase-migration-v2.sql` through `v10.sql`

---

## The files

### The public website

| File | What it does |
| --- | --- |
| `app/page.tsx` | The entire public site: navigation, hero, fleet, about, contact, the booking form and the Owner login link. All the customer-facing wording lives here. |
| `app/layout.tsx` | Wraps every page. Holds the small script that applies the saved light or dark theme before the page paints. |
| `app/globals.css` | Fonts, the colour tokens for both themes, the block that maps Tailwind's greys onto those tokens in dark mode, and the print rules. |

### The admin screens

Each is one file. Edit the one whose screen you want to change.

| File | Screen |
| --- | --- |
| `app/admin/layout.tsx` | The login card, the sidebar, the mobile bars, the theme toggle, the menu list |
| `app/admin/page.tsx` | Dashboard: the month's gross, tax, costs and profit |
| `app/admin/reports/page.tsx` | Money report, with the period picker, CSV export and full backup button |
| `app/admin/rentals/page.tsx` | Rentals list, the new rental form, the payments panel |
| `app/admin/expenses/page.tsx` | Costs list and the add-a-cost form |
| `app/admin/vehicles/page.tsx` | Vehicle cards, the add/edit form, the photo uploader |
| `app/admin/vehicles/[id]/log/page.tsx` | The printable per-car log sheet and its quick-entry row |
| `app/admin/rentals/[id]/invoice/page.tsx` | The printable invoice |
| `app/admin/calendar/page.tsx` | The month timeline |
| `app/admin/renters/page.tsx` | Customer list |
| `app/admin/requests/page.tsx` | Booking requests from the website |
| `app/admin/removed/page.tsx` | Removed items, with put back and destroy |

### The thinking, separate from the screens

This is where the rules live. It is kept apart from the pages so it can be
tested without a browser or a database.

| File | What it decides |
| --- | --- |
| `lib/finance.ts` | Every money figure. Gross, tax, cost groups, per-vehicle profit, month-by-month, CSV export. The biggest file and the most important. |
| `lib/rentals.ts` | Dates and money formatting. Billable days, overlapping dates, paid/partial/unpaid, `$` formatting. |
| `lib/validation.ts` | What the API accepts. Also the allowlist of which database columns each request may write. |
| `lib/auth.ts` | The password check, the signed login cookie, the login rate limit. |
| `lib/upload.ts` | Which photo formats and sizes are allowed, and the name a photo is stored under. |
| `lib/email.ts` | The booking notification emails. Does nothing until the Resend keys are set. |
| `lib/admin-resources.ts` | Maps a URL like `/api/admin/rentals` to a database table, and says which tables keep deleted records. |
| `lib/supabase.ts` | The browser's database connection, plus the TypeScript shapes of every record. |
| `lib/supabase-admin.ts` | The server's database connection. Uses the secret key that bypasses every security rule, so it must never be imported into a page. |
| `lib/api-client.ts` | The small wrapper the admin pages use to call the API. |
| `lib/payments-server.ts` | Recalculates a rental's paid total from its payments. |
| `lib/image-client.ts` | Shrinks a photo in the browser before it is uploaded. |

### The API

Everything the browser cannot be trusted to do itself.

| File | What it handles |
| --- | --- |
| `middleware.ts` | Blocks every `/api/admin/*` request without a valid login cookie. The single lock on the whole admin. |
| `app/api/admin/login/route.ts` | Checks the password, issues the cookie |
| `app/api/admin/session/route.ts` | Tells the page whether you are signed in |
| `app/api/admin/logout/route.ts` | Clears the cookie |
| `app/api/admin/[resource]/route.ts` | Lists and creates records for any table |
| `app/api/admin/[resource]/[id]/route.ts` | Reads, edits and removes one record |
| `app/api/admin/[resource]/[id]/restore/route.ts` | Puts back something removed |
| `app/api/admin/[resource]/[id]/purge/route.ts` | Destroys it for good. Refuses anything not already removed. |
| `app/api/admin/[resource]/[id]/approve/route.ts` | Turns a booking request into a rental |
| `app/api/admin/payments/route.ts` | Lists and records payments |
| `app/api/admin/log-entry/route.ts` | One row of a paper log sheet in a single step |
| `app/api/admin/upload/route.ts` | Stores a vehicle photo |
| `app/api/admin/backup/route.ts` | The full backup file |
| `app/api/admin/removed/route.ts` | Lists everything removed |
| `app/api/availability/route.ts` | **Public.** Which cars are booked for some dates |
| `app/api/requests/route.ts` | **Public.** Receives a booking request |

The two marked public are the only ones reachable without signing in. Be
careful adding anything to them.

### Database

Run once each, in number order, in the Supabase SQL editor. All are already
applied to the live project.

| File | What it did |
| --- | --- |
| `supabase-schema.sql` | Everything, for a brand new project |
| `supabase-migration-v2.sql` | Constraints and locked-down security rules |
| `supabase-migration-v3.sql` | Payments and costs tables |
| `supabase-migration-v4.sql` | Made a customer's phone optional |
| `supabase-migration-v5.sql` | Removed wide-open security policies |
| `supabase-migration-v6.sql` | The vehicle photo storage |
| `supabase-migration-v7.sql` | Made deleting reversible |
| `supabase-migration-v8.sql` | A removed rental takes its payments too |
| `supabase-migration-v9.sql` | A car can go back out on the day it is returned |
| `supabase-migration-v10.sql` | Costs can be marked paid or not paid yet |

Never edit one that has been run. It will not re-apply. Write a `v9` instead.

### Tests and settings

`tests/*.test.ts` check the money maths, the login, the validation rules and the
upload rules. They run in about a second and need no database.

`package.json`, `tsconfig.json`, `tailwind.config.js`, `next.config.js`,
`vitest.config.ts` are build settings. You will rarely touch them.

---

## Rules where one change needs two edits

Miss the second half and things break in confusing ways.

**Adding a cost category.** Three places:
1. `EXPENSE_CATEGORIES` in `lib/finance.ts`
2. `COST_GROUPS` in the same file, so it lands in Repairs, Gasoline, Car washes or Other
3. The `CHECK` list on the `expenses` table in the database, via a new migration

Miss the database and saving fails. Miss the groups and the dashboard totals
stop adding up. A test catches the second one.

**Adding a payment method.** `PAYMENT_METHODS` in `lib/finance.ts`, and the
`CHECK` list on the `payments` table.

**Adding a field to a record.** The column in the database, the type in
`lib/supabase.ts`, and the writable-columns list in `lib/validation.ts`. Without
the third one the API silently drops it.

**Changing the tax rate.** Only `NEXT_PUBLIC_TAX_RATE` in Vercel. It is not
written anywhere in the code.

---

## Making a change safely

```bash
npm install          # first time only
npm test             # the maths and the rules, about one second
npm run typecheck    # catches most mistakes before they run
npm run build        # what Vercel will do
npm run dev          # try it at http://localhost:3000
```

Then commit, push, open a pull request, merge it. Vercel deploys `main`
automatically, taking a couple of minutes.

If a change looks right but behaves oddly, check the browser console first, then
the Vercel deployment logs.

---

## If you break something

Vercel keeps every past deployment. Open the project, go to **Deployments**,
find the last one that worked, and choose **Rollback**. The site returns to that
version in seconds and the database is untouched.

The database is separate. A bad code deploy cannot corrupt it. A bad migration
can, which is why you take a backup from the Money page before running one.
