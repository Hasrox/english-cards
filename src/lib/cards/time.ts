export function dayKey(when: number | Date = Date.now()): string {
  const date = when instanceof Date ? when : new Date(when);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function startOfDay(when: number): number {
  const date = new Date(when);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function weekdayLabel(when = Date.now()): string {
  return new Date(when).toLocaleDateString(undefined, { weekday: "long" });
}

export function clockLabel(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dueLabel(due: number, now = Date.now()): string {
  if (due <= now) return "Due now";
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (days <= 0) {
    const time = new Date(due).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Due today · ${time}`;
  }
  if (days === 1) return "Due tomorrow";
  if (days < 14) return `Due in ${days} days`;
  return `Due ${new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function gapLabel(due: number, now = Date.now()): string {
  const ms = due - now;
  if (ms < 45_000) return "<1 min";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return mins === 1 ? "1 min" : `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.max(1, Math.round(hours / 24));
  if (days < 30) return days === 1 ? "1 day" : `${days} days`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "1 month" : `${months} months`;
  return "1 year";
}

export function msUntilHour(hour: number, minute: number, now = Date.now()): number {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now;
}
