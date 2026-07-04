import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Firebase Admin SDK — service account JSON, base64-encoded
  firebaseServiceAccountB64: process.env.FIREBASE_SERVICE_ACCOUNT_B64 || "",

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || "",

  // Deepgram
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || "",

  // Turso (usage tracking DB)
  tursoDbUrl: process.env.TURSO_DB_URL || "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN || "",

  // Usage limits
  freeTierMinutesPerWeek: 20,
  get isProduction() {
    return this.nodeEnv === "production";
  },
  get isDevelopment() {
    return this.nodeEnv === "development";
  },
};