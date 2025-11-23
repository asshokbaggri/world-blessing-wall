import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function moderateText(text, apiKey) {
  const c = client(apiKey);

  const res = await c.moderations.create({
    model: "omni-moderation-latest",
    input: text,
  });

  const r = res.results?.[0];
  if (!r) return { allowed: true };

  const bad =
    r.categories.sexual ||
    r.categories.hate ||
    r.categories.violence ||
    r.categories.harassment ||
    r.categories.self_harm ||
    r.categories.sexual_minors ||
    r.categories.extremism;

  return { allowed: !bad, flags: r.categories };
}
