import type { Credit } from "./types";

export type ImageHit = {
  id: string;
  title: string;
  creator: string;
  thumbnail: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  credit: Credit;
};

type ApiImage = {
  id?: string;
  title?: string;
  creator?: string;
  thumbnail?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  foreign_landing_url?: string;
  url?: string;
};

const LICENSE_NAMES: Record<string, string> = {
  by: "CC BY",
  "by-sa": "CC BY-SA",
  "by-nc": "CC BY-NC",
  "by-nc-sa": "CC BY-NC-SA",
  "by-nd": "CC BY-ND",
  "by-nc-nd": "CC BY-NC-ND",
  cc0: "CC0",
  pdm: "Public domain",
};

function licenseName(license: string, version: string | undefined): string {
  const base = LICENSE_NAMES[license] ?? license.toUpperCase();
  if (!version || !license.startsWith("by")) return base;
  return `${base} ${version}`;
}

function cleanThumb(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("format");
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function searchPictures(query: string): Promise<ImageHit[]> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "12");
  url.searchParams.set("mature", "false");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(response.status === 429 ? "Openverse is busy. Try again in a minute." : "Openverse did not answer.");
  }
  const body = (await response.json()) as { results?: ApiImage[] };
  const hits: ImageHit[] = [];
  for (const row of body.results ?? []) {
    if (!row.id || !row.thumbnail) continue;
    const thumbnail = cleanThumb(row.thumbnail);
    if (!thumbnail.startsWith("https://")) continue;
    const license = licenseName(row.license ?? "cc", row.license_version);
    const creator = row.creator?.trim() || "Unknown";
    const sourceUrl = row.foreign_landing_url || row.license_url || thumbnail;
    hits.push({
      id: row.id,
      title: row.title?.trim() || query,
      creator,
      thumbnail,
      license,
      licenseUrl: row.license_url || sourceUrl,
      sourceUrl,
      credit: {
        title: row.title?.trim() || query,
        creator,
        license,
        licenseUrl: row.license_url || sourceUrl,
        sourceUrl,
      },
    });
  }
  return hits;
}

export async function downloadThumb(thumbnail: string): Promise<Blob> {
  if (!thumbnail.startsWith("https://api.openverse.org/")) {
    throw new Error("That picture address is not from Openverse.");
  }
  const response = await fetch(thumbnail);
  if (!response.ok) throw new Error("The picture could not be saved.");
  const blob = await response.blob();
  if (blob.size < 32) throw new Error("The picture file was empty.");
  return blob;
}
