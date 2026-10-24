import type { Pet } from "@/types/db";
import { NEEDS } from "./pet";

// The pet's "brain": personality traits that drift with how you treat it, likes and
// dislikes learned from what you do, and short memories from actions and chat.
// All of this is plain game logic (no AI calls); the AI reads it in /api/chat.

export const TRAITS = [
  { key: "cheer", low: "grumpy", high: "cheerful" },
  { key: "play", low: "lazy", high: "playful" },
  { key: "cling", low: "independent", high: "clingy" },
  { key: "sweet", low: "sarcastic", high: "sweet" },
] as const;
export type TraitKey = (typeof TRAITS)[number]["key"];

export interface Memory {
  text: string;
  at: string; // ISO time
}

export interface Brain {
  traits: Record<TraitKey, number>; // -100..100, 0 = neutral
  likes: Record<string, number>; // thing -> score; above 0 likes it, below 0 dislikes it
  memories: Memory[]; // newest last, capped at MAX_MEMORIES
  counts: Record<string, number>; // how many times each kind of event happened
  ownerName: string | null;
  reflection: string | null; // the AI's latest self-description, if it has reflected
  neglected: boolean; // currently in a neglect episode (so it's remembered once)
}

const MAX_MEMORIES = 20;
const clampTrait = (n: number) => Math.max(-100, Math.min(100, n));

// Starting traits for each personality the bug can hatch with.
const SEEDS: Record<string, Partial<Record<TraitKey, number>>> = {
  cheerful: { cheer: 40, sweet: 25, play: 10 },
  grumpy: { cheer: -40, sweet: -30 },
  nerdy: { play: -15, cling: 15, sweet: 10 },
};

export function newBrain(personalityKey: string): Brain {
  const seed = SEEDS[personalityKey] ?? {};
  return {
    traits: { cheer: seed.cheer ?? 0, play: seed.play ?? 0, cling: seed.cling ?? 0, sweet: seed.sweet ?? 0 },
    likes: {},
    memories: [],
    counts: {},
    ownerName: null,
    reflection: null,
    neglected: false,
  };
}

export function remember(b: Brain, text: string): Brain {
  const memories = [...b.memories, { text, at: new Date().toISOString() }].slice(-MAX_MEMORIES);
  return { ...b, memories };
}

function nudge(b: Brain, changes: Partial<Record<TraitKey, number>>): Brain {
  const traits = { ...b.traits };
  for (const [k, v] of Object.entries(changes) as [TraitKey, number][]) traits[k] = clampTrait(traits[k] + v);
  return { ...b, traits };
}

// Adjusts how much it likes something, and remembers when that tips into love or hate.
function like(b: Brain, thing: string, amount: number): Brain {
  const before = b.likes[thing] ?? 0;
  const after = Math.max(-10, Math.min(10, before + amount));
  let next = { ...b, likes: { ...b.likes, [thing]: after } };
  if (before < 5 && after >= 5) next = remember(next, `I LOVE ${thing} now!`);
  if (before > -4 && after <= -4) next = remember(next, `I can't stand ${thing}.`);
  return next;
}

function count(b: Brain, type: string): Brain {
  return { ...b, counts: { ...b.counts, [type]: (b.counts[type] ?? 0) + 1 } };
}

export type BrainEvent =
  | { type: "fed"; item: string }
  | { type: "potion"; item: string }
  | { type: "pat" }
  | { type: "scrub" }
  | { type: "ball" }
  | { type: "game"; score: number }
  | { type: "sleep" };

// Learns from something you did to it. `pet` is its state just before.
export function observe(b: Brain, e: BrainEvent, pet: Pet): Brain {
  let next = count(b, e.type);
  const n = next.counts[e.type];
  switch (e.type) {
    case "fed":
      if (!b.likes[e.item]) next = remember(next, `Tried ${e.item} for the first time.`);
      // Food tastes better when you're hungry.
      next = like(next, e.item, pet.hunger < 50 ? 1.5 : 0.6);
      return nudge(next, { cheer: 0.5 });
    case "potion":
      next = like(next, "medicine", -1);
      return nudge(next, { cheer: -0.3 });
    case "pat":
      if (n === 1 || n % 25 === 0) next = remember(next, n === 1 ? "You patted me for the first time!" : `You've patted me ${n} times.`);
      return nudge(next, { cling: 1.5, sweet: 1 });
    case "scrub":
      // Being scrubbed when already clean is annoying; when grubby it's nice.
      next = like(next, "baths", pet.cleanliness > 85 ? -0.4 : 0.2);
      return next;
    case "ball":
      next = like(next, "the ball", 0.8);
      return nudge(next, { play: 2, cheer: 0.5 });
    case "game":
      if (e.score >= 15) next = remember(next, `We scored ${e.score} at Byte Catcher!`);
      next = like(next, "Byte Catcher", 1);
      return nudge(next, { play: 3, cheer: 1 });
    case "sleep":
      return nudge(next, { play: -1 });
  }
}

