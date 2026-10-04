export function GroupBar({ learned, total }: { learned: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((learned / total) * 100)) : 0;
  return (
    <div className="mt-3">
      <div
        className="h-2 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuenow={learned}
        aria-valuemax={total}
        aria-label={`${learned} of ${total} learned`}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{learned} of {total} learned</p>
    </div>
  );
}
