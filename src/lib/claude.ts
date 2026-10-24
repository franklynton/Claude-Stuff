// Server-only helper for calling Claude. The API key never reaches the browser.
const MODEL = "claude-haiku-5-5"; // cheapest model, to make credits last

type Turn = { role: "user" | "assistant"; content: string };

// Returns the reply text, or null when there's no API key or the call fails.
export async function askClaude(system: string, messages: Turn[], maxTokens: number): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    console.error("Anthropic API error", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? null;
}
