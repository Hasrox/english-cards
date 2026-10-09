import { useEffect, useRef, useState } from "react";
import { GhostButton, PrimaryButton } from "./chrome";
import { creditFor, mergeHits, type ImageHit } from "@/lib/cards/picture-hits";
import {
  closePictureSearch,
  downloadPicture,
  morePictures,
  pictureSearchAvailable,
  searchPictures,
} from "@/lib/cards/picture-search";
import { useVault } from "@/lib/cards/store";

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
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unavailable">("ready");
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const searched = useRef(false);

  useEffect(() => {
    if (!open) {
      closePictureSearch();
      return;
    }
    setQuery(lemma);
    setHits([]);
    setMessage("");
    setLoadingMore(false);
    setSaving(null);
    searched.current = false;
    if (!pictureSearchAvailable()) {
      setStatus("unavailable");
      setMessage("Search works in the phone app. You can add a photo from this phone instead.");
      return;
    }
    void runSearch(lemma);
    return () => {
      closePictureSearch();
    };
  }, [open, lemma]); // eslint-disable-line react-hooks/exhaustive-deps -- search on open/lemma only

  async function runSearch(term: string) {
    const token = ++request.current;
    setStatus("loading");
    setMessage("Looking up pictures…");
    setLoadingMore(false);
    try {
      const next = await searchPictures(term.trim() || lemma);
      if (request.current !== token) return;
      searched.current = true;
      setHits(next);
      setStatus("ready");
      setMessage(
        next.length === 0 ? "Nothing useful came back. You can add a photo from this phone instead." : "",
      );
    } catch (error) {
      if (request.current !== token) return;
      searched.current = false;
      setStatus("error");
      setHits([]);
      setMessage(error instanceof Error ? error.message : "Search did not work. You can add a photo from this phone instead.");
    }
  }

  async function runMore() {
    if (loadingMore || status === "loading") return;
    setLoadingMore(true);
    setMessage("");
    try {
      const next = await morePictures();
      setHits((current) => mergeHits(current, next));
      if (next.length === 0) setMessage("No more pictures right now.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load more pictures.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function choose(hit: ImageHit) {
    setSaving(hit.id);
    setMessage("");
    try {
      let blob: Blob;
      try {
        blob = await downloadPicture(hit.url);
      } catch (first) {
        if (hit.thumbnail === hit.url) throw first;
        blob = await downloadPicture(hit.thumbnail);
      }
      await setPicture(wordId, blob, creditFor(hit, lemma));
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

  const canSearch = status !== "unavailable";
  const canMore = canSearch && searched.current && status !== "loading" && hits.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/40" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picture-title"
        className="flex h-dvh w-full max-w-md flex-col bg-paper text-ink"
      >
        <div className="safe-top flex items-center justify-between px-5 pt-2">
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
            if (!canSearch || status === "loading") return;
            void runSearch(query);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search pictures"
            className="min-h-12 flex-1 rounded-full border border-line bg-card px-4 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
          <PrimaryButton type="submit" className="px-4" disabled={!canSearch || status === "loading"}>
            Search
          </PrimaryButton>
        </form>
        <p className="px-5 pt-3 text-sm text-muted">
          {status === "unavailable"
            ? "Pick a photo from this phone, or search on the phone app."
            : "Google pictures. Pick one. It stays on this phone."}
        </p>
        {message ? <p className="px-5 pt-3 text-sm text-ink">{message}</p> : null}
        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-5 py-4">
          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              disabled={saving !== null}
              onClick={() => void choose(hit)}
              className="overflow-hidden rounded-2xl border border-line bg-card text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              <img
                src={hit.thumbnail}
                alt={hit.title || lemma}
                referrerPolicy="no-referrer"
                className="aspect-square w-full object-cover"
              />
              <span className="block px-2 py-2 text-xs leading-snug text-muted">
                {saving === hit.id ? "Saving…" : "Use this picture"}
              </span>
            </button>
          ))}
        </div>
        <div className="safe-bottom flex flex-col gap-2 border-t border-line px-5 pt-3 pb-4">
          {canMore ? (
            <GhostButton
              type="button"
              className="w-full border border-line bg-card"
              disabled={loadingMore || saving !== null}
              onClick={() => void runMore()}
            >
              {loadingMore ? "Loading more…" : "Load more"}
            </GhostButton>
          ) : null}
          <div className="flex gap-2">
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
            <GhostButton
              type="button"
              className="flex-1 border border-line bg-card"
              disabled={saving !== null}
              onClick={() => fileRef.current?.click()}
            >
              Photo from this phone
            </GhostButton>
            <GhostButton type="button" className="flex-1" onClick={onClose}>
              No picture
            </GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
