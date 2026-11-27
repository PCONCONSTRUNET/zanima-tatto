import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BrandLogo, PconSignature } from "@/components/brand-mark";
import { PublicThemeButton } from "@/components/public/public-theme-button";

export const dynamic = "force-dynamic";

export default async function TermosPage() {
  const settings = await prisma.studioSetting.findUnique({
    where: { id: "studio-default" },
    select: {
      studioName: true,
      ownerName: true,
      defaultDepositPercent: true,
      cancellationPolicyHours: true,
      instagramHandle: true,
      email: true,
    },
  });

  const studioName = settings?.studioName || "ZANIMA TATTOO";
  const ownerName = settings?.ownerName || "Leticia Zanini Macalossi";
  const depositPct = settings?.defaultDepositPercent ?? 30;
  const cancelHours = settings?.cancellationPolicyHours ?? 48;

  const sections = [
    {
      title: "1. Objeto e Aceitação",
      body: `Estes Termos de Uso regulam o acesso e a utilização da plataforma digital do estúdio ${studioName}, administrado por ${ownerName}, destinada ao envio de ideias e solicitações de orçamento, agendamento de sessões, assinatura eletrônica de documentos pré-procedimento, acompanhamento de projetos artísticos e consulta de registros pessoais na Área Exclusiva do Cliente.`,
    },
    {
      title: "2. Cadastro e Segurança da Conta",
      body: "O cliente compromete-se a fornecer dados cadastrais verdadeiros, atualizados e completos. O acesso é pessoal e intransferível, protegido por senha individual. Caso já possua prontuário presencial no estúdio, a vinculação à conta online ocorre somente após verificação de identidade pela administração ou validação de código emitido pelo estúdio.",
    },
    {
      title: "3. Orçamentos, Sinal de Reserva e Reagendamento",
      body: `As propostas de orçamento possuem prazo de validade informado individualmente e contemplam valor estimado, condições de pagamento e sinal de reserva (referência padrão de ${depositPct}% do projeto, salvo condição específica acordada). A reserva definitiva do horário na agenda ocorre mediante confirmação do estúdio e compensação do sinal. Solicitações de reagendamento devem ser comunicadas com antecedência mínima de ${cancelHours} horas para preservação do sinal em nova data acordada.`,
    },
    {
      title: "4. Documentos Pré-Procedimento e Consentimentos",
      body: "Antes da realização de cada procedimento, o cliente deverá preencher a Ficha de Anamnese e assinar eletronicamente o Termo de Consentimento Livre e Esclarecido correspondente. A omissão ou inexatidão de informações de saúde pode comprometer a segurança do procedimento e o resultado da cicatrização.",
    },
    {
      title: "5. Autorização Separada de Uso de Imagem",
      body: "A autorização para captação e divulgação de fotografias do trabalho artístico no portfólio oficial e redes sociais (@zanima_tattoo) é totalmente opcional e registrada em termo independente do consentimento para o procedimento. Nenhuma imagem é publicada sem autorização expressa e ativa do cliente.",
    },
    {
      title: "6. Acompanhamento Pós-Tatuagem",
      body: "O módulo de acompanhamento pós-tatuagem permite registrar a evolução visual da cicatrização, consultar orientações da tatuadora e solicitar avaliação ou retoque. Esta ferramenta não realiza diagnósticos médicos automatizados e não substitui atendimento profissional de saúde. Em caso de dor intensa, febre ou sinais atípicos, procure assistência médica imediatamente.",
    },
    {
      title: "7. Propriedade Intelectual",
      body: `Todos os desenhos autorais, estudos artísticos, composições Fine Line, Florais e Minimalistas elaborados por ${ownerName}, bem como a marca ${studioName}, são protegidos por direitos autorais. O envio de artes para aprovação não autoriza reprodução, tatuagem por terceiros ou uso comercial sem consentimento por escrito.`,
    },
    {
      title: "8. Disposições Gerais",
      body: `Estes termos podem ser atualizados para refletir melhorias operacionais, exigências sanitárias ou adequações legais. Dúvidas podem ser encaminhadas pelos canais oficiais do estúdio (${settings?.instagramHandle || "@zanima_tattoo"}${settings?.email ? ` • ${settings.email}` : ""}).`,
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
            {studioName} • Documentação Oficial
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            Termos de Uso e Condições de Atendimento
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Leia atentamente as regras de agendamento, sinal, documentação e uso da plataforma.
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
            href="/privacidade"
            className="h-10 px-5 inline-flex items-center justify-center rounded-full bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold hover:bg-[var(--action-primary-hover)] transition-colors"
          >
            Ler Política de Privacidade (LGPD)
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
          <Link href="/termos" className="text-[var(--text-primary)] font-medium">
            Termos de Uso
          </Link>
          <span>•</span>
          <Link href="/privacidade" className="hover:text-[var(--text-primary)] underline">
            Política de Privacidade
          </Link>
        </div>
        <PconSignature />
      </footer>
    </div>
  );
}
