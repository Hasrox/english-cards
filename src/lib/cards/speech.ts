type AndroidSpeech = { speak: (text: string) => void };

function phoneVoice(): AndroidSpeech | null {
  const host = (window as unknown as { AndroidSpeech?: AndroidSpeech }).AndroidSpeech;
  if (!host || typeof host.speak !== "function") return null;
  return host;
}

export function speakEnglish(text: string): void {
  const spoken = text.trim();
  if (!spoken || typeof window === "undefined") return;
  const phone = phoneVoice();
  if (phone) {
    phone.speak(spoken);
    return;
  }
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("en"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function canSpeak(): boolean {
  return phoneVoice() != null || (typeof window !== "undefined" && "speechSynthesis" in window);
}