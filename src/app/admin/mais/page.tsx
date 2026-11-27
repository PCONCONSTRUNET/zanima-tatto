import Link from "next/link";
import {
  Bell,
  BellRing,
  FolderKanban,
  Gift,
  Globe,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserCheck,
} from "lucide-react";

const CATEGORIES = [
  {
    title: "Atendimento e Arte",
    items: [
      {
        href: "/admin/servicos",
        label: "Serviços e Categorias",
        description: "Catálogo com duração, valor e múltiplas sessões",
        icon: Sparkles,
      },
      {
        href: "/admin/projetos",
        label: "Projetos de Tatuagem",
        description: "Linha do tempo artística, sessões, artes e cicatrização",
        icon: FolderKanban,
      },
      {
        href: "/admin/orcamentos",
        label: "Orçamentos Personalizados",
        description: "Solicitações, propostas em PDF e conversão em projeto",
        icon: Receipt,
      },
    ],
  },
  {
    title: "Operação e Controle",
    items: [
      {
        href: "/admin/pessoal",
        label: "Pessoal",
        description: "Gastos pessoais, cartões, entradas e metas da proprietária",
        icon: UserCheck,
      },
      {
        href: "/admin/estoque",
        label: "Controle de Estoque",
        description: "Agulhas, tintas, lotes, validade e custo por sessão",
        icon: Package,
      },
      {
        href: "/admin/lembretes",
        label: "Lembretes & Notas",
        description: "Notas personalizadas com cores e pastas, além de lembretes",
        icon: StickyNote,
      },
    ],
  },
  {
    title: "Relacionamento e Fidelização",
    items: [
      {
        href: "/admin/fidelizacao",
        label: "Fidelização e Desenhos",
        description: "Cupons, indicações, vale-presente, flashes e lista de espera",
        icon: Gift,
      },
      {
        href: "/admin/push",
        label: "Notificações Push",
        description: "Regras automáticas Admin/Cliente, OneSignal e disparo manual para todos",
        icon: BellRing,
      },
      {
        href: "/admin/notificacoes",
        label: "Central de Notificações",
        description: "Alertas internos e status das integrações de envio",
        icon: Bell,
      },
    ],
  },
  {
    title: "Portal e Administração",
    items: [
      {
        href: "/admin/configuracoes",
        label: "Configurações do Estúdio",
        description: "Dados, horários, sinal, conteúdo público, equipe e LGPD",
        icon: Settings,
      },
      {
        href: "/",
        label: "Ver Portal Público",
        description: "Visualizar o site público ZANIMA TATTOO",
        icon: Globe,
      },
      {
        href: "/admin/configuracoes#lgpd",
        label: "Auditoria e LGPD",
        description: "Registros de segurança, backups e privacidade",
        icon: ShieldCheck,
      },
    ],
  },
];

export default function AdminMaisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[var(--text-primary)]">
          Mais Módulos
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Acesso organizado por categoria às ferramentas do estúdio ZANIMA TATTOO.
        </p>
      </div>

      <div className="space-y-6">
        {CATEGORIES.map((category) => (
          <section key={category.title} className="space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              {category.title}
            </h2>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] divide-y divide-[var(--border-default)]">
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <div className="h-9 w-9 rounded-[6px] bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {item.label}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
