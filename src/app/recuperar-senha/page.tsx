"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function RecuperarSenhaPage() {
  const [mode, setMode] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao solicitar recuperação.");
      } else {
        setMessage(data.message);
      }
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao redefinir senha.");
      } else {
        setMessage(data.message);
      }
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] px-4 py-6">
      <div className="max-w-md w-full mx-auto">
        <Link
          href="/entrar"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Voltar ao login
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto my-8 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-6 sm:p-8 space-y-5">
        <BrandLogo href="/" />
        <div>
          <h1 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Recuperação de senha
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Solicite instruções ou insira o código temporário fornecido para definir uma nova senha.
          </p>
        </div>

        <div className="grid grid-cols-2 border border-[var(--border-default)] rounded-[6px] p-1 bg-[var(--bg-subtle)] text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("request");
              setError(null);
              setMessage(null);
            }}
            className={`h-8 rounded-[4px] font-medium cursor-pointer ${
              mode === "request"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            Solicitar código
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("confirm");
              setError(null);
              setMessage(null);
            }}
            className={`h-8 rounded-[4px] font-medium cursor-pointer ${
              mode === "confirm"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            Já tenho código
          </button>
        </div>

        {error ? (
          <div className="p-3 rounded-[6px] bg-[var(--status-danger-bg)] text-[var(--status-danger)] text-xs">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="p-3 rounded-[6px] bg-[var(--status-info-bg)] text-[var(--status-info)] text-xs">
            {message}
          </div>
        ) : null}

        {mode === "request" ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <Field label="E-mail cadastrado">
              <Input
                type="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" className="w-full" disabled={loading}>
              <KeyRound className="h-4 w-4" strokeWidth={1.5} />
              {loading ? "Verificando..." : "Solicitar recuperação"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <Field label="Código / token de redefinição">
              <Input
                type="text"
                placeholder="Cole o token recebido"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </Field>
            <Field label="Nova senha">
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres (letras e números)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Atualizar senha"}
            </Button>
          </form>
        )}
      </div>

      <div className="text-center">
        <PconSignature />
      </div>
    </div>
  );
}
