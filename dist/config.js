"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from project root
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "..", ".env") });
exports.config = {
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
//# sourceMappingURL=config.js.map