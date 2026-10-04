export const LEECH_AT = 5;

export type GradeName = "again" | "hard" | "good" | "easy";

export type SavedCard = {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
};

export type Credit = {
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
};

export type Progress = {
  wordId: string;
  card: SavedCard;
  arabic: string | null;
  hasPicture: boolean;
  credit: Credit | null;
  retired: boolean;
  failCount: number;
  introducedOn: string | null;
  pictureRev: number;
};

export type Settings = {
  reminderHour: number;
  reminderMinute: number;
  newCap: number;
  minutes: number;
  reminders: boolean;
};

export type Streak = {
  count: number;
  lastDay: string | null;
};

export type PracticeLog = {
  days: string[];
  ms: number;
  avatar: string;
  games: number;
  real?: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  reminderHour: 20,
  reminderMinute: 0,
  newCap: 10,
  minutes: 5,
  reminders: true,
};

export type PictureRecord = {
  blob: Blob;
  credit: Credit | null;
};
