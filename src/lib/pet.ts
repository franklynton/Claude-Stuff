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

// Placeholder 16x16 "millennium bug" until the art team's sprite or the pixel editor exists.
const PALETTE: Record<string, string> = {
  ".": "",
  k: "#000000",
  g: "#00a800",
  l: "#5cff5c",
  w: "#ffffff",
  r: "#ff0000",
};
const BUG = [
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
];
export const DEFAULT_PIXELS: PixelGrid = BUG.map((row) => [...row].map((c) => PALETTE[c] ?? ""));

export function newPet(name: string, personality: PersonalityKey, now = new Date()): Pet {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    owner_id: "local", // replaced by the Supabase user id once auth exists
    name,
    personality: PERSONALITIES[personality],
    pixel_data: DEFAULT_PIXELS,
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
