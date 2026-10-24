import type { Pet } from "@/types/db";
import { NEEDS } from "./pet";

// The pet's "brain". It hatches knowing nothing and barely able to talk: it learns
// words from what you type, skills and age like a Sims child, personality traits from how you treat it, likes and dislikes from
// what you do, and short memories. All of this is plain game logic (no AI calls);
// the AI reads it in /api/chat.

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
  words: Record<string, number>; // vocabulary: word -> times it has heard it
  skills: Record<SkillKey, number>; // skill XP; see skillLevel()
  stage: number; // index into STAGES
  age: number; // 0-100 through the current stage
}

const MAX_MEMORIES = 20;
const clampTrait = (n: number) => Math.max(-100, Math.min(100, n));

// A blank slate: neutral traits, no words, no memories.
export function newBrain(): Brain {
  return {
    traits: { cheer: 0, play: 0, cling: 0, sweet: 0 },
    likes: {},
    memories: [],
    counts: {},
    ownerName: null,
    reflection: null,
    neglected: false,
    words: {},
    skills: { thinking: 0, motor: 0, social: 0, creativity: 0 },
    stage: 0,
    age: 0,
  };
}

// A word counts as "known" once the pet has heard it twice, so repeating yourself teaches it.
const KNOWN_AFTER = 2;
export function knownWords(b: Brain, n = Infinity): string[] {
  return Object.entries(b.words ?? {})
    .filter(([, c]) => c >= KNOWN_AFTER)
    .sort((a, c) => c[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// Life stages, like a Sims child. The age bar fills over time and by talking;
// to age up, every skill must reach the level the next stage needs.
export const STAGES = [
  { name: "Toddler", icon: "🍼", about: "talks in broken baby-talk", needs: 2 },
  { name: "Kid", icon: "🧸", about: "makes simple sentences", needs: 4 },
  { name: "Teen", icon: "🎧", about: "chats with slang (and attitude)", needs: 6 },
  { name: "Adult", icon: "😎", about: "talks fluently", needs: 0 },
] as const;
export const stageOf = (b: Brain) => b.stage;

export const SKILLS = [
  { key: "thinking", name: "Thinking", icon: "🧠", how: "chat, teach it words and facts, feed it new foods" },
  { key: "motor", name: "Motor", icon: "🏃", how: "throw the ball, play Coin Catcher or Snake" },
  { key: "social", name: "Social", icon: "💬", how: "chat, pat it, be kind" },
  { key: "creativity", name: "Creativity", icon: "🎨", how: "redraw its look, dress it up" },
] as const;
export type SkillKey = (typeof SKILLS)[number]["key"];

const XP_PER_SKILL_LEVEL = 25;
export const MAX_SKILL_LEVEL = 10;
export const skillLevel = (b: Brain, k: SkillKey) => Math.min(MAX_SKILL_LEVEL, 1 + Math.floor((b.skills[k] ?? 0) / XP_PER_SKILL_LEVEL));
// 0-100 progress through the current skill level.
export const skillProgress = (b: Brain, k: SkillKey) =>
  skillLevel(b, k) >= MAX_SKILL_LEVEL ? 100 : (((b.skills[k] ?? 0) % XP_PER_SKILL_LEVEL) / XP_PER_SKILL_LEVEL) * 100;

export function gainSkill(b: Brain, k: SkillKey, xp: number): Brain {
  const before = skillLevel(b, k);
  const next = { ...b, skills: { ...b.skills, [k]: (b.skills[k] ?? 0) + xp } };
  const after = skillLevel(next, k);
  const skill = SKILLS.find((s) => s.key === k)!;
  return after > before ? remember(next, `My ${skill.name} skill went up to level ${after}!`) : next;
}

// Age points per second (100 fills the bar, about 8 minutes) and per chat message.
const AGE_PER_SECOND = 0.2;
const AGE_PER_CHAT = 2;
const growOlder = (b: Brain, amount: number): Brain =>
  b.stage >= STAGES.length - 1 ? b : { ...b, age: Math.min(100, b.age + amount) };

// Skills still below the level needed to grow into the next stage.
export function skillsMissing(b: Brain): (typeof SKILLS)[number][] {
  const need = STAGES[b.stage].needs;
  return SKILLS.filter((s) => skillLevel(b, s.key) < need);
}
export const canAgeUp = (b: Brain) => b.stage < STAGES.length - 1 && b.age >= 100 && skillsMissing(b).length === 0;

export function ageUp(b: Brain): Brain {
  if (!canAgeUp(b)) return b;
  const stage = b.stage + 1;
  return remember({ ...b, stage, age: 0 }, `Happy birthday to me! I'm a ${STAGES[stage].name} now!`);
}

// Adds every word in `text` to the vocabulary; brand-new words train Thinking.
function hear(b: Brain, text: string): Brain {
  const words = { ...b.words };
  let fresh = 0;
  for (const w of text.toLowerCase().match(/[a-z][a-z']{0,14}/g) ?? []) {
    if (!words[w]) fresh++;
    words[w] = (words[w] ?? 0) + 1;
  }
  return gainSkill({ ...b, words }, "thinking", Math.min(fresh, 6));
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
  | { type: "game"; score: number; name: string }
  | { type: "sleep" }
  | { type: "redraw" }
  | { type: "dressup" };

// Learns from something you did to it. `pet` is its state just before.
export function observe(b: Brain, e: BrainEvent, pet: Pet): Brain {
  let next = count(b, e.type);
  const n = next.counts[e.type];
  switch (e.type) {
    case "fed":
      if (!b.likes[e.item]) next = remember(next, `Tried ${e.item} for the first time.`);
      next = hear(next, e.item); // a child learns the names of things it's given
      // Food tastes better when you're hungry.
      next = like(next, e.item, pet.hunger < 50 ? 1.5 : 0.6);
      return nudge(next, { cheer: 0.5 });
    case "potion":
      next = like(next, "medicine", -1);
      return nudge(next, { cheer: -0.3 });
    case "pat":
      next = gainSkill(next, "social", 2);
      if (n === 1 || n % 25 === 0) next = remember(next, n === 1 ? "You patted me for the first time!" : `You've patted me ${n} times.`);
      return nudge(next, { cling: 1.5, sweet: 1 });
    case "scrub":
      // Being scrubbed when already clean is annoying; when grubby it's nice.
      next = like(next, "baths", pet.cleanliness > 85 ? -0.4 : 0.2);
      return next;
    case "ball":
      next = gainSkill(hear(like(next, "the ball", 0.8), "ball"), "motor", 5);
      return nudge(next, { play: 2, cheer: 0.5 });
    case "game":
      if (e.score >= 15) next = remember(next, `We scored ${e.score} at ${e.name}!`);
      next = gainSkill(like(next, e.name, 1), "motor", 5 + Math.round(e.score / 2));
      return nudge(next, { play: 3, cheer: 1 });
    case "sleep":
      return nudge(next, { play: -1 });
    case "redraw":
      return gainSkill(remember(next, "We gave me a new look!"), "creativity", 15);
    case "dressup":
      return gainSkill(next, "creativity", 6);
  }
}

// Called every second: it grows older, and a neglected pet slowly turns grumpy,
// sarcastic and independent.
export function drift(older: Brain, pet: Pet): Brain {
  const b = growOlder(older, AGE_PER_SECOND);
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

// Learns from what you type: new words, your name, things you like or hate,
// facts you teach it ("pizza is yummy"), and whether you're kind.
export function learnFromChat(b: Brain, text: string): Brain {
  let next = nudge(hear(count(b, "chat"), text), { cling: 0.5 });
  next = gainSkill(gainSkill(growOlder(next, AGE_PER_CHAT), "thinking", 2), "social", 3);
  const fact = text.match(/^\s*([a-z0-9' ]{2,25}?) (is|are) ([a-z0-9' ]{2,30}?)[.!]?\s*$/i);
  if (fact && !/^(what|who|where|how|why|it|that|this)\b/i.test(fact[1])) {
    next = gainSkill(remember(next, `You taught me: ${fact[1]} ${fact[2]} ${fact[3]}.`), "thinking", 4);
  }
  const name = text.match(/\b(?:my name is|i'm called|call me)\s+([a-z][a-z'-]{1,15})/i);
  if (name) {
    const ownerName = name[1][0].toUpperCase() + name[1].slice(1);
    next = remember({ ...next, ownerName }, `Your name is ${ownerName}.`);
  }
  const likes = text.match(/\bi (?:really )?(?:love|like|adore)\s+([a-z0-9' ]{2,30}?)(?:[.!?,]|$)/i);
  if (likes && !/\byou\b/i.test(likes[1])) next = remember(next, `You like ${likes[1].trim()}.`);
  const hates = text.match(/\bi (?:really )?(?:hate|can't stand|dislike)\s+([a-z0-9' ]{2,30}?)(?:[.!?,]|$)/i);
  if (hates && !/\byou\b/i.test(hates[1])) next = remember(next, `You hate ${hates[1].trim()}.`);
  if (KIND.test(text)) next = gainSkill(nudge(next, { sweet: 3, cling: 2, cheer: 1 }), "social", 3);
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
  if (b.stage === 0) return `Me ${pet.name}! Me little bug. Me learn words from you!`;
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
    `Life stage: ${STAGES[b.stage].name}. Skills (1-10): ${SKILLS.map((s) => `${s.name} ${skillLevel(b, s.key)}`).join(", ")}.`,
    `Words you know (learned from your owner): ${knownWords(b, 80).join(", ") || "none yet"}.`,
    `How you see yourself: ${b.reflection ?? selfDescription(b, pet)}`,
    `Traits (-100 to 100): ${TRAITS.map((t) => `${t.low}/${t.high} ${Math.round(b.traits[t.key])}`).join(", ")}.`,
    b.memories.length ? `Things you remember (oldest first):\n${b.memories.map((m) => `- ${m.text}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
