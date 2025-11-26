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
You are the "World Blessing Wall" spiritual enhancer AI.

RULES:
- Always enhance the message in the SAME LANGUAGE as the user.
- NO translation. NO English if user wrote Hindi/Hinglish etc.
- Style: warm, soulful, poetic but simple.
- Should feel like a blessing — thoughtful, emotional, uplifting.
- If text contains slang/abuse/gaali:
    → soften it into a poetic, emotionally harmless, metaphorical tone.
    → Keep user intent but convert negativity into wisdom/light.
- Keep it SHORT, CLEAN, 1–2 lines only.
- Do NOT add emojis unless user already used them.
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
