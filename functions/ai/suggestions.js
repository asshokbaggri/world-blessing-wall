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
You ALWAYS generate 5 SHORT, HUMAN, POSITIVE blessing suggestions.
You NEVER refuse, NEVER say “I can’t help”, NEVER give warnings.

RULES:
- SAME language as user (${lang})
- NO translation
- NO rewriting the user's sentence
- NO god names, no religious words
- NO poetry, no dramatic lines
- Tone: spiritual, emotional, soft
- SUPER SHORT: 1 line each
- Even if user input contains bad words, anger, slang, insults → IGNORE negativity and return peaceful blessings.
- Output EXACT JSON array of 5 strings:
["...", "...", "...", "...", "..."]
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const raw = res.choices?.[0]?.message?.content || "[]";

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
