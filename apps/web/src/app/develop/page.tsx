"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Sparkles, RefreshCw } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  api,
  type DevelopHub,
  type KnowledgeGraph,
} from "@/lib/api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Tab =
  | "profile"
  | "knowledge"
  | "learning"
  | "relationships"
  | "health"
  | "finance"
  | "creativity"
  | "research"
  | "graph";

const TABS: Tab[] = [
  "profile",
  "knowledge",
  "learning",
  "relationships",
  "health",
  "finance",
  "creativity",
  "research",
  "graph",
];

const NODE_COLORS: Record<string, string> = {
  MISSION: "bg-indigo-500/30 text-indigo-200",
  CLARITY: "bg-violet-500/30 text-violet-200",
  MEMORY: "bg-amber-500/20 text-amber-200",
  JOURNAL: "bg-emerald-500/20 text-emerald-200",
  PERSON: "bg-rose-500/20 text-rose-200",
  IDEA: "bg-cyan-500/20 text-cyan-200",
  LEARNING: "bg-teal-500/20 text-teal-200",
};

export default function DevelopPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("profile");
  const [hub, setHub] = useState<DevelopHub | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const h = await api.developHub();
      setHub(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    setBusy(true);
    try {
      const res = await api.developSeed();
      setHub(res.hub);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  };

  const loadGraph = async () => {
    setBusy(true);
    try {
      setGraph(await api.developGraph());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (tab === "graph" && !graph) loadGraph();
  }, [tab, graph]);

  if (!hub && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        {t("common.loading")}
      </div>
    );
  }

  const p = hub?.profile;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-indigo-300/80">
            <Brain className="h-3.5 w-3.5" />
            {t("develop.badge")}
          </div>
          <h1 className="mt-1 text-2xl font-light text-zinc-50 glow-text md:text-3xl">
            {t("develop.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">{t("develop.subtitle")}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={seed}
          className="flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {t("develop.initialize")}
        </button>
      </header>

      {error ? (
        <GlassCard className="border-amber-500/30 text-amber-200/90">{error}</GlassCard>
      ) : null}

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${
              tab === key
                ? "bg-indigo-500/25 text-indigo-100 border border-indigo-400/40"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            {t(`develop.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "profile" && p ? (
        <GlassCard glow>
          <p className="text-sm leading-relaxed text-zinc-200">{p.summary}</p>

          {p.knowledgePulse ? (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">{t("develop.knowledgePulseTitle")}</p>
              <p className="mt-1 font-medium text-zinc-100">{p.knowledgePulse.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{p.knowledgePulse.summary}</p>
            </div>
          ) : null}

          {p.worldviewNote ? (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("develop.worldviewTitle")}</p>
              <p className="mt-1 text-sm text-indigo-200/90">{p.worldviewNote}</p>
            </div>
          ) : null}

          {p.blindSpots.length > 0 ? (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-amber-300/80">{t("develop.blindSpotsTitle")}</p>
              <ul className="mt-2 space-y-1">
                {p.blindSpots.map((b) => (
                  <li key={b} className="text-xs text-amber-200/90">
                    · {b}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {p.learningOpportunity ? (
            <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="text-[10px] uppercase tracking-wide text-indigo-300/80">{t("develop.learningNextTitle")}</p>
              <p className="mt-1 text-sm text-zinc-200">{p.learningOpportunity.topic}</p>
              <p className="mt-1 text-xs text-zinc-400">{p.learningOpportunity.nextStep}</p>
            </div>
          ) : null}

          {p.assessedAt ? (
            <p className="mt-4 text-[10px] text-zinc-600">
              {t("develop.autoAssessed")}: {new Date(p.assessedAt).toLocaleString()}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api.developAssess();
                setHub(res.hub);
              } finally {
                setBusy(false);
              }
            }}
            className="mt-3 text-xs text-indigo-300 hover:text-indigo-100 disabled:opacity-50"
          >
            {t("develop.reassess")}
          </button>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(p.moduleCounts).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-black/20 px-3 py-2 text-center">
                <p className="text-lg font-light text-zinc-100">{v}</p>
                <p className="text-[10px] uppercase text-zinc-500">{k}</p>
              </div>
            ))}
          </div>
          {p.patterns.length > 0 ? (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("develop.patterns")}</p>
              <ul className="mt-2 space-y-2">
                {p.patterns.map((pat) => (
                  <li key={pat.name} className="text-sm text-zinc-300">
                    <span className="text-indigo-300">{pat.name}</span>
                    {pat.description ? ` — ${pat.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </GlassCard>
      ) : null}

      {tab === "knowledge" && hub ? (
        <KnowledgePanel
          items={hub.knowledge}
          interests={hub.knowledgeInterests}
          onSaveInterests={async (interests) => {
            await api.saveKnowledgeInterests(interests);
            await load();
          }}
          onGenerate={async (focus) => {
            setBusy(true);
            try {
              await api.generateKnowledge(focus);
              await load();
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      ) : null}

      {tab === "learning" && hub ? (
        <ModulePanel
          title={t("develop.tabs.learning")}
          onGenerate={async () => {
            await api.generateLearning();
            await load();
          }}
          busy={busy}
          empty={hub.learning.length === 0}
          emptyHint={t("develop.emptyHint")}
        >
          {hub.learning.map((l) => (
            <div key={l.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
              <div className="flex justify-between gap-2">
                <p className="font-medium text-zinc-100">{l.topic}</p>
                <span className="text-xs text-indigo-300">{l.proficiency}%</span>
              </div>
              {l.nextStep ? <p className="mt-1 text-sm text-zinc-400">{l.nextStep}</p> : null}
              {l.readyToLearn ? (
                <span className="mt-2 inline-block text-[10px] uppercase text-emerald-400">
                  {t("develop.readyToLearn")}
                </span>
              ) : null}
            </div>
          ))}
        </ModulePanel>
      ) : null}

      {tab === "relationships" && hub ? (
        <CrudPanel title={t("develop.tabs.relationships")} onSubmit={async (name) => {
          await api.addRelationship({ name });
          await load();
        }}>
          {hub.relationships.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <p className="font-medium text-zinc-100">{r.name}</p>
              {r.role ? <p className="text-xs text-zinc-500">{r.role}</p> : null}
            </div>
          ))}
        </CrudPanel>
      ) : null}

      {tab === "health" && hub ? (
        <CrudPanel
          title={t("develop.tabs.health")}
          placeholder={t("develop.healthNote")}
          onSubmit={async (note) => {
            await api.addHealthLog({ kind: "MOOD", value: 5, note });
            await load();
          }}
        >
          {hub.health.map((h) => (
            <div key={h.id} className="text-sm text-zinc-300">
              {h.kind} {h.value != null ? `· ${h.value}` : ""} {h.note ? `— ${h.note}` : ""}
            </div>
          ))}
        </CrudPanel>
      ) : null}

      {tab === "finance" && hub ? (
        <CrudPanel title={t("develop.tabs.finance")} onSubmit={async (title) => {
          await api.addFinanceGoal({ title });
          await load();
        }}>
          {hub.finance.map((f) => (
            <div key={f.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <p className="font-medium text-zinc-100">{f.title}</p>
              {f.targetAmount != null ? (
                <p className="text-xs text-zinc-500">
                  {f.currentAmount ?? 0} / {f.targetAmount}
                </p>
              ) : null}
            </div>
          ))}
        </CrudPanel>
      ) : null}

      {tab === "creativity" && hub ? (
        <CrudPanel title={t("develop.tabs.creativity")} onSubmit={async (title) => {
          await api.addCreativeIdea({ title });
          await load();
        }}>
          {hub.creativity.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <p className="font-medium text-zinc-100">{c.title}</p>
              {c.description ? <p className="text-sm text-zinc-500">{c.description}</p> : null}
            </div>
          ))}
        </CrudPanel>
      ) : null}

      {tab === "research" && hub ? (
        <ResearchPanel
          items={hub.research}
          onRun={async (q) => {
            await api.runResearch(q);
            await load();
          }}
        />
      ) : null}

      {tab === "graph" ? (
        <GlassCard>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-zinc-300">{t("develop.graphDesc")}</p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setGraph(await api.developGraphRebuild());
                setBusy(false);
              }}
              className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-100"
            >
              <RefreshCw className="h-3 w-3" />
              {t("develop.rebuildGraph")}
            </button>
          </div>
          {graph ? (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-zinc-500">
                {graph.nodes.length} nodes · {graph.edges.length} connections
              </p>
              <div className="flex flex-wrap gap-2">
                {graph.nodes.map((n) => (
                  <span
                    key={n.id}
                    className={`rounded-full px-2.5 py-1 text-[10px] ${NODE_COLORS[n.kind] ?? "bg-white/10 text-zinc-300"}`}
                    title={n.kind}
                  >
                    {n.label.slice(0, 48)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </GlassCard>
      ) : null}
    </div>
  );
}

function ModulePanel({
  title,
  children,
  onGenerate,
  busy,
  empty,
  emptyHint,
}: {
  title: string;
  children: React.ReactNode;
  onGenerate: () => Promise<void>;
  busy: boolean;
  empty: boolean;
  emptyHint: string;
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => onGenerate()}
          className="text-xs text-indigo-300 hover:text-indigo-100 disabled:opacity-50"
        >
          {t("develop.generate")}
        </button>
      </div>
      {empty ? <p className="text-sm text-zinc-500">{emptyHint}</p> : null}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CrudPanel({
  title,
  children,
  onSubmit,
  placeholder,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (value: string) => Promise<void>;
  placeholder?: string;
}) {
  const { t } = useLocale();
  const [val, setVal] = useState("");
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!val.trim()) return;
          await onSubmit(val.trim());
          setVal("");
        }}
      >
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder ?? t("develop.addPlaceholder")}
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-500/25 px-4 py-2 text-sm text-indigo-100 border border-indigo-400/30"
        >
          {t("develop.add")}
        </button>
      </form>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KnowledgePanel({
  items,
  interests,
  onSaveInterests,
  onGenerate,
  busy,
}: {
  items: { id: string; title: string; summary: string; uncertainty: string | null }[];
  interests: string[];
  onSaveInterests: (interests: string[]) => Promise<void>;
  onGenerate: (focus?: string) => Promise<void>;
  busy: boolean;
}) {
  const { t } = useLocale();
  const [interestInput, setInterestInput] = useState("");
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);

  const addInterest = async () => {
    const next = interestInput.trim();
    if (!next || interests.includes(next)) return;
    setSaving(true);
    await onSaveInterests([...interests, next]);
    setInterestInput("");
    setSaving(false);
  };

  const removeInterest = async (topic: string) => {
    setSaving(true);
    await onSaveInterests(interests.filter((i) => i !== topic));
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">{t("develop.tabs.knowledge")}</h2>
        <p className="mt-1 text-xs text-zinc-500">{t("develop.knowledgeDesc")}</p>
      </div>

      <GlassCard>
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("develop.knowledgeInterestsLabel")}</p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await addInterest();
          }}
        >
          <input
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            placeholder={t("develop.knowledgeInterestsPlaceholder")}
            className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"
          />
          <button
            type="submit"
            disabled={saving || !interestInput.trim()}
            className="rounded-lg bg-indigo-500/25 px-4 py-2 text-sm text-indigo-100 border border-indigo-400/30 disabled:opacity-50"
          >
            {t("develop.add")}
          </button>
        </form>
        {interests.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {interests.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-100"
              >
                {topic}
                <button
                  type="button"
                  onClick={() => removeInterest(topic)}
                  className="text-indigo-300/70 hover:text-indigo-100"
                  aria-label={t("develop.removeInterest")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">{t("develop.emptyHint")}</p>
        )}
      </GlassCard>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await onGenerate(focus.trim() || undefined);
          setFocus("");
        }}
      >
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={t("develop.knowledgeFocusPlaceholder")}
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-indigo-500/25 px-4 py-2 text-sm text-indigo-100 border border-indigo-400/30 disabled:opacity-50"
        >
          {focus.trim() ? t("develop.knowledgeFocusRun") : t("develop.generate")}
        </button>
      </form>

      <div className="space-y-2">
        {items.map((k) => (
          <div key={k.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
            <p className="font-medium text-zinc-100">{k.title}</p>
            <p className="mt-1 text-sm text-zinc-400">{k.summary}</p>
            {k.uncertainty ? (
              <p className="mt-2 text-xs text-amber-200/80">⚠ {k.uncertainty}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchPanel({
  items,
  onRun,
}: {
  items: { id: string; query: string; synthesis: string | null }[];
  onRun: (q: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-200">{t("develop.tabs.research")}</h2>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!q.trim()) return;
          setBusy(true);
          await onRun(q.trim());
          setQ("");
          setBusy(false);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("develop.researchPlaceholder")}
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-500/25 px-4 py-2 text-sm text-indigo-100 border border-indigo-400/30 disabled:opacity-50"
        >
          {t("develop.researchRun")}
        </button>
      </form>
      {items.map((r) => (
        <GlassCard key={r.id}>
          <p className="text-xs uppercase text-zinc-500">{r.query}</p>
          <p className="mt-2 text-sm text-zinc-300">{r.synthesis ?? "…"}</p>
        </GlassCard>
      ))}
    </div>
  );
}
