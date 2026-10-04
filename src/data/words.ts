/*
 * Starter glosses and examples were written for this app.
 * The full list lives in lexicon.ts: NGSL, the Academic Word List, and a
 * frequency list, with Arabic from the Arabic Wiktionary. These rows overlay
 * that list when the headword matches.
 */

import { MEANING } from "./meanings";

export type Pos =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "preposition"
  | "conjunction"
  | "pronoun"
  | "determiner"
  | "number";

export type ListSource = "ngsl" | "awl" | "freq" | "mine";

export type Word = {
  id: string;
  lemma: string;
  pos: Pos;
  rank: number;
  ar: string;
  example: string;
  highlight: string;
  abstract: boolean;
  topic: string;
  source: ListSource;
};

type Row = [string, Pos, string, string, string, 0 | 1, string];

const ROWS: Row[] = [
  ["the", "determiner", "أداة التعريف", "Please close the door.", "the", 1, "language"],
  ["be", "verb", "يكون", "I want to be early.", "be", 1, "language"],
  ["and", "conjunction", "وَ", "She bought bread and milk.", "and", 1, "language"],
  ["of", "preposition", "مِن", "Would you like a cup of tea?", "of", 1, "language"],
  ["a", "determiner", "أداة النكرة", "A bird is sitting on the wall.", "A", 1, "language"],
  ["to", "preposition", "إلى", "We walked to the station.", "to", 1, "language"],
  ["in", "preposition", "في", "The keys are in the bag.", "in", 1, "language"],
  ["have", "verb", "لَدَى", "I have two sisters.", "have", 1, "language"],
  ["it", "pronoun", "إنه (لغير العاقل)", "It is raining again.", "It", 1, "language"],
  ["you", "pronoun", "أنت", "Can you help me?", "you", 1, "language"],
  ["he", "pronoun", "هو", "He lives near the school.", "He", 1, "people"],
  ["for", "preposition", "مِن أجل", "This letter is for you.", "for", 1, "language"],
  ["they", "pronoun", "هم", "They are waiting outside.", "They", 1, "people"],
  ["not", "adverb", "ليس", "That is not my coat.", "not", 1, "language"],
  ["that", "conjunction", "أنّ", "I think that she is right.", "that", 1, "language"],
  ["I", "pronoun", "أنا", "I left my book at home.", "I", 1, "people"],
  ["on", "preposition", "على", "The cup is on the table.", "on", 1, "language"],
  ["with", "preposition", "مع", "She came with her brother.", "with", 1, "language"],
  ["as", "preposition", "كَـ", "Use this paper as a bookmark.", "as", 1, "language"],
  ["do", "verb", "يفعل", "What do you want for lunch?", "do", 1, "actions"],
  ["at", "preposition", "عند", "Meet me at the door.", "at", 1, "language"],
  ["this", "determiner", "هذا", "This road goes to the market.", "This", 1, "language"],
  ["but", "conjunction", "لكن", "I was tired, but I finished.", "but", 1, "language"],
  ["from", "preposition", "مِن", "The train comes from the city.", "from", 1, "language"],
  ["by", "preposition", "بجانب", "The house stands by the river.", "by", 1, "language"],
  ["we", "pronoun", "نحن", "We eat together in the evening.", "We", 1, "people"],
  ["or", "conjunction", "أو", "Tea or coffee?", "or", 1, "language"],
  ["she", "pronoun", "هي", "She reads before sleep.", "She", 1, "people"],
  ["say", "verb", "يقول", "What did he say to you?", "say", 1, "actions"],
  ["will", "verb", "سوف", "I will call you tonight.", "will", 1, "language"],
  ["one", "number", "واحد", "One window is open.", "One", 1, "language"],
  ["all", "determiner", "كل", "All the shops are closed.", "All", 1, "language"],
  ["would", "verb", "كان سـ", "I would like some water.", "would", 1, "language"],
  ["there", "adverb", "هناك", "There is a park near here.", "There", 1, "language"],
  ["their", "determiner", "ـهم", "Their house is small.", "Their", 1, "language"],
  ["what", "pronoun", "ماذا", "What time is it?", "What", 1, "language"],
  ["so", "conjunction", "لذلك", "It was late, so we left.", "so", 1, "language"],
  ["if", "conjunction", "إذا", "If it rains, stay inside.", "If", 1, "language"],
  ["about", "preposition", "عن", "Tell me about your day.", "about", 1, "language"],
  ["which", "determiner", "أي", "Which bag is yours?", "Which", 1, "language"],
  ["go", "verb", "يذهب", "I go to work by bus.", "go", 0, "actions"],
  ["when", "adverb", "متى", "When does the shop open?", "When", 1, "time"],
  ["make", "verb", "يصنع", "She can make good bread.", "make", 0, "actions"],
  ["can", "verb", "يستطيع", "Can you open the window?", "Can", 1, "language"],
  ["like", "verb", "يحب", "I like cold water.", "like", 1, "feelings"],
  ["time", "noun", "وقت", "What time is the train?", "time", 0, "time"],
  ["no", "adverb", "لا", "No, that seat is taken.", "No", 1, "language"],
  ["just", "adverb", "للتو", "I just arrived at the station.", "just", 1, "time"],
  ["know", "verb", "يعرف", "I know the way home.", "know", 1, "actions"],
  ["take", "verb", "يأخذ", "Take an umbrella with you.", "Take", 0, "actions"],
  ["people", "noun", "الناس", "People are waiting for the bus.", "People", 0, "people"],
  ["into", "preposition", "إلى داخل", "She walked into the room.", "into", 1, "language"],
  ["year", "noun", "سنة", "This year I am learning English.", "year", 1, "time"],
  ["your", "determiner", "ـك", "Is this your book?", "your", 1, "language"],
  ["good", "adjective", "جيد", "That was a good question.", "good", 1, "feelings"],
  ["some", "determiner", "بعض", "Would you like some tea?", "some", 1, "language"],
  ["them", "pronoun", "ـهم", "I saw them at the market.", "them", 1, "people"],
  ["see", "verb", "يرى", "I can see the sea from here.", "see", 0, "actions"],
  ["other", "adjective", "آخر", "The other door is locked.", "other", 1, "language"],
  ["than", "conjunction", "مِن (مقارنة)", "This road is longer than that one.", "than", 1, "language"],
  ["then", "adverb", "ثم", "Finish your tea, then rest.", "then", 1, "time"],
  ["now", "adverb", "الآن", "Please come here now.", "now", 1, "time"],
  ["look", "verb", "ينظر", "Look at the sky.", "Look", 0, "actions"],
  ["only", "adverb", "فقط", "I only have one key.", "only", 1, "language"],
  ["come", "verb", "يأتي", "Come in and sit down.", "Come", 0, "actions"],
  ["over", "preposition", "فوق", "The cat jumped over the wall.", "over", 0, "language"],
  ["think", "verb", "يفكر", "I think it will rain.", "think", 1, "actions"],
  ["also", "adverb", "أيضًا", "She also speaks Arabic.", "also", 1, "language"],
  ["back", "adverb", "عائد", "I will be back tomorrow.", "back", 1, "time"],
  ["after", "preposition", "بعد", "We can talk after lunch.", "after", 1, "time"],
  ["use", "verb", "يستخدم", "Use this cup for the tea.", "Use", 0, "actions"],
  ["two", "number", "اثنان", "I need two tickets.", "two", 1, "language"],
  ["how", "adverb", "كيف", "How was your day?", "How", 1, "language"],
  ["our", "determiner", "ـنا", "Our street is quiet at night.", "Our", 1, "language"],
  ["work", "verb", "يعمل", "I work in a small office.", "work", 0, "work"],
  ["first", "adjective", "أول", "The first bus leaves at six.", "first", 1, "time"],
  ["well", "adverb", "بشكل جيد", "She sings well.", "well", 1, "language"],
  ["way", "noun", "طريق", "This is the way to the station.", "way", 0, "town"],
  ["even", "adverb", "حتى", "Even a short walk helps.", "Even", 1, "language"],
  ["new", "adjective", "جديد", "I bought a new notebook.", "new", 1, "language"],
  ["want", "verb", "يريد", "I want to learn this word.", "want", 1, "feelings"],
  ["because", "conjunction", "لأن", "I stayed home because I was tired.", "because", 1, "language"],
  ["any", "determiner", "أيّ", "Do you have any questions?", "any", 1, "language"],
  ["these", "determiner", "هذه", "These shoes are too small.", "These", 1, "language"],
  ["give", "verb", "يعطي", "Give me a minute, please.", "Give", 0, "actions"],
  ["day", "noun", "يوم", "It was a long day.", "day", 0, "time"],
  ["most", "adjective", "معظم", "Most shops close at nine.", "Most", 1, "language"],
  ["us", "pronoun", "ـنا", "Wait for us by the door.", "us", 1, "people"],
  ["water", "noun", "ماء", "She asked for a glass of water.", "water", 0, "food"],
  ["home", "noun", "منزل", "I am going home now.", "home", 0, "home"],
  ["hand", "noun", "يد", "She raised her hand.", "hand", 0, "body"],
  ["child", "noun", "طفل", "The child is reading a book.", "child", 0, "people"],
  ["school", "noun", "مدرسة", "The school is near the park.", "school", 0, "study"],
  ["family", "noun", "عائلة", "My family eats together.", "family", 0, "people"],
  ["food", "noun", "طعام", "The food is on the table.", "food", 0, "food"],
  ["money", "noun", "مال", "I do not have enough money.", "money", 0, "work"],
  ["city", "noun", "مدينة", "The city is busy on Fridays.", "city", 0, "town"],
  ["friend", "noun", "صديق", "A friend is coming tonight.", "friend", 0, "people"],
  ["woman", "noun", "امرأة", "The woman opened the shop.", "woman", 0, "people"],
  ["man", "noun", "رجل", "The man asked for the way.", "man", 0, "people"],
  ["book", "noun", "كتاب", "This book is easy to read.", "book", 0, "study"],
  ["door", "noun", "باب", "Please shut the door.", "door", 0, "home"],
  ["car", "noun", "سيارة", "The car is parked outside.", "car", 0, "town"],
  ["house", "noun", "منزل", "Their house has a small garden.", "house", 0, "home"],
  ["night", "noun", "ليل", "It rained all night.", "night", 0, "time"],
  ["morning", "noun", "صباح", "I drink tea in the morning.", "morning", 0, "time"],
  ["week", "noun", "أسبوع", "I will finish it this week.", "week", 0, "time"],
  ["month", "noun", "شهر", "Next month we travel.", "month", 0, "time"],
  ["life", "noun", "حياة", "Daily life needs these words.", "life", 1, "feelings"],
  ["world", "noun", "عالم", "She wants to see the world.", "world", 0, "nature"],
  ["country", "noun", "بلد", "Which country is she from?", "country", 0, "town"],
  ["problem", "noun", "مشكلة", "The problem is the locked door.", "problem", 1, "language"],
  ["question", "noun", "سؤال", "That is a fair question.", "question", 1, "study"],
  ["idea", "noun", "فكرة", "I have an idea for dinner.", "idea", 1, "language"],
  ["story", "noun", "قصة", "Tell me the story again.", "story", 0, "study"],
  ["word", "noun", "كلمة", "I learned a new word today.", "word", 0, "study"],
  ["name", "noun", "اسم", "What is your name?", "name", 1, "people"],
  ["place", "noun", "مكان", "This place is quiet.", "place", 0, "town"],
  ["room", "noun", "غرفة", "The room has one window.", "room", 0, "home"],
  ["table", "noun", "طاولة", "Put the cups on the table.", "table", 0, "home"],
  ["chair", "noun", "كرسي", "The chair is by the window.", "chair", 0, "home"],
  ["bed", "noun", "سرير", "The bed is under the window.", "bed", 0, "home"],
  ["window", "noun", "نافذة", "Open the window, please.", "window", 0, "home"],
  ["kitchen", "noun", "مطبخ", "The kitchen smells like bread.", "kitchen", 0, "home"],
  ["street", "noun", "شارع", "Children play in the street.", "street", 0, "town"],
  ["road", "noun", "طريق", "This road leads to the sea.", "road", 0, "town"],
  ["tree", "noun", "شجرة", "The tree gives good shade.", "tree", 0, "nature"],
  ["river", "noun", "نهر", "We walked along the river.", "river", 0, "nature"],
  ["sea", "noun", "بحر", "The sea is calm today.", "sea", 0, "nature"],
  ["sun", "noun", "شمس", "The sun is strong at noon.", "sun", 0, "nature"],
  ["rain", "noun", "مطر", "The rain started suddenly.", "rain", 0, "nature"],
  ["wind", "noun", "ريح", "The wind shut the door.", "wind", 0, "nature"],
  ["animal", "noun", "حيوان", "That animal lives near the river.", "animal", 0, "animals"],
  ["bird", "noun", "طائر", "A bird is singing outside.", "bird", 0, "animals"],
  ["dog", "noun", "كلب", "The dog is sleeping by the door.", "dog", 0, "animals"],
  ["cat", "noun", "قط", "The cat is on the chair.", "cat", 0, "animals"],
  ["fish", "noun", "سمك", "We had fish for dinner.", "fish", 0, "food"],
  ["bread", "noun", "خبز", "The bread is still warm.", "bread", 0, "food"],
  ["rice", "noun", "أرز", "There is rice in the kitchen.", "rice", 0, "food"],
  ["milk", "noun", "حليب", "The milk is on the table.", "milk", 0, "food"],
  ["tea", "noun", "شاي", "Would you like some tea?", "tea", 0, "food"],
  ["coffee", "noun", "قهوة", "The coffee is too hot.", "coffee", 0, "food"],
  ["fruit", "noun", "فاكهة", "Fruit is good in the morning.", "fruit", 0, "food"],
  ["apple", "noun", "تفاحة", "She ate a green apple.", "apple", 0, "food"],
  ["market", "noun", "سوق", "The market opens early.", "market", 0, "town"],
  ["shop", "noun", "متجر", "This shop sells bread.", "shop", 0, "town"],
  ["buy", "verb", "يشتري", "I need to buy milk.", "buy", 0, "actions"],
  ["pay", "verb", "يدفع", "I will pay for the tea.", "pay", 0, "work"],
  ["job", "noun", "وظيفة", "She likes her new job.", "job", 0, "work"],
  ["office", "noun", "مكتب", "His office is in the city.", "office", 0, "work"],
  ["teacher", "noun", "معلّم", "The teacher asked a question.", "teacher", 0, "study"],
  ["student", "noun", "طالب", "Every student has a notebook.", "student", 0, "study"],
  ["learn", "verb", "يتعلّم", "I learn a few words every day.", "learn", 0, "study"],
  ["read", "verb", "يقرأ", "I read before I sleep.", "read", 0, "study"],
  ["write", "verb", "يكتب", "Please write your name.", "write", 0, "study"],
  ["speak", "verb", "يتكلم", "She can speak clearly.", "speak", 0, "study"],
  ["listen", "verb", "يستمع", "Listen to the question first.", "Listen", 0, "study"],
  ["help", "verb", "يساعد", "Can you help me with this bag?", "help", 0, "actions"],
  ["need", "verb", "يحتاج", "I need a glass of water.", "need", 1, "feelings"],
  ["try", "verb", "يحاول", "Try the other door.", "Try", 0, "actions"],
  ["start", "verb", "يبدأ", "We start work at eight.", "start", 0, "actions"],
  ["stop", "verb", "يتوقف", "Stop at the corner, please.", "Stop", 0, "actions"],
  ["open", "verb", "يفتح", "Could you open the window?", "open", 0, "actions"],
  ["close", "verb", "يغلق", "Please close the door.", "close", 0, "actions"],
  ["walk", "verb", "يمشي", "We walk to school.", "walk", 0, "actions"],
  ["run", "verb", "يجري", "Do not run in the street.", "run", 0, "actions"],
  ["sit", "verb", "يجلس", "Sit near the window.", "Sit", 0, "actions"],
  ["eat", "verb", "يأكل", "We eat dinner at seven.", "eat", 0, "actions"],
  ["sleep", "verb", "ينام", "I could not sleep last night.", "sleep", 0, "actions"],
  ["love", "verb", "يحب", "I love a quiet morning.", "love", 1, "feelings"],
  ["feel", "verb", "يشعر", "I feel better today.", "feel", 1, "feelings"],
  ["happy", "adjective", "سعيد", "The child looks happy.", "happy", 1, "feelings"],
  ["tired", "adjective", "متعب", "I am too tired to go out.", "tired", 1, "feelings"],
  ["small", "adjective", "صغير", "A small cafe sits on the corner.", "small", 0, "language"],
  ["big", "adjective", "كبير", "That is a big window.", "big", 0, "language"],
  ["old", "adjective", "قديم", "This is an old map of the city.", "old", 0, "language"],
  ["young", "adjective", "شاب", "The young teacher smiled.", "young", 0, "people"],
  ["hot", "adjective", "ساخن", "The tea is still hot.", "hot", 0, "food"],
  ["cold", "adjective", "بارد", "The water from the river is cold.", "cold", 0, "nature"],
  ["early", "adverb", "مبكر", "The market opens early.", "early", 1, "time"],
  ["late", "adverb", "متأخر", "Sorry I am late.", "late", 1, "time"],
  ["today", "adverb", "اليوم", "Today the sky is clear.", "Today", 1, "time"],
  ["tomorrow", "adverb", "غدًا", "Tomorrow we can try again.", "Tomorrow", 1, "time"],
  ["always", "adverb", "دائمًا", "She always locks the door.", "always", 1, "time"],
  ["never", "adverb", "أبدًا", "I never take sugar in tea.", "never", 1, "time"],
  ["sometimes", "adverb", "أحيانًا", "Sometimes we eat outside.", "Sometimes", 1, "time"],
  ["here", "adverb", "هنا", "Please sit here.", "here", 1, "language"],
  ["please", "adverb", "من فضلك", "Please pass the bread.", "Please", 1, "language"],
  ["thank", "verb", "يشكر", "Thank you for the help.", "Thank", 1, "language"],
  ["sorry", "adjective", "آسف", "I am sorry I am late.", "sorry", 1, "feelings"],
  ["yes", "adverb", "نعم", "Yes, that is my bag.", "Yes", 1, "language"],
  ["maybe", "adverb", "ربما", "Maybe we can meet tomorrow.", "Maybe", 1, "language"],
  ["enough", "adjective", "كافٍ", "That is enough rice, thank you.", "enough", 1, "language"],
  ["different", "adjective", "مختلف", "This word has a different sense.", "different", 1, "language"],
  ["important", "adjective", "مهم", "Water is important on a hot day.", "important", 1, "language"],
  ["easy", "adjective", "سهل", "This sentence is easy.", "easy", 1, "study"],
  ["hard", "adjective", "صعب", "The last question was hard.", "hard", 1, "study"],
  ["next", "adjective", "التالي", "The next bus is late.", "next", 1, "time"],
  ["last", "adjective", "الماضي", "Last night it rained.", "Last", 1, "time"],
  ["same", "adjective", "نفس", "We took the same train.", "same", 1, "language"],
  ["eye", "noun", "عين", "She closed one eye in the sun.", "eye", 0, "body"],
  ["head", "noun", "رأس", "My head hurts a little.", "head", 0, "body"],
  ["face", "noun", "وجه", "Wash your face with cold water.", "face", 0, "body"],
  ["foot", "noun", "قدم", "My foot is tired from the walk.", "foot", 0, "body"],
  ["heart", "noun", "قلب", "Her heart was beating fast.", "heart", 0, "body"],
  ["body", "noun", "جسم", "Rest when your body is tired.", "body", 0, "body"],
  ["hair", "noun", "شعر", "Her hair was wet from the rain.", "hair", 0, "body"],
  ["mouth", "noun", "فم", "Do not talk with your mouth full.", "mouth", 0, "body"],
  ["doctor", "noun", "طبيب", "The doctor asked me to sit.", "doctor", 0, "work"],
  ["hospital", "noun", "مستشفى", "The hospital is near the river.", "hospital", 0, "town"],
  ["bus", "noun", "حافلة", "The bus stops at the corner.", "bus", 0, "town"],
  ["train", "noun", "قطار", "We missed the morning train.", "train", 0, "town"],
  ["station", "noun", "محطة", "Wait for me at the station.", "station", 0, "town"],
  ["ticket", "noun", "تذكرة", "I need a ticket for the bus.", "ticket", 0, "town"],
  ["map", "noun", "خريطة", "The map shows the river.", "map", 0, "town"],
  ["bag", "noun", "حقيبة", "Your bag is by the door.", "bag", 0, "home"],
  ["key", "noun", "مفتاح", "The key is on the table.", "key", 0, "home"],
  ["hour", "noun", "ساعة", "The shop closes in one hour.", "hour", 0, "time"],
  ["minute", "noun", "دقيقة", "Give me one minute.", "minute", 0, "time"],
  ["left", "adjective", "يسار", "Turn left at the market.", "left", 0, "town"],
  ["right", "adjective", "يمين", "The school is on the right.", "right", 0, "town"],
  ["near", "preposition", "قريب من", "We live near the sea.", "near", 1, "language"],
  ["far", "adjective", "بعيد", "The station is not far.", "far", 1, "language"],
  ["under", "preposition", "تحت", "The cat is under the chair.", "under", 0, "language"],
  ["before", "preposition", "قبل", "Wash your hands before dinner.", "before", 1, "time"],
  ["again", "adverb", "مرة أخرى", "Please say that word again.", "again", 1, "language"],
  ["still", "adverb", "ما زال", "The shop is still open.", "still", 1, "time"],
  ["very", "adverb", "جدًا", "The water is very cold.", "very", 1, "language"],
  ["too", "adverb", "أكثر من اللازم", "This tea is too hot.", "too", 1, "language"],
  ["many", "adjective", "كثير", "Too many people are on the bus.", "many", 1, "language"],
  ["more", "adjective", "أكثر", "Would you like more bread?", "more", 1, "language"],
  ["every", "determiner", "كل", "Every morning I drink tea.", "Every", 1, "time"],
  ["find", "verb", "يجد", "I cannot find my key.", "find", 0, "actions"],
  ["keep", "verb", "يُبقي", "Keep the window closed tonight.", "Keep", 0, "actions"],
  ["leave", "verb", "يغادر", "We leave the house at seven.", "leave", 0, "actions"],
  ["put", "verb", "يضع", "Put the book on the table.", "Put", 0, "actions"],
  ["ask", "verb", "يسأل", "Ask the teacher if you are lost.", "Ask", 0, "actions"],
  ["tell", "verb", "يخبر", "Tell me the name of the street.", "Tell", 0, "actions"],
  ["show", "verb", "يُري", "Show me the way, please.", "Show", 0, "actions"],
  ["call", "verb", "يتصل", "I will call you from the station.", "call", 0, "actions"],
  ["wait", "verb", "ينتظر", "Wait for the green light.", "Wait", 0, "actions"],
  ["meet", "verb", "يقابل", "Let us meet at the market.", "meet", 0, "actions"],
  ["live", "verb", "يعيش", "They live near the school.", "live", 0, "actions"],
  ["play", "verb", "يلعب", "The children play after school.", "play", 0, "actions"],
  ["watch", "verb", "يشاهد", "We watch the birds from the window.", "watch", 0, "actions"],
  ["hear", "verb", "يسمع", "I can hear the rain.", "hear", 0, "actions"],
  ["remember", "verb", "يتذكر", "I cannot remember his name.", "remember", 1, "actions"],
  ["forget", "verb", "ينسى", "Do not forget your key.", "forget", 1, "actions"],
  ["understand", "verb", "يفهم", "Do you understand the question?", "understand", 1, "study"],
  ["change", "verb", "يغيّر", "The weather can change quickly.", "change", 1, "actions"],
  ["move", "verb", "يتحرك", "Please move the chair.", "move", 0, "actions"],
  ["turn", "verb", "ينعطف", "Turn right after the bridge.", "Turn", 0, "actions"],
  ["hold", "verb", "يمسك", "Hold this bag for a minute.", "Hold", 0, "actions"],
  ["carry", "verb", "يحمل", "I can carry the bread.", "carry", 0, "actions"],
  ["wash", "verb", "يغسل", "Wash the cups after tea.", "Wash", 0, "actions"],
  ["cook", "verb", "يطبخ", "He likes to cook rice.", "cook", 0, "food"],
  ["drive", "verb", "يقود", "She does not drive in the city.", "drive", 0, "actions"],
  ["clean", "adjective", "نظيف", "The kitchen is clean.", "clean", 0, "home"],
  ["full", "adjective", "ممتلئ", "The bus is full.", "full", 0, "language"],
  ["empty", "adjective", "فارغ", "The cup is empty.", "empty", 0, "home"],
  ["strong", "adjective", "قوي", "The wind is strong today.", "strong", 0, "looks"],
  ["fast", "adjective", "سريع", "This train is fast.", "fast", 0, "actions"],
  ["slow", "adjective", "بطيء", "The old bus is slow.", "slow", 0, "actions"],
  ["long", "adjective", "طويل", "It was a long walk home.", "long", 0, "language"],
  ["short", "adjective", "قصير", "We took a short rest.", "short", 0, "language"],
  ["light", "noun", "ضوء", "The light in the kitchen is on.", "light", 0, "home"],
  ["dark", "adjective", "مظلم", "The street is dark at night.", "dark", 0, "looks"],
  ["white", "adjective", "أبيض", "She bought white bread.", "white", 0, "language"],
  ["black", "adjective", "أسود", "A black bird sat on the wall.", "black", 0, "language"],
  ["red", "adjective", "أحمر", "The apple is red.", "red", 0, "language"],
  ["blue", "adjective", "أزرق", "The sea looks blue today.", "blue", 0, "looks"],
  ["green", "adjective", "أخضر", "The door is green.", "green", 0, "looks"],
];

