import { NextResponse } from "next/server";
import type { Pet } from "@/types/db";
import type { Brain } from "@/lib/brain";
import { cannedReply } from "@/lib/cannedReply";
import { askOpenRouter } from "@/lib/openrouter";
import { chatPrompt, parseReply } from "@/lib/petPrompt";
import { allowAi, visitorId } from "@/lib/rateLimit";

interface ChatBody {
  pet: Pet;
  brain: Brain;
  history: { from: "you" | "pet"; text: string }[];
}

export async function POST(req: Request) {
  const { pet, brain, history } = (await req.json()) as ChatBody;
  const messages = history.slice(-8).map((m) => ({
    role: m.from === "you" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));

  const text = allowAi(visitorId(req)) ? await askOpenRouter(chatPrompt(pet, brain), messages, 160) : null;
  // No API key, the API failed, or too many messages: pre-written replies that still use the brain.
  if (text === null) return NextResponse.json({ reply: cannedReply(pet, brain, history.at(-1)?.text ?? "") });
  return NextResponse.json(parseReply(text));
}
