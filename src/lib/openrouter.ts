// Server-only helper for OpenRouter API. The key never reaches the browser.
const DEFAULT_MODEL = "openrouter/free";

type Turn = { role: "user" | "assistant"; content: string };

export async function askOpenRouter(system: string, messages: Turn[], maxTokens: number): Promise<string | null> {
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
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!res.ok) {
      console.error("OpenRouter API error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("OpenRouter request failed", err);
    return null;
  }
}
