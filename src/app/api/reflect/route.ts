import { NextResponse } from "next/server";
import type { Pet } from "@/types/db";
import { type Brain, selfDescription } from "@/lib/brain";
import { askOpenRouter } from "@/lib/openrouter";
import { reflectPrompt } from "@/lib/petPrompt";
import { allowAi, visitorId } from "@/lib/rateLimit";

// The pet rereads its memories and rewrites how it describes itself.
export async function POST(req: Request) {
  const { pet, brain } = (await req.json()) as { pet: Pet; brain: Brain };
  const text = allowAi(visitorId(req))
    ? await askOpenRouter(reflectPrompt(pet, brain), [{ role: "user", content: "Describe yourself." }], 120)
    : null;
  return NextResponse.json({ reflection: text?.trim() || selfDescription(brain, pet) });
}
