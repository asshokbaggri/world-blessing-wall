import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function enhanceBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  const res = await c.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a blessing enhancer.
Enhance the emotional tone but keep it natural.
Keep SAME language, SAME tone.
Do NOT translate or change the language.
Do NOT add religious bias.
Keep it short, clean, natural.`
      },
      {
        role: "user",
        content: `Language: ${lang}\nOriginal: ${text}`
      }
    ]
  });

  const output = res.choices?.[0]?.message?.content || "";
  return output.trim();
}
