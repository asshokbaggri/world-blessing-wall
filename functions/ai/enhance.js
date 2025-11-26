import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function enhanceBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
You are a blessing enhancer.

Rules:
- Keep SAME language (${lang})
- Keep SAME tone, same vibe
- Do NOT translate
- Do NOT remove slang, Hinglish, emotions
- Do NOT remove adult words if user used them
- Do NOT add religious bias
- Make it more emotional, smoother, more heartfelt
- Output ONLY the enhanced blessing`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    return (res.choices?.[0]?.message?.content || text).trim();

  } catch (err) {
    console.error("Enhance failed:", err);
    return text;  // fallback, kabhi fail nahi karega
  }
}
