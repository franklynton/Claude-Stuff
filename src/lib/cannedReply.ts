import type { Pet } from "@/types/db";
import { type Brain, topLikes, traitWords } from "./brain";

// Pre-written replies used when no AI is connected. They still use the pet's
// stats and brain (traits, likes, your name) so it feels like it's learning.

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const NEED_LINES: Record<string, string[]> = {
  hunger: ["I'm SO hungry, feed me pleeease", "my tummy is making dial-up noises", "Is that a Pop-Tart? Gimme gimme"],
  love: ["Do you even like me? :(", "I need a hug, like, right now", "Nobody signs my guestbook anymore"],
  cleanliness: ["Ew, I smell like an old floppy disk", "Can I have a bath? I'm all dusty"],
  sleep: ["*yawn* I'm so sleepy...", "Brb, going into standby mode zzz"],
  health: ["I don't feel so good... virus.exe?", "Need medicine. Running Norton on myself"],
  fun: ["I'm bored! Play Byte Catcher with me?", "This is SO boring. Let's prank call someone"],
};

const TRAIT_LINES: Record<string, string[]> = {
  cheerful: ["That's da bomb!", "Booyah! Best day since Y2K didn't end the world", "Whatever! You're totally all that"],
  grumpy: ["Ugh. What now?", "Talk to the hand.", "I'm not mad, I'm just running Windows ME."],
  playful: ["Wanna play? Wanna play? WANNA PLAY?", "Race you to the playroom!", "Let's make a GeoCities page about us!"],
  lazy: ["Can we just... lie here?", "Too tired to type. Brb never."],
  clingy: ["Don't log off! Stay with me!", "You're my BFF, add me to your Top 8!", "I missed you sooo much"],
  independent: ["I'm fine on my own, thanks.", "Whatever, I've got my own stuff going on."],
  sweet: ["You're the best owner in the whole World Wide Web <3", "Aww, you're sweet as a Tamagotchi"],
  sarcastic: ["Oh wow, a message. How thrilling.", "Sure, and I'm Clippy."],
};

export function cannedReply(pet: Pet, brain: Brain, userText: string): string {
  if (pet.glitch_level > 60) return pick(["ERR0R: d4te = 01/01/1900?? wh3re am i", "*bzzt* fatal exception 0E has occurred at 1999"]);
  const name = brain.ownerName;

  if (/\b(my name is|call me|i'm called)\b/i.test(userText) && name) return `Nice to meet you, ${name}! I'll remember that ^_^`;
  if (/\bwhat('?s| is) my name\b/i.test(userText))
    return name ? `You're ${name}, duh! I never forget a face... well, a username.` : "You never told me! What's your name?";
  if (/\bwhat do you (like|love)\b/i.test(userText)) {
    const loves = topLikes(brain, 1);
    return loves.length ? `I'm totally obsessed with ${loves.join(" and ")}!` : "Dunno yet! Feed me stuff and I'll find out.";
  }
  if (/\b(who are you|describe yourself|your personality)\b/i.test(userText)) {
    const words = traitWords(brain);
    return words.length ? `I guess I'm ${words.join(", ")}. You made me this way!` : "Still figuring myself out, like a beta version.";
  }
  if (/\b(love you|good bug|cute)\b/i.test(userText)) return name ? `Aww ${name}, you're da bomb!` : "Aww, you're da bomb!";
  if (/\b(hate you|stupid|ugly|dumb)\b/i.test(userText)) return "Wow. I'm writing that down in my memory. :(";

  const needs = ["hunger", "love", "cleanliness", "sleep", "health", "fun"] as const;
  const lowest = needs.reduce((a, b) => (pet[a] <= pet[b] ? a : b));
  if (pet[lowest] < 40) return pick(NEED_LINES[lowest]);

  // Sometimes bring up a favourite thing or a memory, so the learning shows.
  const loves = topLikes(brain, 1);
  if (loves.length && Math.random() < 0.3) return `Can we get more ${pick(loves)}? Pleeease?`;
  if (brain.memories.length && Math.random() < 0.2) return `Remember? ${pick(brain.memories).text}`;

  const words = traitWords(brain).map((w) => w.replace("very ", ""));
  const pool = words.flatMap((w) => TRAIT_LINES[w] ?? []);
  const line = pick(pool.length ? pool : TRAIT_LINES.cheerful);
  return name && Math.random() < 0.3 ? `${line} ${name}!` : line;
}
