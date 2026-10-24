import type { Pet, PixelGrid } from "@/types/db";

// Sped up for the demo so neglect shows within minutes.
export const TIME_SCALE = 20;

// Needs the player tops up with care actions, and how many points each loses per hour.
export const NEEDS = ["hunger", "love", "cleanliness", "fun", "sleep"] as const;
export type Need = (typeof NEEDS)[number];
const DRAIN_PER_HOUR: Record<Need, number> = { hunger: 10, love: 6, cleanliness: 7, fun: 12, sleep: 8 };

// Health falls while hunger, cleanliness or sleep is low, and slowly recovers otherwise.
const HEALTH_DOWN_PER_HOUR = 10;
const HEALTH_UP_PER_HOUR = 3;
// Glitch builds while the pet is neglected and slowly heals while it's cared for.
const GLITCH_UP_PER_HOUR = 25;
const GLITCH_DOWN_PER_HOUR = 10;
const LOW = 30;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));

// Mood is the average of the needs, so it shows how well the pet is looked after overall.
function withMood(pet: Pet): Pet {
  const mood = NEEDS.reduce((sum, k) => sum + pet[k], 0) / NEEDS.length;
  return { ...pet, mood: clamp(mood) };
}

export const PERSONALITIES = {
  cheerful: "Upbeat and bubbly. Loves dial-up noises, butterfly clips and saying 'da bomb'.",
  grumpy: "Sarcastic and dramatic. Still salty that nobody fixed the Y2K bug properly.",
  nerdy: "Obsessed with floppy disks, Clippy and leetspeak. Explains everything like a help file.",
} as const;

export type PersonalityKey = keyof typeof PERSONALITIES;

// Bug shapes the player picks from at hatch, as 16x16 templates:
// k = outline, w = eye white, g = body, l = body highlight, r = spots, . = empty.
// TODO: replace with the art team's sprites, and the pixel editor (priority 4).
const SHAPES = {
  beetle: [
    "....k......k....",
    ".....k....k.....",
    "......kkkk......",
    ".....kggggk.....",
    "....kgwkkwgk....",
    "....kgwkkwgk....",
    "...kkggggggkk...",
    "..k.kgglrggk.k..",
    "...kggllggggk...",
    "..k.kggggglgk.k.",
    "...kgglggggk....",
    "..k.kgggrggk.k..",
    "....kgggggk.....",
    ".....kkkkkk.....",
    "....k......k....",
    "................",
  ],
  ladybird: [
    "................",
    "................",
    "......kkkk......",
    ".....kkwwkk.....",
    "....kkkkkkkk....",
    "...kgggkkgggk...",
    "..kgrrgkkgrrgk..",
    "..kgrrgkkgrrgk..",
    ".kgggggkkgggggk.",
    ".kglrggkkggrrgk.",
    ".kgrrggkkggrrgk.",
    "..kggggkkggggk..",
    "...kggrkkrggk...",
    "....kkkkkkkk....",
    "...k..k..k..k...",
    "................",
  ],
  caterpillar: [
    "................",
    "................",
    "...........k.k..",
    "...........k.k..",
    "..........kkkkk.",
    ".........kgggggk",
    ".........kgwgwgk",
    "..kkk.kkkkgkgkgk",
    ".kgggkgggkgggggk",
    "kglrgkglrgkgrrgk",
    "kggggkggggkgggk.",
    ".kggk.kggk.kkkk.",
    "..kk...kk.......",
    "..k.k..k.k......",
    "................",
    "................",
  ],
};
export type ShapeKey = keyof typeof SHAPES;
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

export const COLOURS = [
  { name: "Green", body: "#00a800", light: "#5cff5c", spots: "#ff0000" },
  { name: "Red", body: "#d00000", light: "#ff6060", spots: "#000000" },
  { name: "Blue", body: "#0040c0", light: "#40a0ff", spots: "#ffff00" },
  { name: "Purple", body: "#8000a0", light: "#d060ff", spots: "#00ffff" },
  { name: "Pink", body: "#ff40a0", light: "#ffa0d0", spots: "#ffffff" },
  { name: "Gold", body: "#c09000", light: "#ffe040", spots: "#804000" },
];

