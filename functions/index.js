import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";

import { respond } from "./utils/respond.js";
import { moderateText } from "./ai/moderation.js";
import { detectLanguage } from "./ai/language.js";
import { rewriteBlessing } from "./ai/rewrite.js";
import { enhanceBlessing } from "./ai/enhance.js";
import { generateSuggestions } from "./ai/suggestions.js";

const OPENAI_KEY = defineSecret("OPENAI_KEY");

admin.initializeApp();

export const processBlessing = onRequest(
  {
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "2GiB",
    cpu: 2,
    secrets: [OPENAI_KEY]
  },
  async (req) => {
    try {
      const apiKey = OPENAI_KEY.value();
      if (!apiKey) return respond(false, "Missing API key");

      const input = String(req.data.text || "").trim();
      if (!input) return respond(false, "Empty blessing");

      // 1) moderation
      const mod = await moderateText(input, apiKey);
      if (!mod.allowed) return respond(false, "Blocked", { flags: mod.flags });

      // 2) detect language
      const lang = await detectLanguage(input, apiKey);

      // 3) rewrite
      const cleaned = await rewriteBlessing(input, lang, apiKey);

      // 4) enhance same language
      const enhanced = await enhanceBlessing(cleaned, lang, apiKey);

      // 5) suggestions same language
      const suggestions = await generateSuggestions(input, lang, apiKey);

      return respond(true, "ok", {
        language: lang,
        enhanced,
        suggestions
      });

    } catch (err) {
      console.log("AI error", err);
      return respond(false, "AI engine error");
    }
  }
);
