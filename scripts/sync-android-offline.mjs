/** Offline Android asset sync — no live preview server required.
 * Copies the latest Vite build into android/app/src/main/assets and
 * rewrites index.html to the new hashed bundles.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = join(ROOT, "android", "app", "src", "main", "assets");
const STATIC = join(ROOT, ".vercel", "output", "static");
const ASSETS = join(STATIC, "assets");

if (!existsSync(ASSETS)) {
  throw new Error("Missing .vercel/output/static/assets — run vite build first");
}

const files = readdirSync(ASSETS);
const css = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));
const indexJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const lexiconJs = files.find((f) => f.startsWith("lexicon-") && f.endsWith(".js"));

if (!css || !indexJs) {
  throw new Error(`Could not find hashed bundles in ${ASSETS}: ${files.join(", ")}`);
}

// Prefer the previous Android shell HTML if present (UTF-8 or UTF-16).
let previous = "";
const prevPath = join(OUT, "index.html");
if (existsSync(prevPath)) {
  const buf = readFileSync(prevPath);
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    previous = buf.toString("utf16le");
  } else if (buf[0] === 0xfe && buf[1] === 0xff) {
    previous = Buffer.from(buf).swap16().toString("utf16le");
  } else {
    previous = buf.toString("utf8").replace(/^\uFEFF/, "");
  }
}

const titleMatch = previous.match(/<title>([^<]*)<\/title>/i);
const title = titleMatch?.[1]?.trim() || "English Cards";

const modulepreload = lexiconJs
  ? `    <link rel="modulepreload" href="/assets/${lexiconJs}"/>\n`
  : "";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1c1916" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/icon-180.png" />
    <title>${title}</title>
    <link rel="stylesheet" href="/assets/${css}" />
${modulepreload}    <script type="module" src="/assets/${indexJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

if (html.includes("grok.me") || html.includes("grok.com") || html.includes("/__grok/")) {
  throw new Error("generated HTML still contains grok references");
}

rmSync(join(OUT, "assets"), { recursive: true, force: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
cpSync(ASSETS, join(OUT, "assets"), { recursive: true });

if (existsSync(join(STATIC, "ui"))) {
  cpSync(join(STATIC, "ui"), join(OUT, "ui"), { recursive: true });
}
cpSync(join(ROOT, "public", "favicon.svg"), join(OUT, "favicon.svg"));
cpSync(join(ROOT, "public", "sounds"), join(OUT, "sounds"), { recursive: true });
if (existsSync(join(ROOT, "public", "videos"))) {
  cpSync(join(ROOT, "public", "videos"), join(OUT, "videos"), { recursive: true });
}

writeFileSync(join(OUT, "index.html"), html, "utf8");

const refs = [...html.matchAll(/\/assets\/[\w.-]+/g)].map((m) => m[0]);
const missing = refs.filter((r) => !existsSync(join(OUT, r.slice(1))));
if (missing.length) throw new Error(`HTML references missing files: ${missing.join(", ")}`);

console.log(
  `offline-synced: index.html + ${readdirSync(join(OUT, "assets")).length} asset files, ${refs.length} HTML refs ok`,
);
console.log(`  css=${css}`);
console.log(`  index=${indexJs}`);
if (lexiconJs) console.log(`  lexicon=${lexiconJs}`);
