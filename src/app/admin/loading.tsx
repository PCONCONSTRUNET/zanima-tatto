export default function AdminLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-[var(--bg-subtle)]" />
          <div className="h-7 w-48 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]" />
        </div>
        <div className="h-9 w-36 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)]"
          />
        ))}
      </div>

      <div className="h-64 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-default)]" />
    </div>
  );
}
