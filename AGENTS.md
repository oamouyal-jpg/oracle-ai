# Oracle — Agent & Developer Guide

Oracle is the **Human Development Operating System** — not an app optimised for engagement, but software designed to maximise long-term flourishing, freedom, wisdom, and development.

## Required reading

| Document | Purpose |
|----------|---------|
| [docs/VISION.md](./docs/VISION.md) | Full manifesto and final directive |
| [docs/MODULES.md](./docs/MODULES.md) | Module registry: vision → code → roadmap |

## Before writing code

1. **Does this serve human flourishing?** If not, it does not belong in Oracle.
2. **Does it plug into shared memory?** New features read/write through existing user models (`User`, `AIMemory`, operator learning) — never fork profile state.
3. **Does it protect attention?** No infinite scroll, engagement hacks, or manipulative notifications.
4. **Is it modular?** Register new capabilities in `docs/MODULES.md` and `apps/api/src/lib/oracleConstitution.ts`.
5. **Design Version 100, ship the smallest coherent step** — no disposable systems, no hardcoded limitations.

## AI system prompts

All Oracle AI modules must inherit the constitution:

```ts
import { withOracleConstitution } from "../lib/oracleConstitution.js";

const MODULE_SYSTEM = withOracleConstitution(`You are Oracle Clarity — ...`);
```

Constitution source: `apps/api/src/lib/oracleConstitution.ts`  
Full vision: `docs/VISION.md`

## Stack

- **Web:** Next.js 15, Tailwind 4, TypeScript — `apps/web`
- **API:** Express 5, Prisma, PostgreSQL, OpenAI — `apps/api`
- **i18n:** English, Hebrew (RTL), French — `x-locale` header

## Key modules (today)

| Route | Engine |
|-------|--------|
| `/inner-os` | Psychology Engine |
| `/clarity` | Decision + Planning |
| `/briefing`, `/` | Vision + Purpose |
| `/alignment`, `/debrief`, `/journal` | Reflection |
| `/tasks`, proactive push | Planning + Attention |

See [docs/MODULES.md](./docs/MODULES.md) for the full registry.

## Ethics (non-negotiable)

- Never diagnose mental health conditions
- Frame observations as possibilities, not facts
- Never shame, manipulate, or optimise for outrage/engagement
- Present decision options; never decide for the user
- Every notification must justify interrupting a human life
