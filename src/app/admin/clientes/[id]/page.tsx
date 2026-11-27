import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toNumber } from "@/lib/format";
import { autoCompleteElapsedAppointments } from "@/lib/agenda/scheduling";
import { ClientRecordClient } from "@/components/admin/client-record-client";

export const dynamic = "force-dynamic";

export default async function AdminClientRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  await autoCompleteElapsedAppointments();
  const { id } = await params;

  const [client, clientTransactions] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, lastLoginAt: true } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { name: true } } },
        },
        appointments: {
          orderBy: { startAt: "desc" },
          include: { project: { select: { id: true, name: true } } },
        },
        projects: {
          orderBy: { updatedAt: "desc" },
          include: {
            media: { include: { file: true } },
            payments: { select: { amount: true, status: true } },
          },
        },
        quoteRequests: { orderBy: { createdAt: "desc" } },
        payments: {
          orderBy: { createdAt: "desc" },
          include: {
            appointment: { select: { title: true } },
            project: { select: { name: true } },
          },
        },
        documentSignatures: {
          orderBy: { signedAt: "desc" },
          include: { template: { select: { title: true, kind: true } } },
        },
        passports: { orderBy: { completedDate: "desc" } },
      },
    }),
    prisma.financialTransaction.findMany({
      where: {
        context: "STUDIO",
        type: "INCOME",
        OR: [
          { appointment: { clientId: id } },
          { project: { clientId: id } },
          { payment: { clientId: id } },
        ],
      },
      orderBy: { competenceDate: "desc" },
      include: {
        category: { select: { name: true } },
        appointment: { select: { title: true } },
      },
    }),
  ]);

  if (!client) notFound();

  return (
    <ClientRecordClient
      client={{
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        whatsapp: client.whatsapp,
        email: client.email,
        birthDate: client.birthDate
          ? client.birthDate.toISOString().slice(0, 10)
          : null,
        preferredStyles: client.preferredStyles,
        allergiesSummary: client.allergiesSummary,
        marketingOptIn: client.marketingOptIn,
        hasAccount: Boolean(client.userId),
        accountEmail: client.user?.email || null,
        verificationCode: client.identityVerificationCode,
        avatarFileId: client.avatarFileId,
        createdAt: client.createdAt.toISOString(),
        notes: client.notes.map((n) => ({
          id: n.id,
          content: n.content,
          authorName: n.author.name,
          createdAt: n.createdAt.toISOString(),
        })),
        appointments: client.appointments.map((a) => ({
          id: a.id,
          title: a.title,
          startAt: a.startAt.toISOString(),
          durationMinutes: a.durationMinutes,
          status: a.status,
          projectName: a.project?.name || null,
        })),
        projects: client.projects.map((p) => {
          const paid = p.payments
            .filter((pay) => pay.status === "CONFIRMED")
            .reduce((acc, pay) => acc + toNumber(pay.amount), 0);
          return {
            id: p.id,
            name: p.name,
            style: p.style,
            bodyRegion: p.bodyRegion,
            stage: p.stage,
            negotiatedAmount: toNumber(p.negotiatedAmount),
            paidAmount: paid,
            photos: p.media.map((m) => ({
              id: m.id,
              fileId: m.fileId,
              kind: m.kind,
              caption: m.caption,
            })),
          };
        }),
        quotes: client.quoteRequests.map((q) => ({
          id: q.id,
          title: q.title,
          style: q.style,
          status: q.status,
          quotedAmount: q.quotedAmount ? toNumber(q.quotedAmount) : null,
          createdAt: q.createdAt.toISOString(),
        })),
        payments: client.payments.map((pay) => ({
          id: pay.id,
          kind: pay.kind,
          method: pay.method,
          amount: toNumber(pay.amount),
          status: pay.status,
          referenceTitle:
            pay.project?.name || pay.appointment?.title || null,
          createdAt: pay.createdAt.toISOString(),
        })),
        transactions: clientTransactions.map((t) => ({
          id: t.id,
          description: t.description,
          categoryName: t.category?.name || "Atendimento",
          method: t.paymentMethod,
          amount: toNumber(t.amount),
          status: t.status,
          competenceDate: t.competenceDate.toISOString(),
        })),
        documents: client.documentSignatures.map((doc) => ({
          id: doc.id,
          title: doc.template.title,
          kind: doc.kind,
          version: doc.templateVersion,
          signedAt: doc.signedAt.toISOString(),
        })),
      }}
    />
  );
}
