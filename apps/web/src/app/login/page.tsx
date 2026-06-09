"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/lib/AuthProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function LoginPage() {
  const { t } = useLocale();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      router.replace(user.onboardingComplete ? "/" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2 text-indigo-400 mb-8">
        <Sparkles className="h-6 w-6" />
        <span className="text-sm uppercase tracking-[0.3em]">Oracle</span>
      </div>
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="text-2xl font-light text-zinc-50 mb-1">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-zinc-500 mb-8">{t("auth.loginSubtitle")}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest">
              {t("auth.email")}
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl glass px-4 py-3 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest">
              {t("auth.password")}
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl glass px-4 py-3 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/40 transition disabled:opacity-50"
          >
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>
        <p className="text-sm text-zinc-500 mt-6 text-center">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">
            {t("auth.createAccount")}
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
