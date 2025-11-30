import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function moderateText(text, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },

      messages: [
        {
          role: "system",
          content: `
You are a STRICT JSON-ONLY moderation engine for a public spiritual blessing wall.

Block ONLY if the text contains:
1) Child sexual content
2) Graphic sexual content (porn)
3) Self-harm or suicide encouragement
4) Terrorism praise / extremist recruitment
5) Direct violence threats to a person/group
6) Communal hate that can cause riots (religion/caste)
7) Incitement to harm

Allow EVERYTHING ELSE:
- Hinglish, Hindi, slang, gaali
- Light romance
- Emotional venting
- Sadness, depression (if NOT self-harm)
- Weird funny nonsense lines
- Typos, broken grammar

Return strictly:
{ "allowed": true/false, "reason": "text" }
`
        },
        { role: "user", content: text }
      ]
    });

    const parsed = res.choices?.[0]?.message?.content
      ? JSON.parse(res.choices[0].message.content)
      : { allowed: true };

    return {
      allowed: parsed.allowed !== false,
      reason: parsed.reason || null
    };

  } catch (err) {
    console.error("Moderation crashed → ALLOWING:", err);
    return { allowed: true };
  }
}
