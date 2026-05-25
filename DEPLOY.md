# Deploy Oracle to Render + GitHub

## Before you push

- [ ] `apps/api/.env` is **not** staged (contains `OPENAI_API_KEY`)
- [ ] Run `git status` and confirm no `.env` files appear

## 1. Create GitHub repo

1. [github.com/new](https://github.com/new) → name e.g. `oracle-ai` → **Private** recommended → Create (no README if pushing existing code).

## 2. Push from your PC (Git Bash or PowerShell)

```powershell
cd "c:\Users\user\OneDrive\שולחן העבודה\oracle AI"

git init
git add .
git status
git commit -m "Oracle Life OS — i18n, mission tracker, Render ready"
git branch -M main
git remote add origin https://github.com/YOUR_USER/oracle-ai.git
git push -u origin main
```

## 3. Render — API service

**Option A — Blueprint:** Render → **New** → **Blueprint** → connect repo → uses `render.yaml`.

**Option B — Manual Web Service:**

| Setting | Value |
|---------|--------|
| Root Directory | `apps/api` |
| Build Command | `npm install && npx prisma generate && npm run build` |
| Start Command | `npx prisma db push && npm run db:seed && npm run start` |
| Health Check | `/health` |

**Database:** Add **PostgreSQL** on Render. Copy **Internal Database URL** into `DATABASE_URL`.

**Important:** Local dev uses SQLite (`file:./dev.db`). For Render Postgres, set in `apps/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then commit and redeploy. Render’s `DATABASE_URL` already uses `postgresql://...`.

**Environment variables:**

| Key | Value |
|-----|--------|
| `OPENAI_API_KEY` | Your OpenAI key |
| `DATABASE_URL` | Render Postgres internal URL |
| `CORS_ORIGIN` | Your frontend URL (comma not needed; single origin) |
| `PORT` | `4000` |

After first deploy, open `https://YOUR-API.onrender.com/health` — should return OK.

## 4. Frontend (share the app)

**Vercel** (recommended): Import repo, root `apps/web`, env:

```
NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com
```

Redeploy. Open the Vercel URL — Oracle should talk to Render API.

## 5. Free tier notes

- Render free API **spins down** when idle (cold start ~30s).
- SQLite on Render **does not persist** — use Postgres for production.
