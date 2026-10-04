const CACHE = "english-cards-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
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
  if (url.pathname.startsWith("/__grok/")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await caches.match("/");
          if (home) return home;
        }
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }),
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
    const request = indexedDB.open("english-cards", 1);
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
    body: due === 1 ? "1 card is due." : `${due} cards are due.`,
    tag: "english-cards-due",
  });
}
