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
// When every need is well looked after, the glitch heals much faster.
const GLITCH_DOWN_CARED_PER_HOUR = 40;
const LOW = 30;
const GOOD = 60;

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

// Where the head is on a 16x16 drawing, in pixels, so hats and glasses fit any shape.
// Uses the white eye pixels when there are any; otherwise guesses from the drawing's outline.
export function headSpot(pixels: PixelGrid): { x: number; top: number; eyes: number; width: number } {
  const filled: [number, number][] = [];
  const white: [number, number][] = [];
  pixels.forEach((row, y) =>
    row.forEach((c, x) => {
      if (!c) return;
      filled.push([x, y]);
      if (c.toLowerCase() === "#ffffff") white.push([x, y]);
    }),
  );
  if (!filled.length) return { x: 7.5, top: 4, eyes: 6, width: 8 };
  const xs = filled.map(([x]) => x);
  const ys = filled.map(([, y]) => y);
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];

  const eyeXs = white.map(([x]) => x);
  const x = white.length ? (Math.min(...eyeXs) + Math.max(...eyeXs)) / 2 : (Math.min(...xs) + Math.max(...xs)) / 2;
  const eyes = white.length ? Math.min(...white.map(([, y]) => y)) : Math.round(minY + (maxY - minY) * 0.3);

  // Top of the head: the first row with a solid bit of drawing near the head (skips thin antennae).
  const near = (y: number) => filled.filter(([fx, fy]) => fy === y && Math.abs(fx - x) <= 3).length;
  let top = minY;
  for (let y = minY; y <= eyes; y++) {
    if (near(y) >= 3) {
      top = y;
      break;
    }
  }
  // Head width: the drawing's span on the eye row around the head.
  const row = filled.filter(([fx, fy]) => fy === eyes && Math.abs(fx - x) <= 5).map(([fx]) => fx);
  const width = row.length ? Math.max(...row) - Math.min(...row) + 1 : 8;
  return { x, top, eyes, width };
}

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

const SLEEP_REFILL_PER_HOUR = 40;

// Applies `ms` of real time to the pet's stats. While asleep, sleep refills
// and the other needs drain at half speed.
export function decay(pet: Pet, ms: number, asleep = false): Pet {
  const hours = (ms / 3_600_000) * TIME_SCALE;
  if (hours <= 0) return pet;
  const next = { ...pet };
  for (const k of NEEDS) next[k] = clamp(pet[k] - DRAIN_PER_HOUR[k] * hours * (asleep ? 0.5 : 1));
  if (asleep) next.sleep = clamp(pet.sleep + SLEEP_REFILL_PER_HOUR * hours);

  const unwell = next.hunger < LOW || next.cleanliness < LOW || next.sleep < LOW;
  next.health = clamp(pet.health + (unwell ? -HEALTH_DOWN_PER_HOUR : HEALTH_UP_PER_HOUR) * hours);

  const result = withMood(next);
  const neglected = result.hunger < LOW || result.health < LOW || result.mood < LOW;
  const caredFor = [...NEEDS, "health" as const].every((k) => result[k] >= GOOD);
  const glitchChange = neglected ? GLITCH_UP_PER_HOUR : caredFor ? -GLITCH_DOWN_CARED_PER_HOUR : -GLITCH_DOWN_PER_HOUR;
  result.glitch_level = clamp(pet.glitch_level + glitchChange * hours);
  return result;
}

// Points a care action adds (or removes) for each stat, e.g. { hunger: 30, cleanliness: -5 }.
export type Effect = Partial<Record<Need | "health", number>>;

export function care(pet: Pet, effect: Effect, now = new Date()): Pet {
  const p = { ...pet };
  for (const [k, v] of Object.entries(effect) as [Need | "health", number][]) p[k] = clamp(p[k] + v);
  if ((effect.hunger ?? 0) > 0) p.last_fed_at = now.toISOString();
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