const POS_SET = new Set<string>([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "pronoun",
  "determiner",
  "number",
]);

function asPos(value: string): Pos {
  return POS_SET.has(value) ? (value as Pos) : "noun";
}

function topicFor(id: string): string {
  return MEANING[id] ?? "everyday";
}

function displayLemma(lemma: string): string {
  return lemma === "i" ? "I" : lemma;
}

const STARTER = new Map(
  ROWS.map((row) => {
    const id = row[0].toLowerCase();
    return [
      id,
      {
        pos: row[1],
        ar: row[2],
        example: row[3],
        highlight: row[4],
        abstract: row[5] === 1,
        topic: row[6],
        lemma: row[0],
      },
    ] as const;
  }),
);

let byId = new Map<string, Word>();
const ownWords = new Map<string, Word>();

export function installLibrary(rows: Array<[string, string, string, number, "ngsl" | "awl" | "freq", 0 | 1]>): Word[] {
  const library = rows.map((row) => {
    const id = row[0].toLowerCase();
    const starter = STARTER.get(id);
    const source = row[4];
    return {
      id,
      lemma: starter?.lemma ?? displayLemma(row[0]),
      pos: starter?.pos ?? asPos(row[1]),
      rank: row[3],
      ar: starter?.ar || row[2],
      example: starter?.example ?? "",
      highlight: starter?.highlight ?? displayLemma(row[0]),
      abstract: starter ? starter.abstract : row[5] === 1,
      topic: starter?.topic ?? topicFor(id),
      source,
    } satisfies Word;
  });
  byId = new Map(library.map((word) => [word.id, word]));
  return library;
}

export function registerOwnWords(words: Word[]): void {
  ownWords.clear();
  for (const word of words) ownWords.set(word.id, word);
}

export function wordById(id: string): Word | undefined {
  return ownWords.get(id) ?? byId.get(id);
}

export function sourceLabel(source: ListSource): string {
  if (source === "ngsl") return "NGSL";
  if (source === "awl") return "Academic";
  if (source === "freq") return "Frequent";
  return "Yours";
}

export const WORD_COUNT = 4345;

export type OwnDraft = {
  id: string;
  lemma: string;
  pos: Pos;
  ar: string;
  example: string;
  topic?: string;
};

export function wordFromOwn(own: OwnDraft): Word {
  return {
    id: own.id,
    lemma: own.lemma,
    pos: own.pos,
    rank: 0,
    ar: own.ar,
    example: own.example,
    highlight: own.lemma,
    abstract: false,
    topic: own.topic || "mine",
    source: "mine",
  };
}

const SLUG = /[^a-z'-]+/g;

export function slugLemma(value: string): string {
  return value.trim().toLowerCase().replace(SLUG, "").replace(/^['-]+|['-]+$/g, "");
}

