import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";

import { respond } from "./utils/respond.js";
import { moderateText } from "./ai/moderation.js";
import { detectLanguage } from "./ai/language.js";
import { rewriteBlessing } from "./ai/rewrite.js";
import { enhanceBlessing } from "./ai/enhance.js";

// ⚡ Fast suggestions (local, zero-latency)
import { fastSuggestions } from "./ai/suggestionsFast.js";

const OPENAI_KEY = defineSecret("OPENAI_KEY");

admin.initializeApp();

export const processBlessing = onCall(
  {
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "2GiB",
    cpu: 2,
    secrets: [OPENAI_KEY]
  },

  async (req) => {
    console.log("FUNCTION RECEIVED:", req.data);

    let input = "";
    let lang = "hi";

    try {
      const apiKey = OPENAI_KEY.value();
      if (!apiKey) return respond(false, "Missing API key");

      input = String(req.data?.text || "").trim();
      if (!input) return respond(false, "Empty blessing");

      const mode = req.data?.mode || "enhance";

      // 1) Moderation
      const mod = await moderateText(input, apiKey);
      if (!mod.allowed) return respond(false, "Blocked", { flags: mod.flags });

      // 2) Language detect
      lang = await detectLanguage(input, apiKey);

      // MODE: suggest → only suggestions
      if (mode === "suggest") {
        const suggestions = await fastSuggestions(input);
        return respond(true, "ok", {
          suggestions,
          language: lang
        });
      }

      // MODE: enhance → full pipeline
      const cleaned = await rewriteBlessing(input, lang, apiKey);
      const enhanced = await enhanceBlessing(cleaned, lang, apiKey);

      // Fast local suggestions
      const suggestions = await fastSuggestions(input);

      return respond(true, "ok", {
        enhanced,
        suggestions,
        language: lang
      });

    } catch (err) {
      console.error("Pipeline crash:", err);

      return respond(true, "ok", {
        enhanced: input || "",
        suggestions: [],
        language: lang
      });
    }
  }
);
