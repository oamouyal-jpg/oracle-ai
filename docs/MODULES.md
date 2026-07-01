# Oracle Module Registry

Maps the Human Development OS vision ([VISION.md](./VISION.md)) to code today and the growth path forward.

**Status:** `live` = shipped · `partial` = exists but incomplete · `planned` = designed, not built

| Module | Status | Current implementation | Shared memory |
|--------|--------|------------------------|---------------|
| **Memory Engine** | partial | `AIMemory`, `UserPattern`, chat/journal history, operator learning context | ✓ |
| **Psychology Engine** | partial | Inner OS (`innerOsEngine`), state detection, emotional logs, friction patterns | ✓ |
| **Decision Engine** | partial | Clarity (`clarityEngine`), major decision log, Inner OS reflection | ✓ |
| **Planning Engine** | partial | Tasks, focus queue, week plan, missions, proactive nudges | ✓ |
| **Purpose Engine** | partial | Missions, domains, daily oracle, alignment engine | ✓ |
| **Reflection Engine** | partial | Journal, night debrief, alignment reflections, Inner OS check-ins | ✓ |
| **Vision Engine** | partial | Life map, daily briefing, dashboard, insights | ✓ |
| **Communication Engine** | partial | Agent actions queue, clarity advice chat | ✓ |
| **Ethics Engine** | partial | Inner OS safety rules, no-diagnosis policy, possibility framing | ✓ |
| **Knowledge Engine** | planned | Briefing is a seed; no trusted-source ingestion yet | — |
| **Learning Engine** | planned | — | — |
| **Relationship Engine** | planned | — | — |
| **Health Engine** | planned | Journal mood only | partial |
| **Finance Engine** | planned | — | — |
| **Creativity Engine** | planned | — | — |
| **Research Engine** | planned | Agent actions mock/partial | partial |

## Architecture rules (from VISION)

1. **One user model** — every module reads/writes through `User`, `AIMemory`, and operator learning context; never duplicate profile state.
2. **API-first** — new capabilities expose routes under `apps/api/src/routes/` and services under `apps/api/src/services/`.
3. **AI-native** — system prompts inherit from `apps/api/src/lib/oracleConstitution.ts`.
4. **Attention-safe** — no engagement hacks; notifications must justify interruption (see proactive engine).
5. **Extensible** — new modules register here before code lands; plug into shared memory, don't fork it.

## Smallest next steps toward Version 100

These grow the vision without architectural redesign:

1. **Semantic memory search** — extend `AIMemory` with embeddings; reconnect forgotten ideas proactively.
2. **Learning Engine v0** — track what the user knows vs. wants to learn; adaptive paths from journal + chat.
3. **Knowledge Engine v0** — curated briefing sources with bias/uncertainty labels (extend daily briefing).
4. **Knowledge graph v0** — link missions, clarity issues, journal entries, and memories in `life-map`.
