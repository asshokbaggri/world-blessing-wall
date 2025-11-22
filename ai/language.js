import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
export async function detectLanguage(text) {
  const prompt = `Detect language code (hi, en, ar, es, etc) for: "${text}"`;
  const res = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 10
  });
  return res.choices[0].message.content.trim().toLowerCase();
}