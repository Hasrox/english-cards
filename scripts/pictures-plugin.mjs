/**
 * Dev-only Google Pictures backend: a Playwright browser tab plus the same
 * harvest shim the phone WebView uses. Not packed into the APK.
 */
import { consentShim, harvestShim } from "./picture-shim.mjs";

const PREFIX = "/__pictures/";

function googleImagesUrl(query) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("tbm", "isch");
  url.searchParams.set("udm", "2");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("safe", "active");
  url.searchParams.set("tbs", "isz:m,itp:photo");
  url.searchParams.set("hl", "en");
  return url.toString();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body), "utf8");
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-length", String(data.byteLength));
  res.end(data);
}

export function picturesPlugin() {
  return {
    name: "english-cards:pictures",
    apply: "serve",
    configureServer(server) {
      /** @type {Promise<import("playwright").Page> | null} */
      let pagePromise = null;
      const seen = new Set();

      async function getPage() {
        if (!pagePromise) {
          pagePromise = (async () => {
            const { chromium } = await import("playwright");
            const launch = {
              headless: true,
              args: ["--disable-blink-features=AutomationControlled"],
            };
            let browser;
            try {
              browser = await chromium.launch({ ...launch, channel: "chrome" });
            } catch {
              browser = await chromium.launch(launch);
            }
            const context = await browser.newContext({
              viewport: { width: 390, height: 844 },
              locale: "en-US",
              userAgent:
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
            });
            await context.addInitScript(() => {
              Object.defineProperty(navigator, "webdriver", { get: () => undefined });
            });
            return context.newPage();
          })();
        }
        return pagePromise;
      }

      async function harvestNew() {
        const page = await getPage();
        await page.evaluate(consentShim);
        await delay(800);
        const raw = await page.evaluate(harvestShim);
        if (raw?.captcha) {
          const error = new Error("Google asked for a check. Try Search again.");
          error.code = "captcha";
          throw error;
        }
        const hits = [];
        for (const row of raw?.hits ?? []) {
          const url = String(row.url || "");
          const thumb = String(row.thumb || url);
          if (!url || seen.has(url) || seen.has(thumb)) continue;
          seen.add(url);
          seen.add(thumb);
          hits.push(row);
          if (hits.length >= 24) break;
        }
        return hits;
      }

      server.middlewares.use(async (req, res, next) => {
        const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
        if (!pathOnly.startsWith(PREFIX)) {
          next();
          return;
        }
        const method = (req.method ?? "GET").toUpperCase();
        const action = pathOnly.slice(PREFIX.length).replace(/\/$/, "");
        try {
          if (action === "search" && method === "POST") {
            const body = JSON.parse((await readBody(req)) || "{}");
            const query = String(body.q ?? "").trim();
            if (!query) {
              sendJson(res, 400, { message: "Type a word to search." });
              return;
            }
            seen.clear();
            const page = await getPage();
            await page.goto(googleImagesUrl(query), { waitUntil: "domcontentloaded", timeout: 25000 });
            await delay(1800);
            let hits = await harvestNew();
            if (hits.length < 8) {
              await delay(1800);
              hits = hits.concat(await harvestNew());
            }
            sendJson(res, 200, { hits });
            return;
          }
          if (action === "more" && method === "POST") {
            const page = await getPage();
            await page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
              window.scrollBy(0, 1400);
            });
            await delay(1600);
            const hits = await harvestNew();
            sendJson(res, 200, { hits });
            return;
          }
          if (action === "download" && method === "GET") {
            const full = new URL(req.url ?? "", "http://127.0.0.1");
            const target = full.searchParams.get("url") ?? "";
            if (!target.startsWith("https://")) {
              sendJson(res, 400, { message: "That picture address is not safe to save." });
              return;
            }
            const response = await fetch(target, {
              headers: {
                Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                Referer: "https://www.google.com/",
              },
              redirect: "follow",
            });
            if (!response.ok) {
              sendJson(res, 502, { message: "The picture could not be saved." });
              return;
            }
            const mime = response.headers.get("content-type") || "image/jpeg";
            if (!mime.startsWith("image/")) {
              sendJson(res, 502, { message: "The picture could not be saved." });
              return;
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.byteLength < 32 || bytes.byteLength > 2_500_000) {
              sendJson(res, 502, { message: "The picture could not be saved." });
              return;
            }
            res.statusCode = 200;
            res.setHeader("content-type", mime);
            res.setHeader("cache-control", "no-store");
            res.setHeader("content-length", String(bytes.byteLength));
            res.end(bytes);
            return;
          }
          if (action === "close" && method === "POST") {
            sendJson(res, 200, { ok: true });
            return;
          }
          sendJson(res, 404, { message: "Not found" });
        } catch (err) {
          console.error("[english-cards] picture search failed:", err);
          const message =
            err && typeof err === "object" && "code" in err && err.code === "captcha"
              ? err.message
              : "Search did not work. You can add a photo from this phone instead.";
          sendJson(res, 502, { message });
        }
      });
    },
  };
}
