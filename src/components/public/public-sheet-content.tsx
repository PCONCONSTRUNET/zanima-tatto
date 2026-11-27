"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Lock, MoreVertical, PlusSquare, Share, UserPlus } from "lucide-react";
import { Field, Input } from "@/components/ui/primitives";
import { useTheme } from "@/components/theme-provider";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const subscribeNoop = () => () => {};
const getDetectedPlatform = (): "ios" | "android" =>
  typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("android")
    ? "android"
    : "ios";
const getServerPlatform = (): "ios" | "android" => "ios";

export function SignupForm({
  onSwitchToLogin,
  onSuccess,
}: {
  onSwitchToLogin?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          whatsapp: phone,
          phone,
          email,
          password,
          lgpdConsent: true,
          marketingOptIn: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar a conta.");
        setLoading(false);
        return;
      }
      try {
        sessionStorage.setItem("zanima-prompt-push", "1");
      } catch {}
      onSuccess?.();
      router.push(data.redirectTo || "/minha-conta");
      router.refresh();
    } catch {
      setError("Falha de conexão ao criar conta.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? (
        <div className="p-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
          {error}
        </div>
      ) : null}

      <Field label="Nome completo">
        <Input
          type="text"
          autoComplete="name"
          placeholder="Seu nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <Field label="Telefone">
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(00) 90000-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <Field label="E-mail">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <Field label="Senha">
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Mín. 8 caracteres (letras e números)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 h-11 w-full rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" strokeWidth={1.75} />
        {loading ? "Criando..." : "Criar conta"}
      </button>

      <p className="text-[11px] leading-relaxed text-center text-[var(--text-secondary)]">
        Ao criar conta, você concorda com os{" "}
        <Link href="/termos" className="underline text-[var(--text-primary)]">
          Termos
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline text-[var(--text-primary)]">
          Privacidade
        </Link>
        .
      </p>

      <p className="text-xs text-center text-[var(--text-secondary)] pt-0.5">
        Já tem conta?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
          >
            Entrar
          </button>
        ) : (
          <Link href="/entrar" className="font-semibold text-[var(--text-primary)] hover:underline">
            Entrar
          </Link>
        )}
      </p>
    </form>
  );
}

