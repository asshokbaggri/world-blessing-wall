import functions from "firebase-functions";
import admin from "firebase-admin";
import { respond } from "./utils/respond.js";

import { moderateText } from "./ai/moderation.js";
import { rewriteBlessing } from "./ai/rewrite.js";
import { enhanceBlessing } from "./ai/enhance.js";
import { detectLanguage } from "./ai/language.js";
import { generateSuggestions } from "./ai/suggestions.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

admin.initializeApp();
const db = admin.firestore();

export const processBlessing = functions.https.onCall(async (data) => {
  try {
    const input = String(data.text || "").trim();
    const country = String(data.country || "").trim();
    if (!input) return respond(false, "Empty blessing");
    const mod = await moderateText(input);
    if (!mod.allowed) return respond(false, "Blocked content", { flags: mod.flags });
    const clean = await rewriteBlessing(input);
    const enhanced = await enhanceBlessing(clean);
    const lang = await detectLanguage(enhanced);
    return respond(true, "ok", { text: enhanced, language: lang });
  } catch (err) {
    return respond(false, "AI engine error");
  }
});

export const blessingSuggestions = functions.https.onCall(async (data) => {
  const country = String(data.country || "World");
  const list = await generateSuggestions(country);
  return respond(true, "ok", list);
});
