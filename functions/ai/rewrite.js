import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function rewriteBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4, // light polishing only
      messages: [
        {
          role: "system",
          content: `
You are a rewrite engine for blessings.

Rules:
- Keep SAME language (${lang}), SAME tone, SAME emotion.
- Do NOT translate.
- Do NOT reduce slang, Hinglish, or emotional style.
- Do NOT remove adult words if user wrote them.
- Just make it slightly cleaner, natural, readable.
- Keep meaning EXACT same.
- Output ONLY the rewritten text.`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    return (res.choices?.[0]?.message?.content || text).trim();

  } catch (err) {
    console.error("Rewrite failed:", err);
    return text; // fallback
  }
}
