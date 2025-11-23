import { onCall } from "firebase-functions/v2/https";   
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";

import { respond } from "./utils/respond.js";
import { moderateText } from "./ai/moderation.js";
import { rewriteBlessing } from "./ai/rewrite.js";
import { enhanceBlessing } from "./ai/enhance.js";
import { detectLanguage } from "./ai/language.js";
import { generateSuggestions } from "./ai/suggestions.js";

// SECRET
const OPENAI_KEY = defineSecret("OPENAI_KEY");

admin.initializeApp();
const db = admin.firestore();

export const processBlessing = onCall(
  {
    memory: "2GiB",
    timeoutSeconds: 540,
    region: "asia-south1",
    secrets: [OPENAI_KEY],  
    maxInstances: 100,
    cpu: 2
  },
  async (request) => {
    try {
      const apiKey = OPENAI_KEY.value();
      if (!apiKey) return respond(false, "Missing API Key");

      const input = String(request.data.text || "").trim();
      if (!input) return respond(false, "Empty blessing");

      const mod = await moderateText(input, apiKey);
      if (!mod.allowed) return respond(false, "Blocked content", { flags: mod.flags });

      const clean = await rewriteBlessing(input, apiKey);
      const enhanced = await enhanceBlessing(clean, apiKey);
      const lang = await detectLanguage(enhanced, apiKey);

      return respond(true, "ok", { text: enhanced, language: lang });
    } catch (err) {
      return respond(false, "AI engine error");
    }
  }
);
