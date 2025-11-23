import OpenAI from "openai";

export function createClient(apiKey) {
  return new OpenAI({ apiKey });
}

export async function generateSuggestions(country, apiKey) {
  const client = createClient(apiKey);

  const prompt = `Generate 3 short blessings. No religion. Country: ${country}. Return ["","",""].`;

  const res = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 80,
    temperature: 0.7,
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return [];
  }
}

