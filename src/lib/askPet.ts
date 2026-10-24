import type { Pet } from "@/types/db";
import type { Brain } from "./brain";

// How the browser talks to the pet's AI. The full app calls our API routes;
// the no-install preview swaps this file for one that asks Claude directly.

export type ChatTurn = { from: "you" | "pet"; text: string };

export async function askChat(pet: Pet, brain: Brain, history: ChatTurn[]): Promise<{ reply: string; memory?: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pet, brain, history: history.slice(-8) }), // keep requests small to save credits
  });
  return res.json();
}

export async function askReflect(pet: Pet, brain: Brain): Promise<string> {
  const res = await fetch("/api/reflect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pet, brain }),
  });
  return (await res.json()).reflection;
}
