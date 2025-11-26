// ai/enhance.js

import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function enhanceBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-2024-11-20",   // YE WAALA EXACT NAAM USE KAR
      temperature: 0.9,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `Tu duniya ka sabse best spiritual blessing enhancer hai.
Jo bhi user likhe — Hindi, Hinglish, Tamil, Bengali, gaali, adult, funny, emotional — sabko 10x zyada sundar, dil ko chhune wala, addictive bana de.
Same language mein hi rakho, bilkul translate mat karna.
Slang/gaali ho to usko bhi poetic bana do.
Sirf enhanced blessing output karo, kuch extra mat likhna.`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const result = res.choices?.[0]?.message?.content?.trim();
    if (result) {
      console.log("ENHANCED:", result);
      return result;
    }
    return text;

  } catch (err) {
    console.error("ENHANCE FAILED:", err.message, err.status || err.code);
    return text;
  }
}
