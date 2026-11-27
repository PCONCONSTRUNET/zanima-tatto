import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/security/session";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { TATTOO_STYLES } from "@/lib/domain-labels";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ estilo?: string }>;
}) {
  const { estilo } = await searchParams;
  const [user, settings, projects] = await Promise.all([
    getCurrentUser(),
    prisma.studioSetting.findUnique({ where: { id: "studio-default" } }),
    prisma.tattooProject.findMany({
      where: {
        allowPublicPortfolio: true,
        ...(estilo ? { style: estilo } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        media: {
          where: { kind: "RESULT_PHOTO", hasImageConsent: true },
        },
      },
    }),
  ]);

  const items = projects.filter((p) => p.media.length > 0);
  const isAdmin = user?.role === "OWNER" || user?.role === "STAFF";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
      <PublicHeader isLoggedIn={Boolean(user)} isAdmin={isAdmin} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Trabalhos autorizados
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1">
              Portfólio ZANIMA TATTOO
            </h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/portfolio"
              className={`h-8 px-3 inline-flex items-center rounded-[4px] text-xs font-medium border ${
                !estilo
                  ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                  : "bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)]"
              }`}
            >
              Todos
            </Link>
            {TATTOO_STYLES.map((s) => (
              <Link
                key={s}
                href={`/portfolio?estilo=${encodeURIComponent(s)}`}
                className={`h-8 px-3 inline-flex items-center rounded-[4px] text-xs font-medium border ${
                  estilo === s
                    ? "bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]"
                    : "bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)]"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-10 text-center space-y-3">
            <ShieldCheck className="h-6 w-6 mx-auto text-[var(--brand-champagne)]" strokeWidth={1.5} />
            <h2 className="font-display text-base font-semibold">
              Nenhum trabalho publicado nesta seleção
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Somente fotografias reais com termo de autorização de imagem assinado e liberação da tatuadora são exibidas nesta galeria.
            </p>
            <div className="pt-2">
              <Link
                href="/orcamento"
                className="inline-flex items-center h-9 px-4 rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
              >
                Solicitar projeto personalizado
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => (
              <article
                key={p.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
              >
                <img
                  src={`/api/files/${p.media[0].fileId}`}
                  alt={p.name}
                  className="h-72 w-full object-cover"
                />
                <div className="p-4 space-y-1">
                  <h2 className="font-display text-sm font-semibold">{p.name}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {p.style} • {p.bodyRegion}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <PublicFooter
        instagramHandle={settings?.instagramHandle || "@zanima_tattoo"}
        whatsappNumber={settings?.whatsappNumber || ""}
        cityState={settings?.cityState || "Brasil"}
      />
    </div>
  );
}
