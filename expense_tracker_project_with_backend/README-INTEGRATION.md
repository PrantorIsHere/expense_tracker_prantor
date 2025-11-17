# Integration: Expense Tracker (Frontend + New PostgreSQL Backend)

## How this modifies your project
- Adds **server/** (Express + PostgreSQL + JWT) per your setup guide
- Adds **schema.sql** at repo root
- Frontend now has **src/lib/api.ts** and **src/lib/auth.ts** (API-based auth)
- `expensee/package.json` scripts updated to run **both** frontend & backend with `pnpm run dev`

## Run
```bash
# 1) PostgreSQL ready (create db, user, run schema)
cd expensee
pnpm run db:setup  # or: psql -U root -h localhost -d expense_tracker -f ../schema.sql

# 2) Server env
cd ../server && cp .env.example .env

# 3) Start both
cd ../expensee
pnpm install
pnpm run dev
```

Backend: http://localhost:3001/api  
Frontend: http://localhost:5173
