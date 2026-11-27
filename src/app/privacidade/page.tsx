import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { PublicThemeButton } from "@/components/public/public-theme-button";

export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const settings = await prisma.studioSetting.findUnique({
    where: { id: "studio-default" },
    select: { studioName: true, ownerName: true, email: true, instagramHandle: true },
  });

  const studioName = settings?.studioName || "ZANIMA TATTOO";
  const ownerName = settings?.ownerName || "Leticia Zanini Macalossi";

  const sections = [
    {
      title: "1. Controlador dos Dados",
      body: `O tratamento dos dados pessoais coletados nesta plataforma é realizado pelo estúdio ${studioName}, sob administração de ${ownerName}, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).`,
    },
    {
      title: "2. Dados Pessoais e Sensíveis Tratados",
      body: "Coletamos dados cadastrais e de contato (nome completo, telefone/WhatsApp, e-mail, data de nascimento), referências visuais enviadas para orçamento, histórico de sessões, registros financeiros vinculados ao cliente e dados sensíveis de saúde informados em fichas de anamnese pré-procedimento ou acompanhamento pós-tatuagem.",
    },
    {
      title: "3. Finalidade e Base Legal",
      body: "Os dados são utilizados exclusivamente para: (a) execução de agendamentos, orçamentos e atendimento artístico; (b) avaliação de segurança sanitária e prevenção de intercorrências; (c) guarda de termos assinados e obrigações legais/fiscais; e (d) envio de novidades e disponibilidade apenas quando o cliente optar expressamente (opt-in).",
    },
    {
      title: "4. Sigilo do Prontuário, Fotos Privadas e Autorização de Imagem",
      body: "Fotografias privadas, fichas de saúde e documentos assinados ficam armazenados em área privada autenticada, inacessível a terceiros e outros clientes, e nunca são armazenados em cache offline pelo aplicativo. A autorização de uso de imagem em portfólio é totalmente separada do termo de procedimento e pode ser revogada a qualquer momento.",
    },
    {
      title: "5. Segurança, Auditoria e Retenção",
      body: "Utilizamos criptografia em trânsito (HTTPS), senhas armazenadas com hash criptográfico seguro (scrypt), controle de acesso por função e registros de auditoria para alterações críticas. Os dados são mantidos pelo tempo necessário ao atendimento e ao cumprimento de prazos legais e sanitários.",
    },
    {
      title: "6. Seus Direitos como Titular (LGPD)",
      body: `Na Área Exclusiva do Cliente (/minha-conta/perfil), você pode consultar seus dados, alterar preferências de comunicação, exportar uma cópia estruturada das suas informações pessoais em formato JSON ou solicitar a anonimização/exclusão do cadastro. Contato do estúdio: ${settings?.email || settings?.instagramHandle || "@zanima_tattoo"}.`,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-6">
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Voltar ao início
        </Link>
        <div className="flex items-center gap-2.5">
          <BrandLogo href="/" compact />
          <PublicThemeButton />
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto my-8 space-y-6">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--brand-champagne)] font-semibold">
            {studioName} • Conformidade LGPD
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Transparência sobre como protegemos suas informações pessoais, fichas e imagens.
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
          {sections.map((sec) => (
            <section key={sec.title} className="p-5 sm:p-6 space-y-2">
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                {sec.title}
              </h2>
              <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
                {sec.body}
              </p>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Link
            href="/termos"
            className="h-10 px-5 inline-flex items-center justify-center rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold hover:bg-[var(--action-primary-hover)] transition-colors"
          >
            Ler Termos de Uso
          </Link>
          <Link
            href="/cadastro"
            className="h-10 px-5 inline-flex items-center justify-center rounded-full bg-[#EFEAE2] text-[#18181B] text-xs font-medium hover:bg-[#E5DEC9] transition-colors"
          >
            Criar Conta
          </Link>
        </div>
      </main>

      <footer className="max-w-3xl w-full mx-auto pt-5 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-3">
          <Link href="/termos" className="hover:text-[var(--text-primary)] underline">
            Termos de Uso
          </Link>
          <span>•</span>
          <Link href="/privacidade" className="text-[var(--text-primary)] font-medium">
            Política de Privacidade
          </Link>
        </div>
        <PconSignature />
      </footer>
    </div>
  );
}
