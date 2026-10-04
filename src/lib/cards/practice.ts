import { isNewState } from "./fsrs";
import { dayKey, shiftDay } from "./time";
import type { PracticeLog, Progress, Streak } from "./types";

export const FACES = [
  { id: "star", src: "/ui/face-star.jpg", label: "Stars" },
  { id: "helm", src: "/ui/face-helm.jpg", label: "Helmet" },
  { id: "shades", src: "/ui/face-shades.jpg", label: "Shades" },
  { id: "cat", src: "/ui/face-cat.jpg", label: "Cat" },
] as const;

export const EMPTY_LOG: PracticeLog = { days: [], ms: 0, avatar: "star", games: 0, real: true };

export function streakFromDays(days: string[], now = Date.now()): Streak {
  const set = new Set(days);
  let cursor = dayKey(now);
  if (!set.has(cursor)) cursor = shiftDay(cursor, -1);
  if (!set.has(cursor)) return { count: 0, lastDay: null };
  const lastDay = cursor;
  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return { count, lastDay };
}

export function studiedCount(progress: Record<string, Progress>): number {
  return Object.values(progress).filter((row) => !row.retired && !isNewState(row.card.state) && row.card.reps > 0).length;
}

export type Badge = {
  id: string;
  title: string;
  need: string;
  src: string;
  earned: boolean;
};

export function badgeList(log: PracticeLog, progress: Record<string, Progress>, streak: number): Badge[] {
  const studied = studiedCount(progress);
  return [
    { id: "3", title: "Locked in", need: "3 days in a row", src: "/ui/badge-3.jpg", earned: streak >= 3 },
    { id: "7", title: "No days off", need: "7 days in a row", src: "/ui/badge-7.jpg", earned: streak >= 7 },
    { id: "30", title: "Full tour", need: "30 days in a row", src: "/ui/badge-30.jpg", earned: streak >= 30 },
    { id: "50", title: "50 deep", need: "50 words studied", src: "/ui/badge-50.jpg", earned: studied >= 50 },
    { id: "game", title: "First op", need: "Finish one game", src: "/ui/badge-game.jpg", earned: log.games >= 1 },
    { id: "hour", title: "Still here", need: "1 hour of practice", src: "/ui/badge-hour.jpg", earned: log.ms >= 3_600_000 },
  ];
}

export function hoursLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  if (rest === 0) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} ${rest} min`;
}

export function monthCells(now = new Date()): { key: string; inMonth: boolean; day: number }[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const cells: { key: string; inMonth: boolean; day: number }[] = [];
  for (let index = 0; index < first.getDay(); index += 1) {
    cells.push({ key: `pad-${index}`, inMonth: false, day: 0 });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({ key: dayKey(new Date(year, month, day)), inMonth: true, day });
  }
  return cells;
}

export function monthTitle(now = new Date()): string {
  return now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function faceSrc(id: string): string {
  return FACES.find((face) => face.id === id)?.src ?? FACES[0].src;
}
