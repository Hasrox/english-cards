import { useEffect, useRef, useState } from "react";
import { downloadThumb, searchPictures, type ImageHit } from "@/lib/cards/openverse";
import { useVault } from "@/lib/cards/store";
import { GhostButton, PrimaryButton } from "./chrome";

export function PicturePicker({
  wordId,
  lemma,
  open,
  onClose,
}: {
  wordId: string;
  lemma: string;
  open: boolean;
  onClose: () => void;
}) {
  const setPicture = useVault((state) => state.setPicture);
  const [query, setQuery] = useState(lemma);
  const [hits, setHits] = useState<ImageHit[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery(lemma);
    void runSearch(lemma);
  }, [open, lemma]);

  async function runSearch(term: string) {
    const token = ++request.current;
    setStatus("loading");
    setMessage("");
    setHits([]);
    try {
      const next = await searchPictures(term.trim() || lemma);
      if (request.current !== token) return;
      setHits(next);
      setStatus("ready");
      if (next.length === 0) setMessage("Nothing useful came back. The example can carry this card.");
    } catch (error) {
      if (request.current !== token) return;
      setStatus("error");
      setMessage(
        error instanceof Error
          ? `${error.message} You can add a photo from this phone instead.`
          : "No connection. You can add a photo from this phone instead.",
      );
    }
  }

  async function choose(hit: ImageHit) {
    setSaving(hit.id);
    setMessage("");
    try {
      const blob = await downloadThumb(hit.thumbnail);
      await setPicture(wordId, blob, hit.credit);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The picture could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file.");
      return;
    }
    setSaving("file");
    try {
      await setPicture(wordId, file, null);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The photo could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picture-title"
        className="safe-bottom flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper text-ink sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="picture-title" className="font-display text-2xl">
            A picture for {lemma}
          </h2>
          <GhostButton type="button" onClick={onClose}>
            Close
          </GhostButton>
        </div>
        <form
          className="flex gap-2 px-5 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search Openverse"
            className="min-h-12 flex-1 rounded-full border border-line bg-card px-4 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <PrimaryButton type="submit" className="px-4" disabled={status === "loading"}>
            Search
          </PrimaryButton>
        </form>
        <p className="px-5 pt-3 text-sm text-muted">Openverse. Pick one. It stays on this phone, with the credit.</p>
        {message ? <p className="px-5 pt-3 text-sm text-ink">{message}</p> : null}
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto px-5 py-4">
          {status === "loading"
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-2xl bg-line" />
              ))
            : hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void choose(hit)}
                  className="overflow-hidden rounded-2xl border border-line bg-card text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                  <img src={hit.thumbnail} alt={hit.title} className="aspect-square w-full object-cover" />
                  <span className="block px-2 py-2 text-xs leading-snug text-muted">
                    {saving === hit.id ? "Saving…" : `${hit.creator} · ${hit.license}`}
                  </span>
                </button>
              ))}
        </div>
        <div className="flex gap-2 border-t border-line px-5 py-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
          <GhostButton type="button" className="flex-1 border border-line bg-card" onClick={() => fileRef.current?.click()}>
            Photo from this phone
          </GhostButton>
          <GhostButton type="button" className="flex-1" onClick={onClose}>
            No picture
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
