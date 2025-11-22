import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });
export async function moderateText(text) {
  const res = await client.moderations.create({
    model: "omni-moderation-latest",
    input: text
  });
  const r = res.results?.[0];
  if (!r) return { allowed: true };
  const bad = r.categories.sexual || r.categories.hate || r.categories.violence ||
              r.categories.harassment || r.categories.self_harm ||
              r.categories.sexual_minors || r.categories.extremism;
  return { allowed: !bad, flags: r.categories };
}