import type { Pet } from "@/types/db";
import { type Brain, gainSkill, knownWords, remember, topLikes } from "./brain";

// Things the pet says on its own when you've been quiet for a while, so it isn't
// always you starting the chat. Some are questions; your next message is taken as
// the answer. These are pre-written (no AI call) so they cost no credits.

export type Question = { kind: "name" | "food" | "word" | "feeling"; word?: string } | null;
export type Opener = { text: string; question: Question };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function opener(pet: Pet, brain: Brain, asleep: boolean): Opener | null {
  if (asleep) return null;
  const toddler = brain.stage === 0;
  const name = brain.ownerName;
  const options: Opener[] = [];
  const say = (t: string, k: string, question: Question = null) => options.push({ text: toddler ? t : k, question });

  // Needs come first: a hungry pet asks for food.
  if (pet.hunger < 35) return { text: toddler ? "Me hungy! Food? Pwease?" : `${name ?? "Hey"}, I'm starving! Kitchen? Pleeease?`, question: null };
  if (pet.fun < 30) return { text: toddler ? "Play! Play ball!" : "I'm sooo bored. Throw the ball or play Coin Catcher with me?", question: null };
  if (pet.love < 30) return { text: toddler ? "Hug? Me sad..." : "Do you still like me? I could use a pat :(", question: null };

  if (!name) say("Who you? What you name?", "Hey, what's your name?", { kind: "name" });
  if (!topLikes(brain, 1).length && !brain.memories.some((m) => m.text.startsWith("Your favourite food")))
    say("What yummy food you like?", "What's your favourite food?", { kind: "food" });
  // Ask about a word it has heard but doesn't understand yet.
  const unknown = Object.entries(brain.words).filter(([w, c]) => c === 1 && w.length > 3).map(([w]) => w);
  if (unknown.length) {
    const w = pick(unknown);
    say(`What "${w}" mean?`, `What does "${w}" mean?`, { kind: "word", word: w });
  }
  say(`${name ?? "You"} happy today?`, `How's your day going${name ? `, ${name}` : ""}?`, { kind: "feeling" });
  const known = knownWords(brain);
  if (known.length) say(`${pick(known)}! Me know ${pick(known)}!`, `Guess what? I learned ${known.length} words from you!`);
  const loves = topLikes(brain, 1);
  if (loves.length) say(`Me want ${loves[0]}!`, `I keep thinking about ${loves[0]}...`);
  if (brain.memories.length) say("Me remember!", `Remember this? ${pick(brain.memories).text}`);
  return pick(options);
}

// Learns from your answer to the question it asked.
export function learnAnswer(b: Brain, q: Question, text: string): Brain {
  if (!q) return b;
  const answer = text.trim().replace(/[.!?]+$/, "");
  const short = answer.split(/\s+/).length <= 6;
  switch (q.kind) {
    case "name": {
      const m = answer.match(/(?:my name is|i'm|i am|call me|it's)?\s*([a-z][a-z'-]{1,15})$/i);
      if (!m || b.ownerName) return b;
      const ownerName = m[1][0].toUpperCase() + m[1].slice(1);
      return gainSkill(remember({ ...b, ownerName }, `Your name is ${ownerName}.`), "social", 4);
    }
    case "food":
      return short ? gainSkill(remember(b, `Your favourite food is ${answer}.`), "thinking", 4) : b;
    case "word":
      return short ? gainSkill(remember(b, `You taught me: "${q.word}" means ${answer}.`), "thinking", 6) : b;
    case "feeling":
      return gainSkill(remember(b, `You said your day was: ${answer.slice(0, 40)}.`), "social", 4);
  }
}
