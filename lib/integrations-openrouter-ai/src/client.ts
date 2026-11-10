import OpenAI from "openai";

// Priority:
//  1. OPENROUTER_API_KEY  — custom key (user-owned, cadangan mandiri)
//  2. AI_INTEGRATIONS_OPENROUTER_API_KEY — Replit-managed proxy
//
// Base URL follows the key: custom key always hits openrouter.ai directly;
// Replit key goes through the Replit proxy URL.

const customKey = process.env.OPENROUTER_API_KEY;
const replitKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
const replitBase = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;

const apiKey = customKey || replitKey;
const baseURL = customKey
  ? "https://openrouter.ai/api/v1"
  : replitBase;

if (!apiKey) {
  throw new Error(
    "No OpenRouter API key found. Set OPENROUTER_API_KEY (custom) or provision the Replit OpenRouter AI integration (AI_INTEGRATIONS_OPENROUTER_API_KEY).",
  );
}

if (!baseURL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENROUTER_BASE_URL must be set when using the Replit OpenRouter integration.",
  );
}

export const openrouter = new OpenAI({ baseURL, apiKey });

/** Which key source is active — useful for logging/debugging */
export const openrouterKeySource: "custom" | "replit" = customKey ? "custom" : "replit";
