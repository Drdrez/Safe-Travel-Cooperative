# Safe Travel Cooperative

A production-ready, two-portal rental management system for a transport cooperative.

- **`admin-dashboard/`** — Operations console for dispatchers, admins, and support staff.
- **`customer-dashboard/`** — Member-facing portal for booking, payments, tracking, and support.
- **`supabase/migrations/`** — SQL migrations (RLS, triggers, tables, views).

Both apps share the same Supabase project (auth, database, storage).

---

## 1. Requirements

- Node.js 20+ and npm 10+
- A Supabase project (free tier works)
- Modern browser

## 2. Local setup

Clone and install dependencies for each app:

```bash
cd admin-dashboard
npm install

cd ../customer-dashboard
npm install
```

## 3. Environment variables

Create a `.env` file in **both** `admin-dashboard/` and `customer-dashboard/` with:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
```

Never commit these files. The anon key is safe to ship to the browser; all
sensitive access is controlled by the Row Level Security policies in the
migration script.

## 4. Database migration

Open the Supabase SQL editor for your project and run the entire contents of:

```
supabase/migrations/001_production_schema.sql
```

This is idempotent — you can re-run it safely. It creates/updates:

- `profiles` with roles (`customer`, `driver`, `dispatcher`, `admin`)
- `handle_new_user()` trigger that auto-creates a profile on signup
- `vehicles`, `reservations`, `billings` columns used by both apps
- `app_settings` (cooperative info, operational prefs)
- `support_tickets` (customer ↔ admin messaging)
- `audit_log` (tamper-evident trail of sensitive writes)
- RLS policies so customers only see their own data, and admins see everything
- A `v_revenue_by_day` view used by the admin dashboard

### Creating the first admin

After running the migration, register a user through the **customer dashboard**
(or via Supabase Auth), then promote them in the SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'you@yourdomain.com';
```

They can now sign in to the **admin dashboard**. Only users with `role = 'admin'`
can access the admin portal — customers are blocked at login.

## 5. Running locally

```bash
# terminal 1
cd admin-dashboard && npm run dev

# terminal 2
cd customer-dashboard && npm run dev
```

Vite will print the local URLs. Admins sign in at the admin dashboard, customers
sign up / in at the customer dashboard.

## 6. Build for production

```bash
cd admin-dashboard && npm run build
cd ../customer-dashboard && npm run build
```

The output is in each app's `dist/` folder. Host them on any static CDN
(Netlify, Vercel, Cloudflare Pages, Firebase Hosting, S3+CloudFront). Point
each deployment's environment variables at the same Supabase project.

## 7. What to host on what domain

A common setup:

- `admin.yourcoop.com` → `admin-dashboard/dist`
- `app.yourcoop.com` → `customer-dashboard/dist`

Both share the same Supabase backend; there is nothing server-side to deploy.

## 8. Production hardening checklist

The codebase already:

- Requires re-authentication before password changes (admin & customer).
- Rejects non-admin accounts at the admin login.
- Delegates profile creation to a SECURITY DEFINER trigger so clients can't
  self-elevate to `admin`.
- Moves "client-side Paid" to `Pending Confirmation`, requiring an admin
  to approve before crediting a bill.
- Cascades reservation cancellations to their linked `billings` rows.
- Prevents vehicle double-booking with an availability check on create and on
  status change to `Confirmed`.
- Uses currency in `*_cents` consistently; never stores floats.
- Applies RLS on every table (customers self-scoped, admins unrestricted).

Before go-live, also:

1. Rotate the Supabase `JWT secret` once and invalidate old sessions.
2. Set up Supabase **email confirmations** for signups.
3. Wire a real payments processor (GCash / Maya / Stripe) into Billing.
4. Replace the deterministic position spread in admin `Tracking` with a real
   GPS telematics feed.
5. Configure Supabase storage CORS for `/avatars` if you add image uploads.
6. Enable point-in-time recovery and schedule off-site backups.

## 9. Project structure

```
admin-dashboard/
  src/
    components/        # pages + UI
    lib/
      supabase.ts      # client
      status.ts        # canonical status vocab
      date.ts          # timezone-safe formatters
      formatters.ts    # cents/PHP helpers
customer-dashboard/
  src/
    components/
      customer/        # customer-only pages
    lib/               # mirror of admin lib/
supabase/
  migrations/
    001_production_schema.sql
```

## 10. Scripts

Each app supports:

- `npm run dev` — Vite dev server
- `npm run build` — type-check (admin) + production build
- `npm run lint` — ESLint
- `npm run preview` — serve the built `dist/`

---

Built for the Safe Travel Cooperative. MIT-licensed unless otherwise stated.
