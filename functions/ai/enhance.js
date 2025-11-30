// ai/enhance.js

import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function enhanceBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",       // 🔥 Stable + Future-proof
      temperature: 0.85,     // 🔥 Balanced creativity
      max_tokens: 200,

      messages: [
        {
          role: "system",
          content: `
You are the official "World Blessing Wall" enhancer AI.

GOAL:
Turn any raw blessing into a heartfelt, uplifting, soulful message —
BUT strictly in the SAME LANGUAGE as the user (${lang}).

STRICT RULES:
- NO translation. NO mixing languages.
- Style: simple, warm, human, emotional — NOT heavy poetry.
- Keep it SHORT (1–2 lines).
- If text has slang/gaali:
    → soften it into a wise, emotionally positive, non-offensive line.
    → Do NOT remove the user's intent.
- Never add religious gods (Ram/Allah/Jesus/etc.) unless user wrote them.
- Never change meaning.
- Never lecture.
- Emojis only if user used them.
- Output ONLY the enhanced blessing. No explanation.
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const result = res.choices?.[0]?.message?.content?.trim();

    if (result && result.length > 0) {
      console.log("ENHANCED:", result);
      return result;
    }

    // fallback
    return text;

  } catch (err) {
    console.error("ENHANCE FAILED:", err.message || err);
    return text;
  }
}
