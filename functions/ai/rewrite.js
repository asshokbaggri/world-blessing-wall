import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function rewriteBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-mini",   // ⚡ super fast + cheap + safe
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `
You lightly polish the blessing.

RULES:
- Keep SAME language (${lang})
- NO translation
- NO tone change
- NO emotion change
- NO removing slang / Hinglish
- NO removing adult words if user wrote them
- NO long rewrite → ONLY light cleaning
- Output ONLY pure text.`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const out = res.choices?.[0]?.message?.content || text;
    return out.trim();

  } catch (err) {
    console.error("Rewrite failed:", err);
    return text;
  }
}
