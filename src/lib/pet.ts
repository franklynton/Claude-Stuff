import type { Pet, PixelGrid } from "@/types/db";

// Points lost per hour. Sped up for the demo so neglect shows within minutes.
export const TIME_SCALE = 20;
const HUNGER_PER_HOUR = 10;
const MOOD_PER_HOUR = 8;
// Glitch builds while the pet is neglected and slowly heals while it's cared for.
const GLITCH_UP_PER_HOUR = 25;
const GLITCH_DOWN_PER_HOUR = 10;
const NEGLECTED_BELOW = 30;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));

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
    glitch_level: 0,
    last_fed_at: iso,
    created_at: iso,
  };
}

// Applies `ms` of real time to the pet's stats.
export function decay(pet: Pet, ms: number): Pet {
  const hours = (ms / 3_600_000) * TIME_SCALE;
  if (hours <= 0) return pet;
  const hunger = clamp(pet.hunger - HUNGER_PER_HOUR * hours);
  const mood = clamp(pet.mood - MOOD_PER_HOUR * hours);
  const neglected = hunger < NEGLECTED_BELOW || mood < NEGLECTED_BELOW;
  const glitch_level = clamp(
    pet.glitch_level + (neglected ? GLITCH_UP_PER_HOUR : -GLITCH_DOWN_PER_HOUR) * hours,
  );
  return { ...pet, hunger, mood, glitch_level };
}

export function feed(pet: Pet, now = new Date()): Pet {
  return { ...pet, hunger: clamp(pet.hunger + 30), last_fed_at: now.toISOString() };
}

export function play(pet: Pet): Pet {
  return { ...pet, mood: clamp(pet.mood + 25), hunger: clamp(pet.hunger - 5) };
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
