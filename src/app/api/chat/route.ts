import { NextResponse } from "next/server";

// Server-side only: the API key never reaches the browser.
const MODEL = "claude-haiku-5-5"; // cheapest model, to make free credits last
const MAX_TOKENS = 120; // replies are 1-2 sentences

interface ChatBody {
  name: string;
  personality: string;
  hunger: number;
  mood: number;
  glitch_level: number;
  history: { from: "you" | "pet"; text: string }[];
}

const FALLBACKS = [
  "Whoa, my modem just disconnected. Say that again?",
  "That's da bomb! Brb, defragging my feelings.",
  "Error: no API key found. I'm running on pure 1999 vibes.",
];

function systemPrompt(b: ChatBody): string {
  return [
    `You are ${b.name}, a virtual pet that is a "millennium bug" who survived the year 2000.`,
    `Personality: ${b.personality}`,
    `Current stats (0-100): hunger ${Math.round(b.hunger)} (100 = full), mood ${Math.round(b.mood)}, glitch ${Math.round(b.glitch_level)}.`,
    "Let these stats shape your tone: hungry or sad pets complain, happy ones are playful.",
    b.glitch_level > 60
      ? "You are badly glitched: sometimes scramble words, mention fake error messages or think it's 1900."
      : "",
    "Reply in 1-2 short sentences, in character, using 2000-era slang. Keep it PG.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody;
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return NextResponse.json({ reply: FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)] });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(body),
      messages: body.history.slice(-8).map((m) => ({
        role: m.from === "you" ? "user" : "assistant",
        content: m.text,
      })),
    }),
  });

  if (!res.ok) {
    console.error("Anthropic API error", res.status, await res.text());
    return NextResponse.json({ reply: "*bzzt* My brain.exe crashed. Try again?" });
  }
  const data = await res.json();
  return NextResponse.json({ reply: data.content?.[0]?.text ?? "..." });
}
