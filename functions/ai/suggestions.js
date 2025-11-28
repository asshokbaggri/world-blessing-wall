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
You're a blessing-suggestion generator.
Your job is to detect the MAIN THEME of the user's blessing
(e.g., mother-father, family, world peace, money, career, love, health, spirituality)
and generate 5 ultra-short lines matching EXACTLY that theme.

RULES:
- ABSOLUTELY same theme as user input.
- Same language as user: ${lang}
- Short (6–12 words)
- Warm, human, soft-spiritual tone
- NOT poetic, NOT rhyming
- NO over-motivational or lecture tone
- NO emojis
- NO translation
- Output ONLY JSON array of strings:
  ["...", "...", "...", "...", "..."]
`
        },
        {
          role: "user",
          content: `User blessing: "${text}"
Extract theme + generate 5 short blessing lines in same language and same theme.`
        }
      ]
    });

    const raw = res?.choices?.[0]?.message?.content || "[]";

    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(0, 3) : [];
    } catch {
      console.error("Suggestion JSON parse failed. Raw:", raw);
      return [];
    }

  } catch (err) {
    console.error("Suggestion generation failed:", err);
    return [];
  }
}
