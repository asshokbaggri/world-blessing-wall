import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function generateSuggestions(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: `
You generate 5 SHORT, HUMAN, NATURAL blessing suggestions.

STRICT RULES:
- SAME language as user (${lang})
- NO translation
- NO rewriting user input
- NO god names, NO religion references
- Tone: spiritual, emotional, warm, peaceful
- Based on USER'S INTENT (context-aware)
- Each line must feel like a human wish, not a poem
- VERY short (1 line)
- Output ONLY valid JSON array of 5 strings:
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
    const raw = res.choices?.[0]?.message?.content || "[]";

    // SAFE PARSE
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.error("Suggestion JSON parse failed, raw:", raw);
      return [];
    }

  } catch (err) {
    console.error("Suggestion generation failed:", err);
    return [];
  }
}
