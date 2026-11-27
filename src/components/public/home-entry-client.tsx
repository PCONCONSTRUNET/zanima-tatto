"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { InstallAppButton } from "@/components/public/install-app-button";

interface HomeEntryProps {
  studioName: string;
  ownerName: string;
  igHandle: string;
  igSlug: string;
  waRaw: string;
  waClean: string;
  isOpenToday: boolean;
  todayHours: string;
  userName: string | null;
  isAdmin: boolean;
  destinationHref: string;
}

export function HomeEntryClient({
  studioName,
  ownerName,
  igHandle,
  igSlug,
  waRaw,
  waClean,
  isOpenToday,
  todayHours,
  userName,
  isAdmin,
  destinationHref,
}: HomeEntryProps) {
  const [darkEntry, setDarkEntry] = useState(true);

  return (
    <div
      className={`min-h-screen flex flex-col justify-between px-4 py-5 sm:py-6 transition-colors duration-150 ${
        darkEntry
          ? "bg-[#101114] text-[#F4F4F5]"
          : "bg-[#F7F8FA] text-[#18181B]"
      }`}
    >
      {/* Barra superior discreta */}
      <header className="w-full max-w-md mx-auto flex items-center justify-end gap-2">
        <div
          className={
            darkEntry
              ? "[&_button]:bg-[#18191D] [&_button]:border-[#2B2D33] [&_button]:text-[#F4F4F5] [&_button:hover]:bg-[#22242A]"
              : ""
          }
        >
          <InstallAppButton />
        </div>
        <button
          type="button"
          onClick={() => setDarkEntry((v) => !v)}
          aria-label="Alternar fundo claro ou escuro"
          title="Alternar fundo"
          className={`h-9 w-9 inline-flex items-center justify-center rounded-[6px] border cursor-pointer transition-colors ${
            darkEntry
              ? "bg-[#18191D] border-[#2B2D33] text-[#A1A1AA] hover:text-[#F4F4F5]"
              : "bg-[#FFFFFF] border-[#E4E4E7] text-[#71717A] hover:text-[#18181B]"
          }`}
        >
          {darkEntry ? (
            <Sun className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </header>

      {/* Bloco central limpo e formal */}
      <main className="w-full max-w-sm mx-auto my-auto py-8 flex flex-col items-center text-center space-y-6">
        <div className="flex justify-center">
          <Image
            src="/brand/zanima-logo.png"
            alt="Logotipo ZANIMA TATTOO"
            width={320}
            height={269}
            className="w-56 sm:w-64 h-auto object-contain"
            priority
          />
        </div>

        {/* Contatos diretos e status discreto */}
        <div className="space-y-2">
          <div
            className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs ${
              darkEntry ? "text-[#A1A1AA]" : "text-[#71717A]"
            }`}
          >
            <a
              href={`https://instagram.com/${igSlug}`}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 transition-colors ${
                darkEntry ? "hover:text-[#F4F4F5]" : "hover:text-[#18181B]"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
              <span>{igHandle}</span>
            </a>

            {waClean ? (
              <a
                href={`https://wa.me/${waClean}`}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 transition-colors ${
                  darkEntry ? "hover:text-[#F4F4F5]" : "hover:text-[#18181B]"
                }`}
              >
                <WhatsAppIcon size={15} />
                <span>{waRaw}</span>
              </a>
            ) : null}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
              darkEntry ? "text-[#A1A1AA]" : "text-[#71717A]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-[2px] ${
                isOpenToday
                  ? darkEntry
                    ? "bg-[#34D399]"
                    : "bg-[#1F7A52]"
                  : "bg-[#C9B18F]"
              }`}
            />
            <span>{todayHours}</span>
          </div>
        </div>

        {/* Título e subtítulo formal */}
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {studioName}
          </h1>
          <p
            className={`text-xs max-w-xs mx-auto leading-relaxed ${
              darkEntry ? "text-[#A1A1AA]" : "text-[#71717A]"
            }`}
          >
            Fine Line, Floral e Minimalista por {ownerName}. Crie sua conta ou entre para agendar e acompanhar seu projeto.
          </p>
        </div>

        {/* Botões claros em fundo escuro para harmonizar com o logotipo */}
        {userName ? (
          <div className="w-full space-y-2.5 pt-1">
            <Link
              href={destinationHref}
              className={`w-full h-11 px-5 inline-flex items-center justify-center gap-2 rounded-[6px] text-sm font-medium transition-colors ${
                darkEntry
                  ? "bg-[#FFFFFF] text-[#101114] hover:bg-[#EAE6DF]"
                  : "bg-[#27272A] text-[#FFFFFF] hover:bg-[#18181B]"
              }`}
            >
              <span>
                {isAdmin
                  ? "Acessar Painel Administrativo"
                  : "Acessar Minha Conta"}
              </span>
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <p
              className={`text-xs ${
                darkEntry ? "text-[#A1A1AA]" : "text-[#71717A]"
              }`}
            >
              Conectado como {userName}
            </p>
          </div>
        ) : (
          <div className="w-full space-y-2.5 pt-1">
            <Link
              href="/cadastro"
              className={`w-full h-11 px-5 inline-flex items-center justify-center rounded-[6px] text-sm font-medium transition-colors ${
                darkEntry
                  ? "bg-[#FFFFFF] text-[#101114] hover:bg-[#F4F4F5]"
                  : "bg-[#27272A] text-[#FFFFFF] hover:bg-[#18181B]"
              }`}
            >
              Criar Conta
            </Link>
            <Link
              href="/entrar"
              className={`w-full h-11 px-5 inline-flex items-center justify-center rounded-[6px] text-sm font-medium transition-colors ${
                darkEntry
                  ? "bg-[#EAE4DA] text-[#18181B] hover:bg-[#F4F0E8]"
                  : "border border-[#E4E4E7] bg-[#FFFFFF] text-[#18181B] hover:bg-[#F1F2F5]"
              }`}
            >
              Já tenho conta
            </Link>
          </div>
        )}
      </main>

      {/* Rodapé formal e discreto */}
      <footer
        className={`w-full max-w-md mx-auto pt-5 border-t flex flex-col items-center gap-2 text-center ${
          darkEntry ? "border-[#2B2D33]" : "border-[#E4E4E7]"
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-center gap-4 text-xs ${
            darkEntry ? "text-[#A1A1AA]" : "text-[#71717A]"
          }`}
        >
          <Link
            href="/termos"
            className={`underline-offset-4 hover:underline ${
              darkEntry ? "hover:text-[#F4F4F5]" : "hover:text-[#18181B]"
            }`}
          >
            Termos de Uso
          </Link>
          <span aria-hidden="true">•</span>
          <Link
            href="/privacidade"
            className={`underline-offset-4 hover:underline ${
              darkEntry ? "hover:text-[#F4F4F5]" : "hover:text-[#18181B]"
            }`}
          >
            Política de Privacidade
          </Link>
        </div>
        <p
          className={`text-[11px] tracking-[0.06em] uppercase ${
            darkEntry ? "text-[#A1A1AA]" : "text-[#71717A]"
          }`}
        >
          DESENVOLVIDO POR{" "}
          <a
            href="https://www.instagram.com/pconconstrunet/"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-semibold hover:underline underline-offset-4 ${
              darkEntry ? "text-[#F4F4F5]" : "text-[#18181B]"
            }`}
          >
            P-CON CONSTRUNET LTDA
          </a>
        </p>
      </footer>
    </div>
  );
}
