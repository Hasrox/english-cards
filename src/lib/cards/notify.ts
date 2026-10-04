import type { Settings } from "./types";
import { msUntilHour } from "./time";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let timer = 0;
let deferredInstall: BeforeInstallPromptEvent | null = null;

export function listenForInstall(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredInstall;
}

export async function promptInstall(): Promise<void> {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  deferredInstall = null;
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function registerWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export async function requestReminderPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function paintBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) void nav.setAppBadge?.(count);
  else void nav.clearAppBadge?.();
}

async function showDue(count: number): Promise<void> {
  const body = count === 1 ? "1 card is due." : `${count} cards are due.`;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification("English Cards", { body, tag: "english-cards-due" });
      return;
    }
  } catch {
    // Fall through to the page notification.
  }
  new Notification("English Cards", { body, tag: "english-cards-due" });
}

export function armReminder(read: () => { settings: Settings; due: number }): void {
  window.clearTimeout(timer);
  if (typeof Notification === "undefined") return;
  const { settings } = read();
  if (!settings.reminders || Notification.permission !== "granted") return;
  const delay = msUntilHour(settings.reminderHour, settings.reminderMinute);
  timer = window.setTimeout(() => {
    const snap = read();
    if (
      snap.settings.reminders &&
      snap.due > 0 &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      void showDue(snap.due);
    }
    armReminder(read);
  }, delay);
}

export async function registerPeriodicSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const periodic = (
      registration as ServiceWorkerRegistration & {
        periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
      }
    ).periodicSync;
    if (!periodic) return;
    await periodic.register("english-cards-due", { minInterval: 12 * 60 * 60 * 1000 });
  } catch {
    // Periodic sync is optional. The in-app timer still covers an open app.
  }
}
