const ART: Record<string, string> = {
  food: "/ui/cat-food.jpg",
  home: "/ui/cat-home.jpg",
  body: "/ui/cat-body.jpg",
  animals: "/ui/cat-animals.jpg",
  nature: "/ui/cat-nature.jpg",
  people: "/ui/cat-people.jpg",
  town: "/ui/cat-town.jpg",
  feelings: "/ui/cat-feelings.jpg",
  looks: "/ui/cat-looks.jpg",
  time: "/ui/cat-time.jpg",
  actions: "/ui/cat-actions.jpg",
  work: "/ui/cat-work.jpg",
  study: "/ui/cat-study.jpg",
  language: "/ui/cat-language.jpg",
  everyday: "/ui/cat-other.jpg",
  common: "/ui/cat-other.jpg",
  mine: "/ui/cat-mine.jpg",
  slipping: "/ui/cat-slipping.jpg",
  top100: "/ui/cat-top100.jpg",
  top500: "/ui/cat-top500.jpg",
};

export function categoryArt(id: string): string {
  const topic = id === "__slip" ? "slipping" : (id.split(":")[0] ?? id);
  return ART[topic] ?? ART.everyday;
}
