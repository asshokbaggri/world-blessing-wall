import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function fastSuggestions(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-mini",      // ⚡ super cheap + blazing fast
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: `
You generate 5 SHORT, HUMAN, NATURAL blessing suggestions.

RULES:
- SAME language as user (${lang})
- NO translation
- NO rewriting user input
- NO religion / no god names
- Very natural, warm, emotional
- 1 short line only
- Based on user's intention
- Output ONLY valid JSON array of 5 strings
`
        },
        { role: "user", content: text }
      ]
    });

    const raw = res.choices?.[0]?.message?.content || "[]";

    let arr = [];
    try {
      arr = JSON.parse(raw);
      if (!Array.isArray(arr)) arr = [];
    } catch {
      console.error("fastSuggestions JSON parse failed:", raw);
      arr = [];
    }

    // ⭐ RETURN OBJECT (IMPORTANT)
    return { 
      suggestions: arr,
      language: lang
    };

  } catch (err) {
    console.error("fastSuggestions AI error:", err);

    return { 
      suggestions: [],
      language: lang
    };
  }
}
