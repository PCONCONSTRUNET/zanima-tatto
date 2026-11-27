import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/security/session";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";

export const dynamic = "force-dynamic";

export default async function CuidadosFaqPage() {
  const [user, settings] = await Promise.all([
    getCurrentUser(),
    prisma.studioSetting.findUnique({ where: { id: "studio-default" } }),
  ]);

  const careBefore = Array.isArray(settings?.careBeforeJson)
    ? (settings!.careBeforeJson as Array<{ title: string; description: string }>)
    : [];
  const careAfter = Array.isArray(settings?.careAfterJson)
    ? (settings!.careAfterJson as Array<{ title: string; description: string }>)
    : [];
  const faq = Array.isArray(settings?.faqJson)
    ? (settings!.faqJson as Array<{ question: string; answer: string }>)
    : [];
  const isAdmin = user?.role === "OWNER" || user?.role === "STAFF";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
      <PublicHeader isLoggedIn={Boolean(user)} isAdmin={isAdmin} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-6 py-10 space-y-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Orientações oficiais
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1">
            Cuidados Antes, Pós-Tatuagem e FAQ
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">
              Antes da sessão
            </h2>
            <div className="space-y-3">
              {careBefore.map((item, i) => (
                <div key={i} className="space-y-0.5">
                  <h3 className="text-xs font-semibold">{item.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">
              Depois da sessão
            </h2>
            <div className="space-y-3">
              {careAfter.map((item, i) => (
                <div key={i} className="space-y-0.5">
                  <h3 className="text-xs font-semibold">{item.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-5 space-y-4">
          <h2 className="font-display text-base font-semibold">
            Perguntas Frequentes
          </h2>
          <div className="divide-y divide-[var(--border-default)]">
            {faq.map((f, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <h3 className="text-xs font-semibold">{f.question}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {f.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter
        instagramHandle={settings?.instagramHandle || "@zanima_tattoo"}
        whatsappNumber={settings?.whatsappNumber || ""}
        cityState={settings?.cityState || "Brasil"}
      />
    </div>
  );
}
