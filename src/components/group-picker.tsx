import { categoryArt } from "@/lib/cards/category-art";
import { CATEGORY_ORDER, topicLabel } from "@/lib/cards/groups";

export function GroupPicker({ value, onChange }: { value: string; onChange: (topic: string) => void }) {
  return (
    <div>
      <p className="text-sm text-muted">Which group?</p>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {CATEGORY_ORDER.map((id) => {
          const selected = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(id)}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <img
                src={categoryArt(id)}
                alt=""
                className={`size-14 rounded-full object-cover ${selected ? "ring-4 ring-accent" : ""}`}
              />
              <span className={`text-center text-xs leading-tight ${selected ? "font-medium text-ink" : "text-muted"}`}>
                {topicLabel(id)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
