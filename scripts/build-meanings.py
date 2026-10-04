"""Assign a meaning group to open-list headwords and write src/data/meanings.ts."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

ROOT = Path("/workspace")
text = (ROOT / "src/data/lexicon.ts").read_text()
rows = re.findall(r'\["([^"]+)", "([^"]+)", "[^"]*", \d+, "([^"]+)", [01]\]', text)
lex = {w: (p, s) for w, p, s in rows}

# First matching group wins. Concrete kid groups come before leftovers.
GROUPS: list[tuple[str, str]] = [
    (
        "food",
        """
        food water bread rice milk tea coffee fruit apple meat fish egg eggs chicken beef pork
        salt sugar oil butter cheese soup meal breakfast lunch dinner vegetable tomato potato
        onion banana orange juice cake chocolate honey flour bean beans corn pepper salad
        sandwich pizza wine beer bottle menu taste cook eat drink hungry thirst thirsty
        delicious taste recipe
        apple grape lemon lime peach pear berry strawberry cream yogurt ice snack biscuit
        cookie candy sweet sugar spice sauce soup stew roast grill bake boil fry
        breakfast cereal toast jam butter cheese cream pie pudding nut almond rice wheat
        grain crop harvest farm mill butcher bakery grocery market butcher
        bacon ham sausage steak shrimp crab oyster lobster salmon tuna
        cucumber carrot cabbage lettuce garlic ginger mushroom pea peanut
        vinegar mustard ketchup syrup cocoa vanilla
        lunch dinner supper picnic barbecue feast diet nutrition calorie vitamin
        appetite chew swallow bite sip pour spill
        """,
    ),
    (
        "animals",
        """
        animal animals bird dog cat fish horse cow sheep pig mouse rat lion tiger bear wolf
        fox deer duck hen goat camel donkey monkey ape elephant whale dolphin shark snake
        frog rabbit insect bee ant fly mosquito spider butterfly pet puppy kitten calf
        lamb cub nest wing feather fur tail horn paw claw beak fin scale egg shell
        wildlife zoo farm cattle poultry herd flock pack prey predator hunt bark roar
        meow neigh chirp crawl swim fly creature beast mammal reptile amphibian
        owl eagle hawk crow pigeon parrot penguin ostrich peacock
        cow bull ox buffalo zebra giraffe hippo rhino crocodile alligator lizard turtle
        tortoise whale seal otter beaver squirrel raccoon skunk hedgehog
        worm snail crab lobster shrimp octopus squid jellyfish
        chicken rooster turkey goose swan
        """,
    ),
    (
        "body",
        """
        body eye head face foot feet heart hair mouth doctor hospital hand arm leg
        finger thumb toe knee elbow shoulder neck back chest stomach belly blood bone
        skin ear nose tooth teeth tongue lip brain lung muscle nerve health pain
        sick illness disease fever cough breath breathe bleed wound injury bandage
        medicine pill drug nurse patient surgery operation clinic
        throat waist hip wrist ankle heel palm fist chin cheek forehead eyebrow
        eyelash beard moustache muscle bone joint skull rib spine
        sight hearing smell taste touch vision blind deaf
        pregnant birth baby pregnant pulse temperature symptom
        """,
    ),
    (
        "home",
        """
        home house room table chair bed window kitchen door garden yard roof wall floor
        ceiling stair stairs bathroom bedroom hall closet cupboard drawer shelf lamp
        clock mirror curtain carpet rug blanket pillow sheet towel soap toothbrush
        key lock gate fence porch balcony basement attic garage
        clothes shirt shoe dress coat hat pants sock jacket skirt boot glove pocket
        button cloth clothing wear uniform belt scarf tie jeans sweater
        furniture sofa couch desk stove oven fridge refrigerator sink tap faucet
        bath shower toilet washing machine dishwasher vacuum broom mop
        cup plate bowl fork spoon knife glass pot pan kettle
        toy doll ball game bedroom kitchen
        apartment flat building neighbor neighbour household chore
        """,
    ),
    (
        "town",
        """
        city street road town village shop store market station bus train car taxi
        ticket map bag airport hotel restaurant cafe park bridge traffic light
        police hospital school library museum church mosque temple bank post office
        hospital cinema theater theatre cinema mall supermarket
        bus train tram subway metro taxi bicycle bike motorcycle truck van
        driver passenger traffic jam accident sign signal crosswalk sidewalk pavement
        building tower square plaza neighborhood district suburb downtown
        address direction north south east west corner block avenue highway
        travel trip journey tour tourist visitor passport luggage suitcase
        country village capital border port harbor harbour island beach
        """,
    ),
    (
        "nature",
        """
        tree river sea sun rain wind world sky cloud snow ice storm thunder lightning
        mountain hill forest wood field grass flower plant leaf root seed garden
        island beach coast shore wave tide moon star planet space
        weather warm cool season spring summer autumn winter fall
        fire air environment nature pollution climate
        morning night
        animal is elsewhere
        forest jungle desert valley cave waterfall stream creek
        sunrise sunset dawn dusk shadow shade
        """,
    ),
    (
        "looks",
        """
        good bad big small old young new long short high low fast slow
        clean empty full white black red blue green dark beautiful pretty
        hard easy strong weak heavy loud quiet round straight fresh dirty wet dry
        soft cheap expensive safe dangerous ready free true wrong right same different
        important special real clear poor rich dead alive natural modern serious
        great wonderful strange deep tall wide narrow thick thin bright dull
        huge tiny enormous sharp smooth rough sweet sour bitter
        """,
    ),
    (
        "people",
        """
        people person child family friend woman man mother father parent baby boy girl
        brother sister husband wife son daughter king queen doctor teacher student
        neighbor neighbour human guy lady gentleman kid adult child children
        grandmother grandfather grandma grandpa uncle aunt cousin nephew niece
        mr mrs miss sir madam person somebody someone nobody everybody
        guest host stranger enemy partner couple marriage wedding
        boy girl man woman lady gentleman
        name age birthday
        """,
    ),
    (
        "feelings",
        """
        love feel happy sad angry afraid sorry tired glad proud worry worried lonely
        excited calm nervous bored interest interested surprise surprised upset kind
        fear hope wish hate anger joy smile laugh cry tears mood emotion feeling
        pleasure pain comfort trust respect shame guilt envy jealous
        afraid scared frightened worried anxious relaxed confident shy brave
        lonely alone miss want like enjoy fun funny
        thank please sorry excuse
        dream sleep nightmare
        """,
    ),
    (
        "time",
        """
        time day night morning week month year hour minute second today tomorrow
        yesterday now then soon later early late again always never sometimes often
        usually seldom already still yet before after during while until since
        clock watch calendar date season moment past future present
        monday tuesday wednesday thursday friday saturday sunday weekend
        january february march april may june july august september october november december
        birthday holiday vacation age century decade daily weekly monthly yearly
        dawn dusk noon midnight evening afternoon tonight
        begin start finish end stop wait delay hurry rush
        """,
    ),
    (
        "work",
        """
        job office work money pay salary wage boss manager employee worker staff
        company business factory farm career profession trade skill
        meeting report project task duty hire fire employ employment
        customer client contract deal price cost profit loss tax
        bank account cash coin bill cheque check credit debt
        machine tool equipment computer phone email
        shop sell buy trade market economy industry
        police soldier army nurse teacher doctor farmer driver cook
        """,
    ),
    (
        "study",
        """
        school teacher student book learn read write study class lesson homework test
        exam grade university college education science math mathematics history
        language word sentence letter alphabet number question answer idea story
        library pencil pen paper page chapter subject course
        research theory method data analysis experiment
        academic academic vocabulary
        """,
    ),
]

# Words that must not be stolen by a loose group.
FORCE = {
    "fish": "animals",
    "chicken": "food",
    "egg": "food",
    "water": "food",
    "school": "study",
    "book": "study",
    "teacher": "study",
    "student": "study",
    "doctor": "body",
    "hospital": "body",
    "money": "work",
    "car": "town",
    "bus": "town",
    "train": "town",
    "game": "home",
    "world": "nature",
    "hot": "food",
    "cold": "nature",
    "green": "looks",
    "blue": "looks",
    "red": "looks",
    "black": "looks",
    "white": "looks",
    "strong": "looks",
    "dark": "looks",
}

FUNCTION = {"determiner", "preposition", "conjunction", "pronoun", "number"}

assigned: dict[str, str] = {}
for topic, blob in GROUPS:
    for raw in blob.split():
        w = raw.strip().lower()
        if not w or w in {"is", "elsewhere"}:
            continue
        if w in lex and w not in assigned and w not in FORCE:
            assigned[w] = topic

for w, topic in FORCE.items():
    if w in lex:
        assigned[w] = topic

final: dict[str, str] = {}
for w, (pos, source) in lex.items():
    if w in assigned:
        final[w] = assigned[w]
        continue
    if pos in FUNCTION:
        final[w] = "language"
        continue
    if pos == "verb":
        final[w] = "actions"
        continue
    if source == "awl":
        final[w] = "study"
        continue
    final[w] = "everyday"

LITTLE = """
not no just only also how well even here yes maybe very too really why
however together almost ever perhaps especially therefore instead exactly
below above generally completely directly extremely currently twice relatively
necessarily slowly definitely previously surely equally personally approximately
partly originally whenever rarely forever wherever firstly kindly
""".split()
for w in LITTLE:
    if final.get(w) == "everyday":
        final[w] = "language"

counts = Counter(final.values())
print("counts", dict(counts))
everyday_nouns = [w for w, (p, s) in lex.items() if final[w] == "everyday" and p == "noun"]
print("everyday nouns", len(everyday_nouns))
print(" ".join(sorted(everyday_nouns)[:180]))
print("---ADJ---")
everyday_adj = [w for w, (p, s) in lex.items() if final[w] == "everyday" and p == "adjective"]
print(" ".join(sorted(everyday_adj)[:80]))

lines = ["/** Meaning group for each open-list headword. Generated by scripts/build-meanings.py. */", "export const MEANING: Record<string, string> = {"]
for w in sorted(final):
    key = '"' + w.replace("\\", "\\\\").replace('"', '\\"') + '"'
    topic = '"' + final[w].replace("\\", "\\\\").replace('"', '\\"') + '"'
    lines.append(f"  {key}: {topic},")
lines.append("};")
lines.append("")
(ROOT / "src/data/meanings.ts").write_text("\n".join(lines) + "\n")
print("wrote", len(final))
