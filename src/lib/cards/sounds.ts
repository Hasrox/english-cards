const SRC = {
  correct: "/sounds/correct.mp3",
  incorrect: "/sounds/incorrect.mp3",
  done: "/sounds/done.mp3",
  full: "/sounds/full-mark.mp3",
} as const;

export type EffectName = keyof typeof SRC;

export function playEffect(name: EffectName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(SRC[name]);
  void audio.play().catch(() => undefined);
  return audio;
}

export function playFinish(perfect: boolean): void {
  const done = playEffect("done");
  if (!perfect) return;
  let played = false;
  const full = () => {
    if (played) return;
    played = true;
    playEffect("full");
  };
  if (!done) {
    full();
    return;
  }
  done.addEventListener("ended", full, { once: true });
  window.setTimeout(full, 1600);
}
