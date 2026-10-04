import { create } from "zustand";
import { forgetWord, loadVault, removePicture, writeOwn, writePicture, writeProgress, writeProgressMany, writeSettings, writeStreak, writeLog, emptyProgress } from "./db";
import { applyRating, isNewState, isShortTerm } from "./fsrs";
import { armReminder, listenForInstall, paintBadge, registerPeriodicSync, registerWorker } from "./notify";
import { EMPTY_LOG, FACES, streakFromDays } from "./practice";
import { studySnapshot } from "./stats";
import { dayKey } from "./time";
import type { Credit, GradeName, PracticeLog, Progress, Settings, Streak } from "./types";
import { registerOwnWords, slugLemma, wordById, wordFromOwn, installLibrary, type OwnDraft, type Pos, type Word } from "@/data/words";

type GradeResult = { nextDue: number; shortTerm: boolean };

type VaultState = {
  ready: boolean;
  listsReady: boolean;
  error: string | null;
  progress: Record<string, Progress>;
  own: Word[];
  library: Word[];
  settings: Settings;
  streak: Streak;
  log: PracticeLog;
  init: () => Promise<void>;
  grade: (wordId: string, rating: GradeName, extra?: boolean) => Promise<GradeResult>;
  markPracticeDay: (kind: "quiz" | "game") => Promise<void>;
  addPracticeMs: (ms: number) => Promise<void>;
  setAvatar: (avatar: string) => Promise<void>;
  setArabic: (wordId: string, arabic: string | null) => Promise<void>;
  setPicture: (wordId: string, blob: Blob, credit: Credit | null) => Promise<void>;
  clearPicture: (wordId: string) => Promise<void>;
  setRetired: (wordId: string, retired: boolean) => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
  addToDeck: (ids: string[]) => Promise<number>;
  addOwn: (input: { lemma: string; ar: string; example: string; pos: Pos; topic?: string }) => Promise<string>;
  setTopic: (wordId: string, topic: string) => Promise<void>;
  removeFromDeck: (wordId: string) => Promise<void>;
};

let starting: Promise<void> | null = null;

function rememberReminder(get: () => VaultState): void {
  armReminder(() => {
    const state = get();
    return { settings: state.settings, due: studySnapshot(state.progress, state.settings).dueCount };
  });
  paintBadge(studySnapshot(get().progress, get().settings).dueCount);
}

