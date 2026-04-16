# OHF Dashboard

Private full-stack investment-club dashboard for a pooled eToro account. The app replaces the workbook model with a React + Supabase stack, deterministic unit-based accounting, secure backend-only eToro syncs, and historical portfolio snapshots.

by Charles Dobson and Stanley Gay

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts, React Router, TanStack Query
- Backend/platform: Supabase Postgres, Auth, RLS, Edge Functions
- Shared logic: pure TypeScript calculation engine in [`shared/calculations/index.ts`](/c:/Users/Stanl/OHF/shared/calculations/index.ts)

## What's implemented

- Private email/password login flow with authenticated routes and admin/viewer roles
- SQL schema + RLS for profiles, members, transactions, snapshots, holdings, settings, and audit logs
- Unit-based fund accounting with test coverage for units, ownership, pricing, separated fund cashflows, private transfer cost basis, and transfer-aware returns
- Admin/member/transaction UI, sortable tables, charts, toasts, dialogs, and finance-style dark theme
- Secure `sync-etoro-portfolio` Edge Function with mock fallback and audit logging
- Secure `generate-daily-review` Edge Function that turns snapshot/holding changes into a short internal review log post
- Sync-time FX conversion so broker totals can stay in USD while the stored fund ledger remains in GBP
- Workbook import script for `OHF.xlsx`, including zero-unit summary-only members
- Private member-to-member unit transfer flow that records paired `TRANSFER_OUT` and `TRANSFER_IN` ledger rows

## Hosted Supabase setup

This is now the recommended path. Docker is optional.

1. Create a Supabase project in the Supabase dashboard.
2. Log into the CLI:

```powershell
npx supabase login
```

3. Link this workspace to your hosted project:

```powershell
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

4. Copy [.env.example](/c:/Users/Stanl/OHF/.env.example) to `.env.local` and fill:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

5. Push the schema, policies, and seed settings to the hosted database:

```powershell
npm run supabase:push
```

6. Copy [.env.functions.example](/c:/Users/Stanl/OHF/.env.functions.example) to `.env.functions` and fill your eToro secrets plus `OPENAI_API_KEY` for AI daily reviews.

7. Push Edge Function secrets to the hosted project:

```powershell
npx supabase secrets set --env-file .env.functions
```

8. Deploy the sync function:

```powershell
npm run supabase:deploy
```

9. Seed the first admin user:

```powershell
npm run seed:admin
```

10. Import the workbook into the hosted database:

```powershell
npm run import:workbook -- --replace
```

11. Start the frontend:

```powershell
npm run dev
```

## Optional local Supabase with Docker

Use this only if you want the full backend running on your own machine.

```powershell
npm run supabase:start
npm run supabase:reset
npm run supabase:functions
```

For local mode, replace the `.env.local` values with the ones shown by:

```powershell
npx supabase status -o env
```

## Hosted workflow commands

```powershell
npm run supabase:push
npm run supabase:deploy
npm run supabase:schedule:hourly
npm run supabase:types:linked
npm run seed:admin
npm run import:workbook -- --replace
```

## Local workflow commands

```powershell
npm run supabase:start
npm run supabase:reset
npm run supabase:functions
npm run supabase:types
```

## App commands

```powershell
npm run dev
npm run build
npm run lint
npm run test
```

## Vercel deployment

This app can be deployed as a Vite SPA on Vercel.

1. Import the GitHub repo into Vercel.
2. Set these project environment variables in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not add `SUPABASE_SERVICE_ROLE_KEY` to the frontend deployment.

3. Deploy the project.
4. Add your custom domain in `Project -> Settings -> Domains`.
5. Copy the exact DNS record Vercel shows and add it in your DNS provider.

For `ohf.stanlgy.uk`, this will normally be a `CNAME`:

- Host: `ohf`
- Value: the exact Vercel-provided target

This repo includes [`vercel.json`](/c:/Users/Stanl/OHF/vercel.json) so Vercel will build the app as a Vite project and route SPA paths like `/members` and `/transactions` back to `index.html`.

## eToro sync behavior

- The browser never receives eToro credentials.
- The Edge Function reads `ETORO_API_KEY`, `ETORO_USER_KEY`, `ETORO_BASE_URL`, `ETORO_USE_MOCK`, `SYNC_CRON_SECRET`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- Live validation now checks `GET /api/v1/me` before using the real-account portfolio endpoint, and the sync reads the official `GET /api/v1/trading/info/real/pnl` payload for positions, credit, and PnL.
- Broker quote fields such as `openRate` and `closeRate` stay in USD for holdings display, while account summaries, holding market values, P&L, and unit price are converted into the configured fund currency during sync.
- If no manual broker-to-fund FX override is configured, the sync fetches the latest official ECB reference rates and stores the applied FX metadata inside each snapshot.
- If live credentials are missing, or mock mode is enabled, the sync falls back to deterministic mock data.
- Admins can trigger the sync from the `/admin` page. Each sync stores one `portfolio_snapshots` row plus its `holding_snapshots`.
- Admins can generate a daily review from the `/reviews` page. The review is stored in `daily_reviews`, includes a short "looking ahead" note for the next couple of days, and remains readable to the whole group.
- `npm run supabase:schedule:hourly` creates one cron job on the hour every hour for broker snapshots, plus a weekday `21:30 UTC` cron job for the end-of-day review post.
- The sync function deduplicates scheduled captures inside the same UTC hour, and the daily review job upserts by review date so the log stays clean.
- Open browser tabs also refetch their dashboard data once per hour, so the UI catches up after the background snapshot lands.

## Workbook import behavior

The importer reads `Members Summary` and `Transaction Log` from `OHF.xlsx` and:

- inserts every transaction row as the ledger source of truth
- upserts all member names found in either sheet
- preserves summary-only zero-unit names like `MCGLYN` as active members
- creates opening-balance ledger rows when the summary sheet shows non-zero units but the transaction log has no matching history
- stores the workbook starting unit price in `app_settings.starting_unit_price`

## Project structure

```text
src/
  app/
  components/
  features/
  lib/
  pages/
  types/
shared/
  calculations/
scripts/
supabase/
  functions/
  migrations/
```

## Notes

- The committed [`src/types/database.ts`](/c:/Users/Stanl/OHF/src/types/database.ts) is a checked-in snapshot. For a hosted project, regenerate it with `npm run supabase:types:linked` after linking the CLI.
- Member reporting now separates fund deposits/withdrawals from private unit purchases/sales, while still preserving the immutable raw ledger rows underneath.
- Member-to-member unit sales should be recorded through the dedicated transfer flow rather than creating `TRANSFER_IN` / `TRANSFER_OUT` rows manually.
- `FEE` is included in schema/type support for forward compatibility, but V1 still treats the app as a read-only broker integration plus manual internal accounting dashboard.
