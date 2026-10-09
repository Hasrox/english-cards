/** Sync the built web app into the Android WebView assets.
 *
 * Mirrors the packaging flow of scripts/pack-android.mjs: fetch the SSR HTML
 * from a running preview server, strip grok/OG leftovers, refresh the hashed
 * assets — but keeps the existing icons/, manifest.webmanifest and sw.js
 * (brand/PWA metadata, unchanged; the service worker is inert in the WebView
 * shell). Run: start `vite preview`, then `node scripts/sync-android.mjs`.
 * Used by Phase 5 releases; see docs/IMPLEMENTATION-PHASES.md. */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = process.env.PACK_ORIGIN ?? "http://127.0.0.1:8081";
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = join(ROOT, "android", "app", "src", "main", "assets");
const STATIC = join(ROOT, ".vercel", "output", "static");

const res = await fetch(`${ORIGIN}/`);
if (!res.ok) throw new Error(`preview fetch failed: ${res.status}`);
let html = await res.text();

html = html
  .replace(/<meta name="twitter:card"[^>]*>/g, "")
  .replace(/<meta property="og:[^>]*>/g, "")
  .replace(/<script src="https:\/\/grok\.com\/[^"]*"[^>]*><\/script>/g, "")
  .replace('href="/__grok/manifest.webmanifest"', 'href="/manifest.webmanifest"')
  .replace('href="/__grok/icon-180.png"', 'href="/icons/icon-180.png"');

if (html.includes("grok.me") || html.includes("grok.com") || html.includes("/__grok/")) {
  throw new Error("cleaned HTML still contains grok references");
}
if (!html.includes("/assets/index-")) throw new Error("HTML has no hashed index script");

// Replace hashed assets wholesale (old hashes must not linger).
rmSync(join(OUT, "assets"), { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
cpSync(join(STATIC, "assets"), join(OUT, "assets"), { recursive: true });
cpSync(join(STATIC, "ui"), join(OUT, "ui"), { recursive: true });
cpSync(join(ROOT, "public", "favicon.svg"), join(OUT, "favicon.svg"));
// Sound effects are runtime-fetched by new Audio("/sounds/…") — without
// this the WebView 404s silently and the app is mute (the v5/v6 bug).
cpSync(join(ROOT, "public", "sounds"), join(OUT, "sounds"), { recursive: true });
// Countdown overlay art is runtime-fetched the same way, and sync runs before
// the art exists today, so copy it only when present (REQ-001..REQ-005).
if (existsSync(join(ROOT, "public", "videos"))) {
  cpSync(join(ROOT, "public", "videos"), join(OUT, "videos"), { recursive: true });
}
writeFileSync(join(OUT, "index.html"), html);

// Sanity: every /assets/… referenced by the HTML exists on disk.
const refs = [...html.matchAll(/\/assets\/[\w.-]+/g)].map((m) => m[0]);
const missing = refs.filter((r) => !existsSync(join(OUT, r.slice(1))));
if (missing.length) throw new Error(`HTML references missing files: ${missing.join(", ")}`);

console.log(
  `synced: index.html + ${readdirSync(join(OUT, "assets")).length} asset files, ${refs.length} HTML refs all present`,
);