export const useVault = create<VaultState>((set, get) => ({
  ready: false,
  listsReady: false,
  error: null,
  progress: {},
  own: [],
  library: [],
  settings: {
    reminderHour: 20,
    reminderMinute: 0,
    newCap: 10,
    minutes: 5,
    reminders: true,
  },
  streak: { count: 0, lastDay: null },
  log: EMPTY_LOG,

  init: () => {
    if (starting) return starting;
    starting = (async () => {
      try {
        listenForInstall();
        registerWorker();
        const vault = await loadVault();
        set({
          progress: vault.progress,
          settings: vault.settings,
          streak: vault.streak,
          log: vault.log,
          own: vault.own.map(wordFromOwn),
          ready: true,
          error: null,
        });
        rememberReminder(get);
        const { LEXICON } = await import("@/data/lexicon");
        set({ library: installLibrary(LEXICON), listsReady: true });
        if (vault.settings.reminders && typeof Notification !== "undefined" && Notification.permission === "granted") {
          void registerPeriodicSync();
        }
      } catch (error) {
        starting = null;
        const message = error instanceof Error ? error.message : "The cards could not be opened.";
        set({ error: message, ready: false });
        throw error;
      }
    })();
    return starting;
  },

  grade: async (wordId, rating, extra = false) => {
    const current = get().progress[wordId];
    if (!current) throw new Error("That word is missing.");
    const wasNew = isNewState(current.card.state);
    const now = new Date();
    let card = applyRating(current.card, rating, now);
    const ahead = !wasNew && current.card.due > now.getTime();
    if (extra && ahead && rating !== "again" && rating !== "hard") {
      card = current.card;
    }
    const next: Progress = {
      ...current,
      card,
      failCount: rating === "again" ? current.failCount + 1 : current.failCount,
      introducedOn: wasNew ? (current.introducedOn ?? dayKey(now)) : current.introducedOn,
    };
    await writeProgress(next);
    set((state) => ({
      progress: { ...state.progress, [wordId]: next },
    }));
    rememberReminder(get);
    return { nextDue: card.due, shortTerm: isShortTerm(card.state) };
  },

  markPracticeDay: async (kind) => {
    const today = dayKey();
    const current = get().log;
    const days = current.days.includes(today) ? current.days : [...current.days, today];
    const log = { ...current, days, games: kind === "game" ? current.games + 1 : current.games };
    const streak = streakFromDays(days);
    await writeLog(log);
    await writeStreak(streak);
    set({ log, streak });
  },

  addPracticeMs: async (ms) => {
    const add = Math.min(Math.max(0, Math.round(ms)), 2 * 60 * 60 * 1000);
    if (add < 1000) return;
    const log = { ...get().log, ms: get().log.ms + add, real: true };
    await writeLog(log);
    set({ log });
  },

  setAvatar: async (avatar) => {
    if (!FACES.some((face) => face.id === avatar)) return;
    const log = { ...get().log, avatar };
    await writeLog(log);
    set({ log });
  },

  setArabic: async (wordId, arabic) => {
    const current = get().progress[wordId];
    if (!current) return;
    const next = { ...current, arabic };
    await writeProgress(next);
    set((state) => ({ progress: { ...state.progress, [wordId]: next } }));
  },

  setPicture: async (wordId, blob, credit) => {
    const current = get().progress[wordId];
    if (!current) return;
    const next: Progress = {
      ...current,
      hasPicture: true,
      credit,
      pictureRev: current.pictureRev + 1,
    };
    await writePicture(wordId, next, { blob, credit });
    set((state) => ({ progress: { ...state.progress, [wordId]: next } }));
  },

  clearPicture: async (wordId) => {
    const current = get().progress[wordId];
    if (!current) return;
    const next: Progress = {
      ...current,
      hasPicture: false,
      credit: null,
      pictureRev: current.pictureRev + 1,
    };
    await removePicture(wordId, next);
    set((state) => ({ progress: { ...state.progress, [wordId]: next } }));
  },

  setRetired: async (wordId, retired) => {
    const current = get().progress[wordId];
    if (!current) return;
    const next = { ...current, retired };
    await writeProgress(next);
    set((state) => ({ progress: { ...state.progress, [wordId]: next } }));
    rememberReminder(get);
  },

  saveSettings: async (settings) => {
    const next: Settings = {
      ...settings,
      newCap: clamp(settings.newCap, 1, 30),
      minutes: clamp(settings.minutes, 1, 20),
      reminderHour: clamp(settings.reminderHour, 0, 23),
      reminderMinute: clamp(settings.reminderMinute, 0, 59),
    };
    await writeSettings(next);
    set({ settings: next });
    rememberReminder(get);
    if (next.reminders && typeof Notification !== "undefined" && Notification.permission === "granted") {
      void registerPeriodicSync();
    }
  },

  addToDeck: async (ids) => {
    const existing = get().progress;
    const now = Date.now();
    const rows = ids
      .filter((id) => wordById(id) && !existing[id])
      .map((id) => emptyProgress(id, now));
    await writeProgressMany(rows);
    if (rows.length === 0) return 0;
    set((state) => {
      const progress = { ...state.progress };
      for (const row of rows) progress[row.wordId] = row;
      return { progress };
    });
    rememberReminder(get);
    return rows.length;
  },

  addOwn: async ({ lemma, ar, example, pos, topic }) => {
    const slug = slugLemma(lemma);
    if (!slug) throw new Error("Use English letters for the word.");
    const gloss = ar.trim();
    if (!gloss) throw new Error("Add an Arabic line.");
    const listed = wordById(slug);
    if (listed && listed.source !== "mine") {
      await get().addToDeck([listed.id]);
      if (gloss !== listed.ar) await get().setArabic(listed.id, gloss);
      return listed.id;
    }
    const draft: OwnDraft = {
      id: slug,
      lemma: lemma.trim(),
      pos,
      ar: gloss,
      example: example.trim(),
      topic: topic || "everyday",
    };
    const word = wordFromOwn(draft);
    await writeOwn(draft);
    const own = [...get().own.filter((item) => item.id !== word.id), word];
    registerOwnWords(own);
    set({ own });
    await get().addToDeck([word.id]);
    return word.id;
  },

  setTopic: async (wordId, topic) => {
    const current = get().own.find((word) => word.id === wordId);
    if (!current || current.source !== "mine") return;
    const draft: OwnDraft = {
      id: current.id,
      lemma: current.lemma,
      pos: current.pos,
      ar: current.ar,
      example: current.example,
      topic,
    };
    const word = wordFromOwn(draft);
    await writeOwn(draft);
    const own = get().own.map((item) => (item.id === wordId ? word : item));
    registerOwnWords(own);
    set({ own });
  },

  removeFromDeck: async (wordId) => {
    await forgetWord(wordId);
    const own = get().own.filter((word) => word.id !== wordId);
    registerOwnWords(own);
    set((state) => {
      const progress = { ...state.progress };
      delete progress[wordId];
      return { progress, own };
    });
    rememberReminder(get);
  },
}));

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
