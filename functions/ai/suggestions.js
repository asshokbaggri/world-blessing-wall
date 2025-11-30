import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function generateSuggestions(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You generate 5 short blessing suggestions.
RULES:
- SAME language as user (${lang})
- Keep tone emotional, warm and positive
- Very short (1 line)
- No translation
- No religion bias
- No lecture
- Keep human + natural
- Output ONLY pure JSON array like:
["...", "...", "...", "...", "..."]`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    // Parse JSON safely
    const raw = res.choices?.[0]?.message?.content || "[]";

    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
      return [];
    } catch {
      console.error("Suggestion JSON parse failed, raw:", raw);
      return [];
    }
  } catch (err) {
    console.error("Suggestion generation failed:", err);
    return [];
  }
}
