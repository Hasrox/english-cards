import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { GradeName, SavedCard } from "./types";

export const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

const RATINGS: Record<GradeName, Grade> = {
  again: Rating.Again as Grade,
  hard: Rating.Hard as Grade,
  good: Rating.Good as Grade,
  easy: Rating.Easy as Grade,
};

export function emptySavedCard(now = Date.now()): SavedCard {
  return fromCard(createEmptyCard(now));
}

export function fromCard(card: Card): SavedCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

export function toCard(saved: SavedCard): Card {
  return {
    due: new Date(saved.due),
    stability: saved.stability,
    difficulty: saved.difficulty,
    elapsed_days: saved.elapsed_days,
    scheduled_days: saved.scheduled_days,
    learning_steps: saved.learning_steps,
    reps: saved.reps,
    lapses: saved.lapses,
    state: saved.state as State,
    ...(saved.last_review != null ? { last_review: new Date(saved.last_review) } : {}),
  };
}

export function isNewState(state: number): boolean {
  return state === State.New;
}

export function isShortTerm(state: number): boolean {
  return state === State.Learning || state === State.Relearning;
}

export function applyRating(saved: SavedCard, rating: GradeName, now = new Date()): SavedCard {
  const next = scheduler.next(toCard(saved), now, RATINGS[rating]);
  return fromCard(next.card);
}

export function previewDues(saved: SavedCard, now = new Date()): Record<GradeName, number> {
  const log = scheduler.repeat(toCard(saved), now);
  return {
    again: log[Rating.Again].card.due.getTime(),
    hard: log[Rating.Hard].card.due.getTime(),
    good: log[Rating.Good].card.due.getTime(),
    easy: log[Rating.Easy].card.due.getTime(),
  };
}
