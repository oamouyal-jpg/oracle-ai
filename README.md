# Oracle — Human Development Operating System

Oracle is the world's first **Human Development Operating System** — software designed to maximise long-term flourishing, freedom, wisdom, and development. Not engagement. Not entertainment. Human growth.

**Vision & architecture:** [docs/VISION.md](./docs/VISION.md) · [docs/MODULES.md](./docs/MODULES.md) · [AGENTS.md](./AGENTS.md)

A personal operating system for life: intelligent organization, mission control, strategic AI coaching, and nightly debrief.
## Stack

- **Web**: Next.js 15, Tailwind CSS 4, Framer Motion, TypeScript
- **API**: Express 5, Prisma, PostgreSQL, OpenAI
- **Realtime**: WebSockets (`/ws` on API)

## Quick start

### 1. Install

```bash
npm install
```

### 2. Database

Create PostgreSQL and copy env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Set `DATABASE_URL` in `apps/api/.env`. Optional: set `OPENAI_API_KEY` for live AI (mock responses work without it).

```bash
npm run db:push
npm run db:seed
```

### 3. Run

```bash
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000  

## MVP features

| Feature | Route |
|---------|--------|
| Command Center dashboard | `/` |
| Life Map | `/life-map` |
| Domains | `/domains` |
| **Mission Tracker** (AI progress + trading coach) | `/missions` |
| Tasks + AI prioritize | `/tasks` |
| Daily Briefing | `/briefing` |
| **Night Debrief** | `/debrief` |
| Oracle AI chat | `/chat` |
| Execution Mode (20-min blocks) | `/execute` |
| Journal + mood | `/journal` |

## Languages

Switch language in the **sidebar** (bottom): **English**, **עברית**, **Français**.

- UI labels and navigation translate immediately
- **Hebrew** uses RTL layout
- AI responses (chat, briefing, debrief, reflections, missions) follow the selected language via `x-locale`
- Voice input/output uses `he-IL`, `fr-FR`, or `en-US` as appropriate

## Voice (browser speech)

Uses the built-in **Web Speech API** (no extra API keys):

- **Mic** — dictate in Oracle chat, journal, and quick reflection (Chrome or Edge recommended)
- **Listen** — read aloud Oracle replies, daily briefing, and reflection analysis

Allow microphone access when prompted.

## Life Alignment Engine (`/alignment`)

Multi-layered progress beyond checkboxes:

- **Task layer**: Complete, Partial, Skipped, Delayed, Rescheduled + effort & emotional difficulty
- **AI reflections**: Natural-language check-ins extract real progress, avoidance, momentum
- **Mission momentum**: Momentum, stability, and resistance scores per mission
- **Pattern & friction detection**: Personalized behavioral insights
- **Core metric**: "Is your life genuinely moving forward?"

## Mission Tracker

Create and track major life missions with:

- Why it matters, desired outcome, risks, blockers, next actions
- Emotional difficulty and progress %
- Daily updates and weekly reviews with AI analysis
- **Trading missions**: discipline-focused coach (micro contracts only, no revenge trading / over-leverage encouragement)
  - Daily session log with 7 coaching questions
  - Discipline, execution, and risk control scores
  - Daily and weekly AI reports

## Night Debrief

Guided reflection across execution, emotions, relationships, health, and self-awareness. AI returns:

- Strategic scores (Focus, Emotional, Execution, Alignment, Energy)
- Behavioral analysis
- Tomorrow's strategic plan

## Deployment

### GitHub → Render (API)

1. Push this repo to GitHub (see commands below). **Never commit** `apps/api/.env` — it is gitignored.
2. [Render](https://render.com) → **New** → **Blueprint** (or **Web Service** connected to the repo).
3. Use `render.yaml` in the repo root, or configure manually:
   - **Root directory:** `apps/api`
   - **Build:** `npm install && npx prisma generate && npm run build`
   - **Start:** `npm run db:deploy && npm run db:seed && npm run start` (first deploy seeds DB; optional on later deploys)
   - **Health check path:** `/health`
4. Add a **PostgreSQL** database on Render and set **`DATABASE_URL`** (not SQLite in production).
5. Environment variables on the **API** service:

   | Variable | Value |
   |----------|--------|
   | `OPENAI_API_KEY` | Your `sk-...` key |
   | `DATABASE_URL` | From Render Postgres (Internal URL) |
   | `CORS_ORIGIN` | Your public web URL (e.g. Vercel) |
   | `PORT` | `4000` (or leave Render default) |

### Web (Vercel or Render)

- **Web**: Vercel (`apps/web`) is typical; or a second Render static/web service.
- Set **`NEXT_PUBLIC_API_URL`** to your live API URL (e.g. `https://oracle-api.onrender.com`).
- Do **not** put `OPENAI_API_KEY` on the web service.

### Push to GitHub (run locally in PowerShell)

```powershell
cd "c:\Users\user\OneDrive\שולחן העבודה\oracle AI"
git init
git add .
git status
git commit -m "Oracle Life OS — ready for Render deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Replace `YOUR_USERNAME/YOUR_REPO` with your GitHub repo. Confirm `git status` does **not** list `apps/api/.env` before committing.

## Auth (next step)

MVP uses a dev user (`operator@oracle.local`). Wire [Clerk](https://clerk.com) or Auth.js by passing `x-user-id` from the web app and replacing `resolveUserId` in the API.
