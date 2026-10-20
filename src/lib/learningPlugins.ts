// The web classroom's learning-plugin catalogue (meettomanage/src/data/learningPlugins.ts),
// copied verbatim so ids match: a teacher's "plugins" pick arrives over the hub by id.

export type LearningPluginType = "game" | "resource" | "both";

export interface LearningPlugin {
  id: string;
  name: string;
  category: string;
  type: LearningPluginType;
  emoji: string;
}

const CATEGORIES = [
  ["Teaching & Child Development", "🧸", "Phonics Training|Alphabet Teaching (A–Z)|Jolly Phonics|Montessori Teacher Training|Pre-primary Teacher Training (PPTC)|Nursery Teacher Training (NTT)|Early Childhood Care and Education (ECCE)|Kindergarten Teacher Training|Handwriting Improvement Training|Cursive Writing|Reading and Writing Skills for Children|Storytelling for Kids|Kids' Activity and Art Training|Special Education Basics|Child Psychology|Classroom Management|Lesson Planning|Teaching Through Play"],
  ["Language & Communication", "🗣️", "Spoken English|English Grammar|Vocabulary Building|Phonetics|Public Speaking|Communication Skills|Hindi Speaking|Tamil Reading and Writing|Translation Skills|Creative Writing|Interview Communication"],
  ["Maths & Brain Development", "🧠", "Abacus|Vedic Maths|Mental Maths|Speed Maths|Logical Reasoning|Problem-solving Skills|Chess|Rubik’s Cube|Memory Training|Concentration Training|Brain Development Activities|Puzzle-solving Skills"],
  ["Writing, Art & Creative Skills", "🎨", "Alphabet Writing|Letter Formation|Good Handwriting|Cursive Handwriting|Calligraphy|Drawing|Painting|Colouring|Origami|Craft Work|Paper Crafts|Clay Modelling|Best-out-of-waste Activities|Creative Thinking|Greeting-card Making"],
  ["Computer & Technology", "💻", "Basic Computer Skills|MS Word|MS Excel|MS PowerPoint|Typing|Tally|Graphic Design|Canva Design|Web Design|HTML and CSS|Python Programming|Coding for Kids|Scratch Programming|Artificial Intelligence Basics|Digital Marketing|Video Editing|Computer Hardware and Networking"],
  ["Personal Development", "🌟", "Personality Development|Leadership Skills|Confidence Building|Public Speaking|Stage Speaking|Interview Skills|Teamwork|Time Management|Critical Thinking|Emotional Intelligence|Financial Literacy|Entrepreneurship|Business Communication"],
  ["Music, Dance & Performing Arts", "🎭", "Vocal Music|Keyboard|Guitar|Carnatic Music|Western Dance|Classical Dance|Bharatanatyam|Zumba|Drama|Acting|Story Narration|Yoga|Meditation|Taekwondo|Karate"],
  ["Vocational & Job-oriented Skills", "🛠️", "Tailoring|Fashion Designing|Beautician Training|Makeup Artistry|Baking|Cake Decoration|Cooking|Photography|Jewellery Making|Embroidery|Customer Service|Data Entry|Accounting|Digital Office Administration|First Aid Basics"],
  ["Academic & Language Skills", "📚", "Tamil Phonics and Literacy Activities|English Phonics|English Pronunciation|Hindi Literacy|Grammar|Reading Comprehension|Creative Writing|Spelling Improvement|Essay Writing|Mental Ability|Olympiad Preparation|Science Experiments for Children|Environmental Awareness|Life Skills|Practical Learning Activities"],
  ["Professional Trainer Training", "🎓", "Phonics Teacher Training|Jolly Phonics|Montessori Teacher Training|Abacus Teacher Training|Vedic Maths Teacher Training|Handwriting Teacher Training|Calligraphy Teacher Training|Art and Craft Teacher Training|Rubik’s Cube Trainer Training|Spoken English Trainer Training|Early Childhood Education|Nursery Teacher Training|Kids' Yoga Instructor Training|Robotics Teacher Training"],
] as const;

const RESOURCE_WORDS = /training|education|management|planning|psychology|basics|administration|hardware|marketing|accounting|first aid|instructor/i;
const BOTH_WORDS = /phonics|maths|writing|speaking|reading|grammar|memory|reasoning|coding|science|language|literacy/i;

export const LEARNING_PLUGINS: LearningPlugin[] = CATEGORIES.flatMap(([category, emoji, names], categoryIndex) =>
  names.split("|").map((name, itemIndex) => ({
    id: `lp-${categoryIndex + 1}-${itemIndex + 1}`,
    name,
    category,
    emoji,
    type: RESOURCE_WORDS.test(name) ? ("resource" as const) : BOTH_WORDS.test(name) ? ("both" as const) : ("game" as const),
  })),
);

/** Which built-in game a plugin opens (web: WhiteboardActivity.PluginActivity). */
export function pluginGame(plugin: LearningPlugin): "phonics" | "abacus" | "challenge" {
  if (/phonics|phonetics|pronunciation/i.test(plugin.name)) return "phonics";
  if (/abacus|mental maths|speed maths|vedic maths/i.test(plugin.name)) return "abacus";
  return "challenge";
}

/** A teacher's H5P link as its https embed URL, or "" when not a safe https URL (web: normalizeH5pUrl). */
export function normalizeH5pUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return "";
    if (!url.pathname.endsWith("/embed")) url.pathname = `${url.pathname.replace(/\/$/, "")}/embed`;
    return url.toString();
  } catch {
    return "";
  }
}