export function makePixels(shape: ShapeKey, colour: number): PixelGrid {
  const c = COLOURS[colour] ?? COLOURS[0];
  const palette: Record<string, string> = { k: "#000000", w: "#ffffff", g: c.body, l: c.light, r: c.spots };
  return SHAPES[shape].map((row) => [...row].map((ch) => palette[ch] ?? ""));
}

export const DEFAULT_PIXELS = makePixels("beetle", 0);

// Every bug hatches with a random personality.
export function randomPersonality(): PersonalityKey {
  const keys = Object.keys(PERSONALITIES) as PersonalityKey[];
  return keys[Math.floor(Math.random() * keys.length)];
}

// The short name ("grumpy") for a pet's stored personality prompt.
export function personalityName(pet: Pet): string {
  const entry = Object.entries(PERSONALITIES).find(([, prompt]) => prompt === pet.personality);
  return entry ? entry[0] : "mystery";
}

export function newPet(
  name: string,
  pixel_data: PixelGrid = DEFAULT_PIXELS,
  personality = randomPersonality(),
  now = new Date(),
): Pet {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    owner_id: "local", // replaced by the Supabase user id once auth exists
    name,
    personality: PERSONALITIES[personality],
    pixel_data,
    hunger: 80,
    mood: 80,
    love: 80,
    cleanliness: 80,
    health: 100,
    fun: 80,
    sleep: 80,
    glitch_level: 0,
    last_fed_at: iso,
    created_at: iso,
  };
}

// Applies `ms` of real time to the pet's stats.
export function decay(pet: Pet, ms: number): Pet {
  const hours = (ms / 3_600_000) * TIME_SCALE;
  if (hours <= 0) return pet;
  const next = { ...pet };
  for (const k of NEEDS) next[k] = clamp(pet[k] - DRAIN_PER_HOUR[k] * hours);

  const unwell = next.hunger < LOW || next.cleanliness < LOW || next.sleep < LOW;
  next.health = clamp(pet.health + (unwell ? -HEALTH_DOWN_PER_HOUR : HEALTH_UP_PER_HOUR) * hours);

  const result = withMood(next);
  const neglected = result.hunger < LOW || result.health < LOW || result.mood < LOW;
  result.glitch_level = clamp(
    pet.glitch_level + (neglected ? GLITCH_UP_PER_HOUR : -GLITCH_DOWN_PER_HOUR) * hours,
  );
  return result;
}

export type CareAction = "feed" | "play" | "cuddle" | "wash" | "nap" | "medicine";

export function care(pet: Pet, action: CareAction, now = new Date()): Pet {
  const p = { ...pet };
  switch (action) {
    case "feed":
      p.hunger = clamp(p.hunger + 30);
      p.last_fed_at = now.toISOString();
      break;
    case "play": // fun, but tiring and messy
      p.fun = clamp(p.fun + 25);
      p.sleep = clamp(p.sleep - 5);
      p.cleanliness = clamp(p.cleanliness - 5);
      break;
    case "cuddle":
      p.love = clamp(p.love + 25);
      break;
    case "wash":
      p.cleanliness = 100;
      break;
    case "nap":
      p.sleep = clamp(p.sleep + 35);
      break;
    case "medicine":
      p.health = clamp(p.health + 25);
      break;
  }
  return withMood(p);
}

// Swaps random letters for junk characters; used on text when the pet is glitchy.
export function glitchText(text: string, glitch: number): string {
  if (glitch < 40) return text;
  const junk = "#@%&$!?01█▓▒░";
  const chance = (glitch - 40) / 300;
  return [...text]
    .map((c) => (c !== " " && Math.random() < chance ? junk[Math.floor(Math.random() * junk.length)] : c))
    .join("");
}