// Called every second: a neglected pet slowly turns grumpy, sarcastic and independent.
export function drift(b: Brain, pet: Pet): Brain {
  const low = NEEDS.filter((k) => pet[k] < 30);
  if (low.length === 0) return b.neglected ? { ...b, neglected: false } : b;
  let next = b;
  if (!b.neglected) {
    next = remember({ ...count(b, "neglect"), neglected: true }, `You left me ${low.map(needWord).join(" and ")}.`);
  }
  return nudge(next, { cheer: -0.15, sweet: -0.1, cling: -0.1 });
}

const needWord = (k: string) =>
  ({ hunger: "hungry", love: "lonely", cleanliness: "dirty", fun: "bored", sleep: "tired" })[k] ?? k;

const KIND = /\b(love you|luv u|ily|good (bug|boy|girl)|cute|best|awesome|thank|well done|sweet)\b/i;
const MEAN = /\b(hate you|stupid|ugly|bad bug|dumb|shut up|annoying|smelly|loser)\b/i;

// Learns from what you type: your name, things you like or hate, and whether you're kind.
export function learnFromChat(b: Brain, text: string): Brain {
  let next = nudge(count(b, "chat"), { cling: 0.5 });
  const name = text.match(/\b(?:my name is|i'm called|call me)\s+([a-z][a-z'-]{1,15})/i);
  if (name) {
    const ownerName = name[1][0].toUpperCase() + name[1].slice(1);
    next = remember({ ...next, ownerName }, `Your name is ${ownerName}.`);
  }
  const likes = text.match(/\bi (?:really )?(?:love|like|adore)\s+([a-z0-9' ]{2,30}?)(?:[.!?,]|$)/i);
  if (likes && !/\byou\b/i.test(likes[1])) next = remember(next, `You like ${likes[1].trim()}.`);
  const hates = text.match(/\bi (?:really )?(?:hate|can't stand|dislike)\s+([a-z0-9' ]{2,30}?)(?:[.!?,]|$)/i);
  if (hates && !/\byou\b/i.test(hates[1])) next = remember(next, `You hate ${hates[1].trim()}.`);
  if (KIND.test(text)) next = nudge(next, { sweet: 3, cling: 2, cheer: 1 });
  if (MEAN.test(text)) next = remember(nudge(next, { sweet: -4, cheer: -3, cling: -2 }), "You were mean to me. :(");
  return next;
}

// Words describing the strongest traits, e.g. ["very clingy", "playful"].
export function traitWords(b: Brain): string[] {
  return TRAITS.map((t) => ({ t, v: b.traits[t.key] }))
    .filter(({ v }) => Math.abs(v) >= 15)
    .sort((a, b2) => Math.abs(b2.v) - Math.abs(a.v))
    .map(({ t, v }) => `${Math.abs(v) >= 60 ? "very " : ""}${v > 0 ? t.high : t.low}`);
}

export function topLikes(b: Brain, sign: 1 | -1, n = 3): string[] {
  return Object.entries(b.likes)
    .filter(([, v]) => v * sign >= 2)
    .sort((a, c) => (c[1] - a[1]) * sign)
    .slice(0, n)
    .map(([k]) => k);
}

// How the pet describes itself. Built from the brain for now; the AI can rewrite it later.
export function selfDescription(b: Brain, pet: Pet): string {
  const words = traitWords(b);
  const loves = topLikes(b, 1);
  const hates = topLikes(b, -1);
  return [
    `I'm ${pet.name}, a ${words.length ? words.join(", ") : "pretty chill"} millennium bug.`,
    loves.length ? `I love ${loves.join(" and ")}.` : "",
    hates.length ? `I can't stand ${hates.join(" or ")}.` : "",
    b.ownerName ? `${b.ownerName} is my owner.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// The brain as plain text for the AI's system prompt.
export function brainPrompt(b: Brain, pet: Pet): string {
  return [
    `How you see yourself: ${b.reflection ?? selfDescription(b, pet)}`,
    `Traits (-100 to 100): ${TRAITS.map((t) => `${t.low}/${t.high} ${Math.round(b.traits[t.key])}`).join(", ")}.`,
    b.memories.length ? `Things you remember (oldest first):\n${b.memories.map((m) => `- ${m.text}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
