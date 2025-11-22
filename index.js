import { onCall, runWith } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";

import { respond } from "./utils/respond.js";
import { moderateText } from "./ai/moderation.js";
import { rewriteBlessing } from "./ai/rewrite.js";
import { enhanceBlessing } from "./ai/enhance.js";
import { detectLanguage } from "./ai/language.js";
import { generateSuggestions } from "./ai/suggestions.js";

// -------- SECRET DEFINITION (IMPORTANT) ----------
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
// --------------------------------------------------

admin.initializeApp();
const db = admin.firestore();

// MAIN FUNCTION
export const processBlessing = runWith({ secrets: ["OPENAI_API_KEY"] }).onCall(async (data) => {
  try {
    const apiKey = OPENAI_API_KEY.value(); // <-- Correct way
    if (!apiKey) return respond(false, "Missing OpenAI Key");

    const input = String(data.text || "").trim();
    const country = String(data.country || "").trim();
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
});

// SUGGESTIONS FUNCTION
export const blessingSuggestions = runWith({ secrets: ["OPENAI_API_KEY"] }).onCall(async (data) => {
  const apiKey = OPENAI_API_KEY.value();
  const country = String(data.country || "World");
  const list = await generateSuggestions(country, apiKey);
  return respond(true, "ok", list);
});
