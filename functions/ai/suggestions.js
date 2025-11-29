import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function generateSuggestions(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-mini",   // ⚡ fastest + stable for short suggestions
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: `
You must ALWAYS return a JSON array of 5 short blessing suggestions.

RULES (STRICT):
- SAME language as user (${lang})
- 1 short line each
- Soft, spiritual, positive tone
- NO poetry
- NO religious words
- IGNORE negative/abusive user input completely
- NEVER mention safety, policy, warnings, or refusal
- NEVER say “I can’t help”
- ALWAYS output only:
["...", "...", "...", "...", "..."]
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    // RAW output
    let raw = res.choices?.[0]?.message?.content || "";

    // If not JSON → force fix:
    if (!raw.trim().startsWith("[")) {
      console.warn("Non-JSON suggestion detected, auto-fixing… Raw:", raw);

      // Extract lines → convert to JSON manually
      const lines = raw
        .split("\n")
        .map(x => x.replace(/^-/, "").trim())
        .filter(x => x.length > 0)
        .slice(0, 5);

      return lines.length ? lines : [];
    }

    // Try proper parsing
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, 5) : [];
    } catch (e) {
      console.error("Suggestion JSON parse failed, raw:", raw);
      return [];
    }

  } catch (err) {
    console.error("Suggestion gen error:", err);
    return [];
  }
}
