import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/security/session";
import { formatBRL } from "@/lib/format";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";

export const dynamic = "force-dynamic";

export default async function DesenhosDisponiveisPage() {
  const [user, settings, flashes] = await Promise.all([
    getCurrentUser(),
    prisma.studioSetting.findUnique({ where: { id: "studio-default" } }),
    prisma.exclusiveFlashDesign.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const isAdmin = user?.role === "OWNER" || user?.role === "STAFF";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
      <PublicHeader isLoggedIn={Boolean(user)} isAdmin={isAdmin} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10 space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Criações únicas
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1">
            Catálogo de Desenhos Exclusivos
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Cada arte é tatuada uma única vez para preservar exclusividade.
          </p>
        </div>

        {flashes.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-10 text-center space-y-3">
            <h2 className="font-display text-base font-semibold">
              Novos desenhos autorais em preparação
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Você também pode solicitar uma criação personalizada com suas referências e preferências.
            </p>
            <Link
              href="/orcamento"
              className="inline-flex items-center h-9 px-4 rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
            >
              Solicitar desenho personalizado
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flashes.map((f) => (
              <div
                key={f.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] overflow-hidden flex flex-col"
              >
                {f.imageFileId ? (
                  <img
                    src={`/api/files/${f.imageFileId}`}
                    alt={f.title}
                    className="h-56 w-full object-cover"
                  />
                ) : null}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h2 className="font-display text-sm font-semibold">{f.title}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {f.style} • {f.suggestedRegion} • {f.approxSizeCm}
                    </p>
                    {f.description ? (
                      <p className="text-xs text-[var(--text-secondary)] mt-2">
                        {f.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                    <span className="font-semibold text-sm tabular-nums">
                      {formatBRL(f.price)}
                    </span>
                    <Link
                      href={`/orcamento?ideia=${encodeURIComponent(f.title)}`}
                      className="h-8 px-3 inline-flex items-center rounded-[6px] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-medium"
                    >
                      Reservar arte
                    </Link>
                  </div>
                </div>
              </div>
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