export function LoginForm({
  nextUrl = "",
  adminMode = false,
  onSwitchToSignup,
  onSuccess,
}: {
  nextUrl?: string;
  adminMode?: boolean;
  onSwitchToSignup?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: nextUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível entrar.");
        setLoading(false);
        return;
      }
      if (data.user?.themePreference) {
        setTheme(data.user.themePreference === "DARK" ? "dark" : "light", false);
      }
      try {
        sessionStorage.setItem("zanima-prompt-push", "1");
      } catch {}
      onSuccess?.();
      router.push(data.redirectTo || "/");
      router.refresh();
    } catch {
      setError("Falha de conexão ao autenticar.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {error ? (
        <div className="p-2.5 rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
          {error}
        </div>
      ) : null}

      <Field label="E-mail">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <Field label="Senha">
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      {adminMode ? null : (
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/recuperar-senha"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2"
          >
            Esqueci minha senha
          </Link>
          {onSwitchToSignup ? (
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="font-medium text-[var(--text-primary)] hover:underline underline-offset-2 cursor-pointer"
            >
              Criar conta
            </button>
          ) : (
            <Link
              href="/cadastro"
              className="font-medium text-[var(--text-primary)] hover:underline underline-offset-2"
            >
              Criar conta
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
      >
        <Lock className="h-4 w-4" strokeWidth={1.75} />
        {loading
          ? "Entrando..."
          : adminMode
            ? "Entrar no painel"
            : "Entrar na plataforma"}
      </button>
    </form>
  );
}

export function InstallGuideContent({
  onActionSignup,
  onActionLogin,
}: {
  onActionSignup?: () => void;
  onActionLogin?: () => void;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const detectedPlatform = useSyncExternalStore(
    subscribeNoop,
    getDetectedPlatform,
    getServerPlatform
  );
  const [selectedPlatform, setSelectedPlatform] = useState<"ios" | "android" | null>(null);
  const platform = selectedPlatform ?? detectedPlatform;

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleDirectInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-3.5">
      {installed ? (
        <div className="p-3 rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success)] text-xs text-center font-medium">
          Aplicativo instalado! Procure o ícone ZANIMA na sua tela inicial.
        </div>
      ) : deferredPrompt ? (
        <button
          type="button"
          onClick={handleDirectInstall}
          className="h-11 w-full rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Instalar aplicativo agora
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-default)]">
        <button
          type="button"
          onClick={() => setSelectedPlatform("ios")}
          className={`h-9 rounded-full text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer ${
            platform === "ios"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          iPhone (iOS)
        </button>
        <button
          type="button"
          onClick={() => setSelectedPlatform("android")}
          className={`h-9 rounded-full text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer ${
            platform === "android"
              ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Android
        </button>
      </div>

      {platform === "ios" ? (
        <ol className="space-y-2 text-xs">
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
            <span className="h-6 w-6 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="space-y-0.5 pt-0.5">
              <p className="font-semibold text-[var(--text-primary)]">Abra no Safari</p>
              <p className="text-[var(--text-secondary)]">
                Toque no botão{" "}
                <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                  <Share className="h-3 w-3" /> Compartilhar
                </span>{" "}
                na barra inferior.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
            <span className="h-6 w-6 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold flex items-center justify-center shrink-0">
              2
            </span>
            <div className="space-y-0.5 pt-0.5">
              <p className="font-semibold text-[var(--text-primary)]">Adicionar à Tela de Início</p>
              <p className="text-[var(--text-secondary)]">
                Role para baixo e toque em{" "}
                <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                  <PlusSquare className="h-3 w-3" /> Adicionar à Tela de Início
                </span>
                .
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
            <span className="h-6 w-6 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold flex items-center justify-center shrink-0">
              3
            </span>
            <div className="space-y-0.5 pt-0.5">
              <p className="font-semibold text-[var(--text-primary)]">Confirme em Adicionar</p>
              <p className="text-[var(--text-secondary)]">
                Pronto! O app ZANIMA aparecerá junto aos seus aplicativos.
              </p>
            </div>
          </li>
        </ol>
      ) : (
        <ol className="space-y-2 text-xs">
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
            <span className="h-6 w-6 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="space-y-0.5 pt-0.5">
              <p className="font-semibold text-[var(--text-primary)]">Abra o menu do Chrome</p>
              <p className="text-[var(--text-secondary)]">
                Toque nos{" "}
                <span className="inline-flex items-center gap-0.5 font-medium text-[var(--text-primary)]">
                  <MoreVertical className="h-3 w-3" /> 3 pontinhos
                </span>{" "}
                no canto superior direito.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
            <span className="h-6 w-6 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold flex items-center justify-center shrink-0">
              2
            </span>
            <div className="space-y-0.5 pt-0.5">
              <p className="font-semibold text-[var(--text-primary)]">Instalar aplicativo</p>
              <p className="text-[var(--text-secondary)]">
                Selecione <strong className="text-[var(--text-primary)]">Instalar aplicativo</strong> ou{" "}
                <strong className="text-[var(--text-primary)]">Adicionar à tela inicial</strong>.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-default)]">
            <span className="h-6 w-6 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold flex items-center justify-center shrink-0">
              3
            </span>
            <div className="space-y-0.5 pt-0.5">
              <p className="font-semibold text-[var(--text-primary)]">Toque em Instalar</p>
              <p className="text-[var(--text-secondary)]">
                O ícone ZANIMA será criado automaticamente na sua tela inicial.
              </p>
            </div>
          </li>
        </ol>
      )}

      <div className="pt-1 flex gap-2">
        {onActionSignup ? (
          <button
            type="button"
            onClick={onActionSignup}
            className="h-11 flex-1 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold inline-flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer"
          >
            Criar Conta
          </button>
        ) : (
          <Link
            href="/cadastro"
            className="h-11 flex-1 rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold inline-flex items-center justify-center transition-all active:scale-[0.98]"
          >
            Criar Conta
          </Link>
        )}

        {onActionLogin ? (
          <button
            type="button"
            onClick={onActionLogin}
            className="h-11 flex-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] inline-flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer"
          >
            Entrar
          </button>
        ) : (
          <Link
            href="/entrar"
            className="h-11 flex-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] inline-flex items-center justify-center transition-all active:scale-[0.98]"
          >
            Entrar
          </Link>
        )}
      </div>
    </div>
  );
}
