import { isNewState } from "./fsrs.ts";
import type { Progress } from "./types.ts";

/**
 * Learn-complete practice: the batch just taught, in that order.
 * Drops ids that are missing, retired, or still New. Does not pad.
 */
export function practicePinnedIds(
  progress: Record<string, Progress>,
  ids: string[],
  rotate = 0,
): string[] {
  const kept = ids.filter((id) => {
    const row = progress[id];
    return Boolean(row && !row.retired && !isNewState(row.card.state));
  });
  if (kept.length <= 1) return kept;
  const start = (Math.max(0, rotate) * 8) % kept.length;
  return kept.slice(start).concat(kept.slice(0, start));
}
