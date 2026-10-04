import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { WORD_COUNT } from "@/data/words";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { getInstallPrompt, isStandalone, promptInstall, requestReminderPermission } from "@/lib/cards/notify";
import { useVault } from "@/lib/cards/store";
import { clockLabel } from "@/lib/cards/time";
import type { Settings as SettingsModel } from "@/lib/cards/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const ready = useVault((state) => state.ready);
  const error = useVault((state) => state.error);
  if (error) return <ProblemScreen message={error} />;
  if (!ready) return <BootScreen />;
  return <SettingsPanel />;
}

function SettingsPanel() {
  const settings = useVault((state) => state.settings);
  const saveSettings = useVault((state) => state.saveSettings);
  const [note, setNote] = useState("");
  const [standalone, setStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setCanInstall(Boolean(getInstallPrompt()));
  }, []);

  async function patch(next: Partial<SettingsModel>) {
    await saveSettings({ ...settings, ...next });
  }

  async function toggleReminders() {
    if (settings.reminders) {
      await patch({ reminders: false });
      setNote("");
      return;
    }
    const permission = await requestReminderPermission();
    if (permission === "granted") {
      await patch({ reminders: true });
      setNote(`One reminder at ${clockLabel(settings.reminderHour, settings.reminderMinute)}, only when a card is due.`);
      return;
    }
    if (permission === "denied") {
      setNote("This browser blocked reminders. You can still open the app whenever you like.");
      return;
    }
    setNote("This browser cannot show reminders.");
  }

  const timeValue = `${String(settings.reminderHour).padStart(2, "0")}:${String(settings.reminderMinute).padStart(2, "0")}`;

  return (
    <Frame dock>
      <header className="safe-top px-5">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Today
        </Link>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Settings</h1>
      </header>
      <main className="flex flex-1 flex-col gap-8 px-5 pt-6 pb-12">
        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-medium">Daily reminder</h2>
              <p className="mt-1 text-sm text-pretty text-muted">Only if something is due. No second nag.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reminders}
              aria-label="Daily reminder"
              onClick={() => void toggleReminders()}
              className={`relative h-8 w-14 shrink-0 rounded-full ${settings.reminders ? "bg-accent" : "bg-line"}`}
            >
              <span className={`absolute top-1 size-6 rounded-full bg-card ${settings.reminders ? "left-7" : "left-1"}`} />
            </button>
          </div>
          <label className="mt-4 flex items-center justify-between gap-4 text-sm">
            Hour
            <input
              type="time"
              value={timeValue}
              onChange={(event) => {
                const [hour, minute] = event.target.value.split(":").map(Number);
                if (Number.isNaN(hour) || Number.isNaN(minute)) return;
                void patch({ reminderHour: hour, reminderMinute: minute });
              }}
              className="min-h-12 rounded-full border border-line bg-card px-4 text-ink"
            />
          </label>
          {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
          <p className="mt-3 text-sm text-pretty text-muted">Android may delay a reminder after the phone has slept.</p>
        </section>
        <section className="flex flex-col gap-4 border-t border-line pt-6">
          <Stepper
            label="New words a day"
            value={settings.newCap}
            min={1}
            max={30}
            onChange={(newCap) => void patch({ newCap })}
          />
          <Stepper
            label="Scheduled minutes"
            value={settings.minutes}
            min={1}
            max={20}
            onChange={(minutes) => void patch({ minutes })}
          />
          <p className="text-sm text-pretty text-muted">
            This caps the scheduled review only. Practice and games do not use it, and they do not wait until tomorrow.
          </p>
        </section>
        {standalone ? null : (
          <section className="border-t border-line pt-6">
            <h2 className="text-base font-medium">Add to your home screen</h2>
            <p className="mt-2 text-sm text-pretty text-muted">
              In Chrome on Android, open the browser menu and choose Install app. It opens from the home screen, and the cards stay on the phone.
            </p>
            {canInstall ? (
              <button
                type="button"
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-paper"
                onClick={() => void promptInstall().then(() => setCanInstall(false))}
              >
                Install
              </button>
            ) : null}
          </section>
        )}
        <section className="border-t border-line pt-6 text-sm leading-relaxed text-pretty text-muted">
          <h2 className="text-base font-medium text-ink">About</h2>
          <p className="mt-3">
            The scheduled review stays short so the pile does not get abandoned. Practice, games, and the island are there whenever you want another pass. English on the front, Modern Standard Arabic on the back. The schedule stays on this phone.
          </p>
          <p className="mt-3">
            The open lists hold {WORD_COUNT.toLocaleString()} headwords. Order starts with the New General Service List by Charles Browne, Brent Culligan, and Joseph Phillips, CC BY-SA 4.0, then the Academic Word List, then an OpenSubtitles frequency list (MIT). Arabic comes from the Arabic Wiktionary, CC BY-SA 3.0, one sense per word. A few hundred everyday lines and examples were written for this app and replace the list gloss. You can edit any gloss. Nothing calls a translator.
          </p>
          <p className="mt-3">
            A word is not studied until you add it. Words you type yourself stay on this phone, with the list cards you pick.
          </p>
          <p className="mt-3">
            Scheduling is FSRS-6, aimed at about 90% recall on the day a word returns. Pictures, if you want one, come from Openverse. You confirm a single image. The file and its credit stay here.
          </p>
          <p className="mt-3">No account. No key. No payment.</p>
        </section>
      </main>
    </Frame>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card text-lg disabled:opacity-40"
        >
          –
        </button>
        <span className="w-8 text-center text-base tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card text-lg disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
