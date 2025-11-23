import OpenAI from "openai";

export function createClient(apiKey) {
  return new OpenAI({ apiKey });
}
export async function rewriteBlessing(raw) {
  const prompt = `Rewrite this message into a clean, spiritual blessing. No religion, no god names, no negativity. "${raw}"`;
  const res = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 60,
    temperature: 0.6
  });
  return res.choices[0].message.content.trim();
}
