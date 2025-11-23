import OpenAI from "openai";

export function createClient(apiKey) {
  return new OpenAI({ apiKey });
}

export async function enhanceBlessing(text, apiKey) {
  const client = createClient(apiKey);

  const prompt = `Enhance this blessing with universal spiritual emotion but keep it short: "${text}"`;

  const res = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 70,
  });

  return res.choices[0].message.content.trim();
}
