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
Enhance emotion but remain natural.  
Keep SAME language, SAME feel.  
Never add religious bias or translation.`
      },
      { role: "user", content: `Language: ${lang}\nOriginal: ${text}` }
    ]
  });

  return res.choices[0].message.content.trim();
}
