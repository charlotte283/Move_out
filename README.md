# MOVEOUT (local, 1-2 people)

Next.js + React + SQLite (better-sqlite3). No accounts, no cloud. Everything runs on your machine.

## Run
    npm install      # needs internet once, to download packages
    npm run dev      # then open http://localhost:3000

Needs Node 18+. Data is stored in `data/moveout.db` (copy it to back up).

## What's included
Dashboard, Properties (+ per-person reviews, viewings, amenities), side-by-side Compare, Shopping list, Expenses (equal/custom split,
refundable deposits kept separate, settlements, live balance), Tasks (dependencies block completion), Settings (names, budget, moving date,
mark project complete without losing anything).

## Design decisions
- Money is entered in whole KES. Deposits are excluded from spend totals. Spend counts expenses only, so list prices never double-count.
- Item "When needed" is a label; an item is overdue only past its own target date, never because of moving day.
- Two-person "Acting as" switch stands in for login; edits are blocked if the record changed since you opened it.
- Adding a field later: edit `lib/schema.js`, then delete `data/moveout.db` (dev) or add the column manually with SQLite.

## Not included (by design, for now)
Logins/roles, file uploads, notifications, packing boxes, recurring bills, maintenance, charts, CSV/PDF export.
