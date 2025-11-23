import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function generateSuggestions(text, lang, apiKey) {
  const c = client(apiKey);

  const res = await c.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Generate 5 short alternative blessings.
SAME language as user.
Keep tone warm, simple, positive.
Do NOT translate.
Return as JSON array: ["..","..",..]`
      },
      { role: "user", content: `Lang: ${lang}\nText: ${text}` }
    ]
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return [];
  }
}
