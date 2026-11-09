import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ApiRequestError, api } from "@/lib/api";
import { useT } from "@/i18n";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import type { AuthResponse } from "@stratum/shared";
import { useAuthStore } from "@/store/auth";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const t = useT();
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@fathom.dev");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await api<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password }, auth: false });
      setSession(auth);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">{t("signIn")}</h1>
      <p className="mt-1 text-sm text-muted">{t("signInHint")}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input label={t("email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label={t("password")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          {t("signIn")}
        </Button>
      </form>
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t("demoAccounts")}</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword(a.password);
              }}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium hover:border-accent"
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-subtle">{t("passwordHint")}</p>
      </div>
      <p className="mt-6 text-sm text-muted">
        {t("noAccount")}{" "}
        <Link to="/register" className="font-medium text-accent hover:underline">
          {t("createOne")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  return (
    <div className="relative min-h-svh overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_50%),radial-gradient(ellipse_at_bottom_right,#14b8a61f,transparent_45%)]" />
      <div className="absolute right-6 top-6 z-10 flex rounded-xl border border-border p-0.5 text-[11px] font-semibold">
        <button type="button" className={cn("rounded-lg px-1.5 py-1", locale === "en" ? "bg-surface-2 text-fg" : "text-muted")} onClick={() => setLocale("en")}>
          {t("langEn")}
        </button>
        <button type="button" className={cn("rounded-lg px-1.5 py-1", locale === "tr" ? "bg-surface-2 text-fg" : "text-muted")} onClick={() => setLocale("tr")}>
          {t("langTr")}
        </button>
      </div>
      <div className="relative mx-auto grid min-h-svh max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-fg">F</span>
            <span className="text-xl font-semibold tracking-tight">{t("brand")}</span>
          </div>
          <h2 className="mt-8 max-w-md text-4xl font-semibold leading-tight tracking-tight">{t("heroTitle")}</h2>
          <p className="mt-4 max-w-md text-muted">{t("heroBody")}</p>
          <ul className="mt-6 space-y-2 text-sm text-muted">
            <li>— {t("hero1")}</li>
            <li>— {t("hero2")}</li>
            <li>— {t("hero3")}</li>
          </ul>
        </div>
        <div className="card mx-auto w-full max-w-md p-8">{children}</div>
      </div>
    </div>
  );
}
