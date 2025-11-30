import OpenAI from "openai";

export function client(apiKey) {
  return new OpenAI({ apiKey });
}

export async function detectLanguage(text, apiKey) {
  const c = client(apiKey);

  try {
    const res = await c.chat.completions.create({
      model: "gpt-4o-mini",   // ⚡ global + fast
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a global language detection engine.

Return ONLY a 2-letter ISO language code.
No explanation, no text, only code.

**India Rules (highest priority)**:
- Hindi / Hinglish / Urdu / Roman Hindi → "hi"
- Marathi / Bhojpuri / Haryanvi / Punjabi slang → "hi"

**Global Rules**:
- English → "en"
- Spanish → "es"
- Arabic → "ar"
- Indonesian → "id"
- French → "fr"
- German → "de"
- Italian → "it"
- Portuguese → "pt"
- Russian → "ru"
- Turkish → "tr"
- Japanese → "ja"
- Korean → "ko"
- Chinese (Simplified) → "zh"
- Chinese (Traditional) → "zh"
- Malay → "ms"
- Thai → "th"
- Vietnamese → "vi"
- Bengali → "bn"
- Tamil → "ta"
- Telugu → "te"
- Kannada → "kn"
- Malayalam → "ml"
- Gujarati → "gu"
- Nepali → "ne"
- Sinhala → "si"

If unsure → output "en".
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    let code = (res.choices?.[0]?.message?.content || "en").trim().toLowerCase();

    // Ensure final code is valid
    if (code.length !== 2) code = "en";

    return code;

  } catch (err) {
    console.error("Language detect failed:", err);
    return "en"; // safest global fallback
  }
}
