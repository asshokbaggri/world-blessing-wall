import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function moderateText(text, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a strict content moderation engine for a public blessing wall.
ONLY block if the text contains:
- Child sexual content
- Extreme hate / genocide promotion
- Serious violence threats
- Terrorism / extremist praise

Do NOT block:
- Normal adult language (gaali)
- Hinglish slang
- Funny weird lines
- Emotional strong words

Return JSON only:
{ "allowed": true/false, "reason": "text" }
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    let parsed = {};
    try {
      parsed = JSON.parse(res.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = { allowed: true };
    }

    return {
      allowed: parsed.allowed !== false,
      reason: parsed.reason || null
    };

  } catch (err) {
    console.error("Moderation failed → allowing by default:", err);
    return { allowed: true };
  }
}
