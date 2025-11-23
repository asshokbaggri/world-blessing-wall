import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function rewriteBlessing(text, lang, apiKey) {
  const c = client(apiKey);

  const res = await c.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a blessing cleaner.  
Rewrite the text *in the SAME language*, keep meaning, keep tone.  
Fix grammar lightly. Never translate.`
      },
      { role: "user", content: `Language: ${lang}\nText: ${text}` }
    ]
  });

  return res.choices[0].message.content.trim();
}
