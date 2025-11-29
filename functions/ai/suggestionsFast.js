import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function generateSuggestionsFast(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-mini",    // SUPER FAST
      temperature: 0.6,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: `
You generate 3 SHORT, HUMAN, NATURAL blessing suggestions.

RULES:
- SAME language as user (${lang})
- No translation
- No god names
- No religious bias
- No rewriting the user's main input
- Tone: emotional, warm, peaceful
- 1 line each
- Based on user's intent
- Output EXACT JSON array: ["...","...","..."]
`
        },
        { role: "user", content: text }
      ]
    });

    const raw = res.choices?.[0]?.message?.content || "[]";

    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      console.log("JSON parse failed:", raw);
      return [];
    }

  } catch (err) {
    console.error("Suggestion error:", err);
    return [];
  }
}
