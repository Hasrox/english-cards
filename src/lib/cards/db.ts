import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { registerOwnWords, wordFromOwn, type OwnDraft } from "@/data/words";
import { emptySavedCard, isNewState } from "./fsrs";
import { DEFAULT_SETTINGS, type PictureRecord, type PracticeLog, type Progress, type Settings, type Streak } from "./types";
import { EMPTY_LOG, streakFromDays } from "./practice";

interface CardsDB extends DBSchema {
  progress: {
    key: string;
    value: Progress;
  };
  pictures: {
    key: string;
    value: PictureRecord;
  };
  meta: {
    key: string;
    value: Settings | Streak | PracticeLog | { picked: true };
  };
  custom: {
    key: string;
    value: OwnDraft;
  };
}

const DB_NAME = "english-cards";

let dbPromise: Promise<IDBPDatabase<CardsDB>> | null = null;

function getDb(): Promise<IDBPDatabase<CardsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CardsDB>(DB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("progress")) {
          db.createObjectStore("progress", { keyPath: "wordId" });
        }
        if (!db.objectStoreNames.contains("pictures")) db.createObjectStore("pictures");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("custom")) db.createObjectStore("custom", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export function emptyProgress(wordId: string, now = Date.now()): Progress {
  return {
    wordId,
    card: emptySavedCard(now),
    arabic: null,
    hasPicture: false,
    credit: null,
    retired: false,
    failCount: 0,
    introducedOn: null,
    pictureRev: 0,
  };
}

function isSettings(value: unknown): value is Settings {
  return !!value && typeof value === "object" && "newCap" in value && "minutes" in value;
}

function isLog(value: unknown): value is PracticeLog {
  if (!value || typeof value !== "object") return false;
  const row = value as PracticeLog;
  return Array.isArray(row.days) && typeof row.ms === "number" && typeof row.avatar === "string" && typeof row.games === "number";
}

function isStreak(value: unknown): value is Streak {
  return !!value && typeof value === "object" && "count" in value && "lastDay" in value;
}

function untouched(row: Progress): boolean {
  return (
    isNewState(row.card.state) &&
    row.card.reps === 0 &&
    !row.arabic &&
    !row.hasPicture &&
    row.failCount === 0 &&
    !row.introducedOn &&
    !row.retired
  );
}

export async function loadVault(): Promise<{
  progress: Record<string, Progress>;
  settings: Settings;
  streak: Streak;
  log: PracticeLog;
  own: OwnDraft[];
}> {
  const db = await getDb();
  const tx = db.transaction(["progress", "meta", "custom"], "readwrite");
  const progressStore = tx.objectStore("progress");
  const metaStore = tx.objectStore("meta");
  const customStore = tx.objectStore("custom");
  const existing = await progressStore.getAll();
  const byId = new Map(existing.map((row) => [row.wordId, row]));
  const own = await customStore.getAll();
  registerOwnWords(own.map(wordFromOwn));

  const deckFlag = await metaStore.get("deck");
  const picked = !!deckFlag && typeof deckFlag === "object" && "picked" in deckFlag;
  if (!picked) {
    for (const row of [...byId.values()]) {
      if (!untouched(row)) continue;
      await progressStore.delete(row.wordId);
      byId.delete(row.wordId);
    }
    await metaStore.put({ picked: true }, "deck");
  }

  const storedSettings = await metaStore.get("settings");
  const settings: Settings = isSettings(storedSettings)
    ? { ...DEFAULT_SETTINGS, ...storedSettings }
    : DEFAULT_SETTINGS;
  if (!isSettings(storedSettings)) await metaStore.put(settings, "settings");

  const storedStreak = await metaStore.get("streak");
  const storedLog = await metaStore.get("log");
  const log: PracticeLog = isLog(storedLog)
    ? {
        days: storedLog.days.filter((day) => typeof day === "string"),
        ms: Math.max(0, storedLog.ms),
        avatar: storedLog.avatar,
        games: Math.max(0, storedLog.games),
        real: storedLog.real === true,
      }
    : EMPTY_LOG;
  if (!log.real) {
    log.ms = 0;
    log.real = true;
    await metaStore.put(log, "log");
  } else if (!isLog(storedLog)) {
    await metaStore.put(log, "log");
  }
  const streak = streakFromDays(log.days);
  if (!isStreak(storedStreak) || storedStreak.count !== streak.count || storedStreak.lastDay !== streak.lastDay) {
    await metaStore.put(streak, "streak");
  }

  await tx.done;

  const progress: Record<string, Progress> = {};
  for (const row of byId.values()) progress[row.wordId] = row;
  return { progress, settings, streak, log, own };
}

export async function writeProgress(progress: Progress): Promise<void> {
  const db = await getDb();
  await db.put("progress", progress);
}

export async function writeProgressMany(rows: Progress[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("progress", "readwrite");
  for (const row of rows) tx.store.put(row);
  await tx.done;
}

export async function forgetWord(wordId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["progress", "pictures", "custom"], "readwrite");
  await tx.objectStore("progress").delete(wordId);
  await tx.objectStore("pictures").delete(wordId);
  await tx.objectStore("custom").delete(wordId);
  await tx.done;
}

export async function writeOwn(own: OwnDraft): Promise<void> {
  const db = await getDb();
  await db.put("custom", own);
}

export async function writeSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  await db.put("meta", settings, "settings");
}

export async function writeLog(log: PracticeLog): Promise<void> {
  const db = await getDb();
  await db.put("meta", log, "log");
}

export async function writeStreak(streak: Streak): Promise<void> {
  const db = await getDb();
  await db.put("meta", streak, "streak");
}

export async function readPicture(wordId: string): Promise<PictureRecord | undefined> {
  const db = await getDb();
  return db.get("pictures", wordId);
}

export async function writePicture(wordId: string, progress: Progress, picture: PictureRecord): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["progress", "pictures"], "readwrite");
  await tx.objectStore("progress").put(progress);
  await tx.objectStore("pictures").put(picture, wordId);
  await tx.done;
}

export async function removePicture(wordId: string, progress: Progress): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["progress", "pictures"], "readwrite");
  await tx.objectStore("progress").put(progress);
  await tx.objectStore("pictures").delete(wordId);
  await tx.done;
}
