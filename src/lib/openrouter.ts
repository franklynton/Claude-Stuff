// Server-only helper for OpenRouter API. The key never reaches the browser.
const DEFAULT_MODEL = "openrouter/free";

type Turn = { role: "user" | "assistant"; content: string };

// "openrouter/free" picks a random free model each time, and sometimes that's a
// safety checker (it answers "User Safety: safe") or a model that shows its thinking.
// Those aren't chat replies, so tidy or skip them and try another model.
const NOT_A_REPLY = /^\s*((user|response|agent|prompt)\s*safety|safety\s*(rating|assessment)?)\s*:|^\s*(safe|unsafe)\s*($|\n|S\d)|^\s*S\d{1,2}\s*$/i;

// Thinking out loud without <think> tags: it talks about "the user" or plans its answer.
const THINKING = /^\s*(okay|ok|alright|hmm|first)\b[^.!?]{0,40}\b(need to|let me)|^\s*(the (user|owner)|looking at|let me (think|see|check)|let's (see|think))\b|\b(i|we) (need to|should|have to) (respond|reply|react|answer|stay|keep)\b|\bin (a )?character\b|\bthe (user|owner) (is|has|said|wants)\b/i;

function clean(answer: Answer | null): string | null {
  // Cut off mid-thought: it rambled (usually thinking out loud) past the length limit.
  if (!answer?.text || answer.cutOff) return null;
  const reply = answer.text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
  return reply && !NOT_A_REPLY.test(reply) && !THINKING.test(reply) ? reply : null;
}

type Answer = { text: string | null; cutOff: boolean };

export async function askOpenRouter(system: string, messages: Turn[], maxTokens: number): Promise<string | null> {
  for (let tries = 0; tries < 3; tries++) {
    const reply = clean(await askOnce(system, messages, maxTokens));
    if (reply) return reply;
  }
  return null; // the caller falls back to a built-in reply
}

async function askOnce(system: string, messages: Turn[], maxTokens: number): Promise<Answer | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://hacknotts.millenniumbug.local",
        "X-Title": "Millennium Bug Tamagotchi",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.85,
        reasoning: { exclude: true }, // reasoning models: send only the answer
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!res.ok) {
      console.error("OpenRouter API error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    return { text: choice?.message?.content ?? null, cutOff: choice?.finish_reason === "length" };
  } catch (err) {
    console.error("OpenRouter request failed", err);
    return null;
  }
}
