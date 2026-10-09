import type { Credit } from "./types";

export type RawPictureHit = {
  url?: string;
  thumb?: string;
  title?: string;
  width?: number;
  height?: number;
};

export type ImageHit = {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
};

export const PICTURE_BATCH = 24;
export const MIN_PICTURE_EDGE = 80;

const SKIP =
  /logo|favicon|sprite|\/icon(?:s)?\/|maps\.google|ssl\.gstatic\.com\/gb|www\.gstatic\.com\/images\/branding|google\.com\/images\/branding|data:image\/gif;base64,R0lGODlhAQAB/i;

export function decodeGoogleUrl(url: string): string {
  return url
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .trim();
}

export function isHttpsUrl(url: string): boolean {
  return url.startsWith("https://");
}

export function isUsablePictureUrl(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  if (url.startsWith("data:")) return false;
  if (SKIP.test(url)) return false;
  if (url.includes("encrypted-tbn") && url.includes("gstatic.com")) return true;
  if (url.includes("googleusercontent.com")) return true;
  if (url.includes("gstatic.com/images")) return true;
  if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(url)) return true;
  try {
    const host = new URL(url).hostname;
    if (/^(?:images?|img|i|cdn|media|static)\./i.test(host)) return true;
  } catch {
    return false;
  }
  return false;
}

export function googleImagesUrl(query: string): string {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("tbm", "isch");
  url.searchParams.set("udm", "2");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("safe", "active");
  url.searchParams.set("tbs", "isz:m,itp:photo");
  url.searchParams.set("hl", "en");
  return url.toString();
}

export function normalizeHits(
  raw: RawPictureHit[],
  seen: Set<string> = new Set(),
  cap = PICTURE_BATCH,
): ImageHit[] {
  const hits: ImageHit[] = [];
  for (const row of raw) {
    const url = decodeGoogleUrl(row.url ?? "");
    const thumb = decodeGoogleUrl(row.thumb ?? "");
    const chosen = isUsablePictureUrl(url) ? url : isUsablePictureUrl(thumb) ? thumb : "";
    if (!chosen) continue;
    if (typeof row.width === "number" && row.width > 0 && row.width < MIN_PICTURE_EDGE) continue;
    const preview = isUsablePictureUrl(thumb) ? thumb : chosen;
    if (seen.has(chosen) || seen.has(preview)) continue;
    seen.add(chosen);
    seen.add(preview);
    hits.push({
      id: chosen,
      url: chosen,
      thumbnail: preview,
      title: (row.title ?? "").trim(),
    });
    if (hits.length >= cap) break;
  }
  return hits;
}

export function mergeHits(current: ImageHit[], incoming: ImageHit[]): ImageHit[] {
  const seen = new Set<string>();
  for (const hit of current) {
    seen.add(hit.id);
    seen.add(hit.url);
    seen.add(hit.thumbnail);
  }
  const extra = incoming.filter((hit) => !seen.has(hit.id) && !seen.has(hit.url) && !seen.has(hit.thumbnail));
  return current.concat(extra);
}

export function creditFor(hit: ImageHit, lemma: string): Credit {
  let creator = "Google Images";
  try {
    creator = new URL(hit.url).hostname.replace(/^www\./, "");
  } catch {
    /* keep */
  }
  return {
    title: lemma,
    creator,
    license: "",
    licenseUrl: "",
    sourceUrl: hit.url,
  };
}
