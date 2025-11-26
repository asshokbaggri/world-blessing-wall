import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function detectLanguage(text, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Detect the language of the user input.
Return ONLY a lowercase 2-letter ISO code.

Rules:
- Hindi, Hinglish, Urdu mixed → return "hi"
- Roman Hindi (e.g. "mera dil khush ho") → return "hi"
- English → "en"
- Bhojpuri / Haryanvi / Marathi slang → closest code (mostly hi)
- Only output the code. No explanation.
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    return (res.choices?.[0]?.message?.content || "unknown").trim();

  } catch (err) {
    console.error("Language detect failed:", err);
    return "en"; // safe fallback
  }
}
