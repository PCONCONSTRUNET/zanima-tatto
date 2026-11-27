import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/security/rbac";
import { toISODateSP } from "@/lib/format";
import { NotesRemindersClient } from "@/components/admin/notes-reminders-client";

export const dynamic = "force-dynamic";

export default async function AdminLembretesPage() {
  const user = await requireAdminPage();
  const todayStr = toISODateSP();

  const [reminders, folders, notes] = await Promise.all([
    prisma.reminder.findMany({
      where: { userId: user.id },
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }],
      take: 120,
    }),
    prisma.noteFolder.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.studioNote.findMany({
      where: { userId: user.id },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: {
        folder: { select: { id: true, name: true, color: true } },
      },
    }),
  ]);

  return (
    <NotesRemindersClient
      todayStr={todayStr}
      initialReminders={reminders.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        color: r.color,
        dueAt: r.dueAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      }))}
      initialFolders={folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
      }))}
      initialNotes={notes.map((n) => ({
        id: n.id,
        folderId: n.folderId,
        folderName: n.folder?.name || null,
        folderColor: n.folder?.color || null,
        title: n.title,
        content: n.content,
        color: n.color,
        isPinned: n.isPinned,
        updatedAt: n.updatedAt.toISOString(),
      }))}
    />
  );
}
