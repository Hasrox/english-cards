import { normalizeHits, type ImageHit, type RawPictureHit } from "./picture-hits";

type PictureEvent = {
  type: "hits" | "more" | "error" | "blob";
  token: number;
  hits?: RawPictureHit[];
  message?: string;
  dataUrl?: string;
};

type AndroidPictures = {
  search: (token: string, query: string) => void;
  more: (token: string) => void;
  download: (token: string, url: string) => void;
  close: () => void;
};

type Waiter = {
  resolve: (event: PictureEvent) => void;
  reject: (error: Error) => void;
};

const waiters = new Map<number, Waiter>();
let nextToken = 1;
let listening = false;

function getBridge(): AndroidPictures | undefined {
  if (typeof window === "undefined") return undefined;
  const host = (window as unknown as { AndroidPictures?: AndroidPictures }).AndroidPictures;
  if (!host || typeof host.search !== "function") return undefined;
  return host;
}

function ensureListen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("ec-pictures", (event) => {
    const detail = (event as CustomEvent<PictureEvent>).detail;
    if (!detail || typeof detail.token !== "number") return;
    const waiter = waiters.get(detail.token);
    if (!waiter) return;
    waiters.delete(detail.token);
    if (detail.type === "error") {
      waiter.reject(new Error(detail.message || "Search did not work."));
      return;
    }
    waiter.resolve(detail);
  });
}

function waitFor(token: number, ms: number): Promise<PictureEvent> {
  ensureListen();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (!waiters.delete(token)) return;
      reject(new Error("Search took too long."));
    }, ms);
    waiters.set(token, {
      resolve: (event) => {
        window.clearTimeout(timer);
        resolve(event);
      },
      reject: (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    });
  });
}

async function readJson(response: Response): Promise<{ hits?: RawPictureHit[]; message?: string; error?: string }> {
  const body = (await response.json()) as { hits?: RawPictureHit[]; message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.message || body.error || "Search did not work.");
  }
  return body;
}

async function devSearch(query: string): Promise<ImageHit[]> {
  const response = await fetch("/__pictures/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: query }),
  });
  const body = await readJson(response);
  return normalizeHits(body.hits ?? []);
}

async function devMore(): Promise<ImageHit[]> {
  const response = await fetch("/__pictures/more", { method: "POST" });
  const body = await readJson(response);
  return normalizeHits(body.hits ?? []);
}

async function devDownload(url: string): Promise<Blob> {
  const target = new URL("/__pictures/download", window.location.origin);
  target.searchParams.set("url", url);
  const response = await fetch(target);
  if (!response.ok) throw new Error("The picture could not be saved.");
  const blob = await response.blob();
  if (blob.size < 32) throw new Error("The picture file was empty.");
  return blob;
}

function canUseDevProxy(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function pictureSearchAvailable(): boolean {
  return getBridge() != null || canUseDevProxy();
}

export async function searchPictures(query: string): Promise<ImageHit[]> {
  const term = query.trim();
  if (!term) throw new Error("Type a word to search.");
  const android = getBridge();
  if (android) {
    const token = nextToken++;
    const pending = waitFor(token, 28000);
    android.search(String(token), term);
    const event = await pending;
    return normalizeHits(event.hits ?? []);
  }
  if (canUseDevProxy()) return devSearch(term);
  throw new Error("Search works in the phone app. You can add a photo from this phone instead.");
}

export async function morePictures(): Promise<ImageHit[]> {
  const android = getBridge();
  if (android) {
    const token = nextToken++;
    const pending = waitFor(token, 20000);
    android.more(String(token));
    const event = await pending;
    return normalizeHits(event.hits ?? []);
  }
  if (canUseDevProxy()) return devMore();
  throw new Error("Search works in the phone app.");
}

export async function downloadPicture(url: string): Promise<Blob> {
  if (!url.startsWith("https://")) throw new Error("That picture address is not safe to save.");
  const android = getBridge();
  if (android) {
    const token = nextToken++;
    const pending = waitFor(token, 20000);
    android.download(String(token), url);
    const event = await pending;
    if (!event.dataUrl?.startsWith("data:")) throw new Error("The picture could not be saved.");
    const blob = await (await fetch(event.dataUrl)).blob();
    if (blob.size < 32) throw new Error("The picture file was empty.");
    return blob;
  }
  if (canUseDevProxy()) return devDownload(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error("The picture could not be saved.");
  const blob = await response.blob();
  if (blob.size < 32) throw new Error("The picture file was empty.");
  return blob;
}

export function closePictureSearch(): void {
  getBridge()?.close();
  if (canUseDevProxy()) {
    void fetch("/__pictures/close", { method: "POST" }).catch(() => undefined);
  }
}
