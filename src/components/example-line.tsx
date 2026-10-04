export function exampleParts(example: string, highlight: string): Array<{ text: string; mark: boolean }> {
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = example.match(new RegExp(`\\b(${escaped})\\b`, "i"));
  if (!match || match.index == null) return [{ text: example, mark: false }];
  const word = match[1] ?? match[0];
  const start = match.index;
  return [
    { text: example.slice(0, start), mark: false },
    { text: word, mark: true },
    { text: example.slice(start + word.length), mark: false },
  ].filter((part) => part.text.length > 0);
}

export function ExampleLine({ example, highlight }: { example: string; highlight: string }) {
  const parts = exampleParts(example, highlight);
  return (
    <p className="text-pretty text-base leading-relaxed text-ink">
      {parts.map((part, index) =>
        part.mark ? (
          <mark key={index} className="bg-transparent font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}
