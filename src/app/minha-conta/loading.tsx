export default function ClientAreaLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-[var(--bg-subtle)]" />
          <div className="h-6 w-40 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]" />
        </div>
        <div className="h-9 w-28 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)]" />
      </div>

      <div className="h-28 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)]" />

      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)]" />
        <div className="h-28 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)]" />
      </div>
    </div>
  );
}
