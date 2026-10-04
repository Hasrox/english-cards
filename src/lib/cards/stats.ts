import { wordById } from "@/data/words";
import { isNewState } from "./fsrs";
import { dayKey, shiftDay } from "./time";
import type { Progress, Settings, Streak } from "./types";

export type StudySnapshot = {
  dueCount: number;
  newLeft: number;
  newPool: number;
  upcoming: number | null;
  reviewsFirst: boolean;
  canStart: boolean;
};

export function studySnapshot(
  progress: Record<string, Progress>,
  settings: Settings,
  now = Date.now(),
): StudySnapshot {
  const today = dayKey(now);
  const rows = Object.values(progress);
  const active = rows.filter((row) => !row.retired);
  const dueCount = active.filter((row) => !isNewState(row.card.state) && row.card.due <= now).length;
  const introduced = rows.filter((row) => row.introducedOn === today).length;
  const newPool = active.filter((row) => isNewState(row.card.state)).length;
  const newLeft = Math.min(newPool, Math.max(0, settings.newCap - introduced));
  const upcomingRow = active
    .filter((row) => !isNewState(row.card.state) && row.card.due > now)
    .sort((a, b) => a.card.due - b.card.due)[0];
  const capacity = Math.max(1, Math.round((settings.minutes * 60) / 12));
  return {
    dueCount,
    newLeft,
    newPool,
    upcoming: upcomingRow?.card.due ?? null,
    reviewsFirst: dueCount >= capacity && newLeft > 0,
    canStart: dueCount > 0 || newLeft > 0,
  };
}

export function dueIds(progress: Record<string, Progress>, now: number): string[] {
  return Object.values(progress)
    .filter((row) => !row.retired && !isNewState(row.card.state) && row.card.due <= now)
    .sort((a, b) => a.card.due - b.card.due)
    .map((row) => row.wordId);
}

export function freshIds(progress: Record<string, Progress>, settings: Settings, now: number): string[] {
  const today = dayKey(now);
  const introduced = Object.values(progress).filter((row) => row.introducedOn === today).length;
  const room = Math.max(0, settings.newCap - introduced);
  return Object.values(progress)
    .filter((row) => !row.retired && isNewState(row.card.state))
    .sort((a, b) => (wordById(a.wordId)?.rank ?? 9_999) - (wordById(b.wordId)?.rank ?? 9_999))
    .slice(0, room)
    .map((row) => row.wordId);
}

export function streakFact(streak: Streak, now = Date.now()): string | null {
  if (streak.count < 1 || !streak.lastDay) return null;
  const today = dayKey(now);
  if (streak.lastDay !== today && streak.lastDay !== shiftDay(today, -1)) return null;
  return streak.count === 1 ? "1 day in a row" : `${streak.count} days in a row`;
}

export function bumpStreak(streak: Streak, now = Date.now()): Streak {
  const today = dayKey(now);
  if (streak.lastDay === today) return streak;
  if (streak.lastDay === shiftDay(today, -1)) return { count: streak.count + 1, lastDay: today };
  return { count: 1, lastDay: today };
}
