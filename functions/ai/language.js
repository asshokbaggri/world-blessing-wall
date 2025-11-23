import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function detectLanguage(text, apiKey) {
  const c = client(apiKey);

  const res = await c.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Detect input language. Respond with only the language code like: en, hi, ta, te, es, id, fr, ar, bn, ur, etc."
      },
      { role: "user", content: text }
    ]
  });

  return (res.choices[0].message.content || "unknown").trim();
}
