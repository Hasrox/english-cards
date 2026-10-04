/**
 * Build a folder you can copy onto a phone and install as a PWA.
 * It does not call grok.me. Chrome still needs the folder served on the
 * phone (serve.py); a raw file:// open cannot install a service worker.
 */
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "artifacts", "english-cards-android");
const ORIGIN = process.env.PACK_ORIGIN ?? "http://127.0.0.1:8081";

const html = await fetchText(`${ORIGIN}/`);
const cleaned = html
  .replace(/<meta name="twitter:card"[^>]*>/g, "")
  .replace(/<meta property="og:[^"]+"[^>]*>/g, "")
  .replace(/<script src="https:\/\/grok\.com\/[^"]*"[^>]*><\/script>/g, "")
  .replace('href="/__grok/manifest.webmanifest"', 'href="/manifest.webmanifest"')
  .replace('href="/__grok/icon-180.png"', 'href="/icons/icon-180.png"');

if (cleaned.includes("grok.me") || cleaned.includes("grok.com")) {
  throw new Error("Packaged HTML still points at grok.");
}

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, "assets"), { recursive: true });
await mkdir(join(OUT, "icons"), { recursive: true });
await writeFile(join(OUT, "index.html"), cleaned);
await cp(join(ROOT, ".vercel/output/static/assets"), join(OUT, "assets"), { recursive: true });
await cp(join(ROOT, ".vercel/output/static/ui"), join(OUT, "ui"), { recursive: true });
await cp(join(ROOT, "public/favicon.svg"), join(OUT, "favicon.svg"));

await new Promise((resolve, reject) => {
  const py = spawn("python3", ["-"], { stdio: ["pipe", "inherit", "inherit"] });
  py.on("error", reject);
  py.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`icon script ${code}`))));
  py.stdin.end(`
from PIL import Image, ImageDraw
import os
out = ${JSON.stringify(join(OUT, "icons"))}
os.makedirs(out, exist_ok=True)
def icon(size, path):
    img = Image.new("RGB", (size, size), "#1C1916")
    d = ImageDraw.Draw(img)
    m = size * 0.12
    card = [m, m * 0.7, size - m, size - m * 0.7]
    r = size * 0.08
    d.rounded_rectangle(card, radius=r, fill="#F3EEE6")
    spine = [card[0], card[1], card[0] + (card[2] - card[0]) * 0.28, card[3]]
    d.rounded_rectangle(spine, radius=r, fill="#1B6B58")
    d.rectangle([spine[2] - r, card[1], spine[2], card[3]], fill="#1B6B58")
    x = spine[2] + size * 0.08
    y1 = card[1] + (card[3] - card[1]) * 0.32
    y2 = card[1] + (card[3] - card[1]) * 0.52
    h = max(2, int(size * 0.045))
    d.rounded_rectangle([x, y1, card[2] - size * 0.1, y1 + h], radius=h / 2, fill="#1C1916")
    d.rounded_rectangle([x, y2, x + (card[2] - x) * 0.62, y2 + h], radius=h / 2, fill="#1B6B58")
    img.save(path, "PNG")
icon(180, os.path.join(out, "icon-180.png"))
icon(192, os.path.join(out, "icon-192.png"))
icon(512, os.path.join(out, "icon-512.png"))
`);
});

const manifest = {
  name: "English Cards",
  short_name: "Cards",
  description: "English words, Arabic on the back. Stays on this phone.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#f3eee6",
  theme_color: "#1c1916",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    { src: "/icons/icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
  ],
};
await writeFile(join(OUT, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

const files = await walk(OUT);
const precache = files.filter((file) => file !== "sw.js").map((file) => `/${file}`);
await writeFile(join(OUT, "sw.js"), serviceWorker(precache));

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

async function walk(dir, prefix = "") {
  const names = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of names) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
}

function serviceWorker(precache) {
  return `const CACHE = "english-cards-android-v1";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") void cache.put(request, response.clone());
        return response;
      } catch {
        if (request.mode === "navigate") {
          const home = await cache.match("/index.html");
          if (home) return home;
        }
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "english-cards-due") return;
  event.waitUntil(notifyIfDue());
});

function openCardsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("english-cards");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getMeta(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function notifyIfDue() {
  const db = await openCardsDb();
  const settings = await getMeta(db, "settings");
  const now = new Date();
  if (!settings || settings.reminders === false) return;
  if (typeof settings.reminderHour === "number" && now.getHours() !== settings.reminderHour) return;
  const rows = await getAll(db, "progress");
  const due = rows.filter((row) => row && !row.retired && row.card && row.card.state !== 0 && row.card.due <= Date.now()).length;
  if (due < 1) return;
  await self.registration.showNotification("English Cards", {
    body: due === 1 ? "1 card is due." : due + " cards are due.",
    tag: "english-cards-due",
  });
}
`;
}

const SERVE = `#!/usr/bin/env python3
"""Serve this folder on the phone so Chrome can install it."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        local = self.translate_path(path)
        if path != "/" and not os.path.isfile(local):
            self.path = "/index.html"
        return super().do_GET()

if __name__ == "__main__":
    host, port = "127.0.0.1", 8080
    print(f"English Cards at http://{host}:{port}")
    print("Open that address in Chrome, then choose Install app.")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
`;

const INSTALL = `English Cards — files for the phone
==================================

This folder is the whole app. Nothing in it calls grok.me.
Cards, pictures, and the schedule stay in the browser on the phone.

Chrome cannot install a PWA by tapping a file in Downloads.
It can install one that is served on the phone, at 127.0.0.1.

1. Copy this whole folder onto the phone (USB, Drive, or a file app).
2. Install Termux (F-Droid or Play Store).
3. In Termux, allow storage if it asks, then:

     termux-setup-storage
     pkg install python
     cd ~/storage/downloads/english-cards-android
     python serve.py

   Use the real folder name if you put it somewhere else.
4. Open Chrome and go to http://127.0.0.1:8080
5. Wait until the home screen of the app appears.
6. Chrome menu → Install app, or Add to Home screen.
7. Open English Cards from the home screen.
   You can stop Termux after that. The installed copy is on the phone.
   Later reviews work with the network off.

If Install app is missing, use the app once, then open the Chrome menu again.

The type in the app may load a font from Google the first time you are online.
If that is blocked, the phone's own fonts are used. The words do not need it.
`;

await writeFile(join(OUT, "serve.py"), SERVE);
await writeFile(join(OUT, "HOW-TO-INSTALL.txt"), INSTALL);

const zipPath = join(ROOT, "artifacts", "english-cards-android.zip");
await rm(zipPath, { force: true });
await zipDir(OUT, zipPath);
console.log(`packed ${precache.length} files -> ${zipPath}`);

function zipDir(dir, dest) {
  const python = `
import os, sys, zipfile
src, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(src):
        for name in files:
            path = os.path.join(base, name)
            z.write(path, os.path.relpath(path, src))
`;
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-c", python, dir, dest], { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`zip ${code}`))));
  });
}
