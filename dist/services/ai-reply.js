"use strict";
/**
 * AI Reply Engine
 *
 * Takes the current conversation context (transcript of what's been said)
 * and generates a tactical, persuasive, or negotiation-optimised reply
 * using Cerebras (OpenAI-compatible API).
 *
 * Cerebras offers sub-millisecond inference on CS-3 hardware — perfect for
 * sub-500ms real-time conversation whisper replies.
 *
 * Models:
 *   - gemma-4-31b (fast, low-latency) for most replies
 *   - gpt-oss-120b (deeper reasoning) for complex negotiation scenarios
 *
 * The system prompt dynamically adjusts based on the conversation mode:
 *   "tactical", "psychological", "negotiation", or "general".
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReply = generateReply;
exports.generateQuickReply = generateQuickReply;
const config_1 = require("../config");
const openai_1 = __importDefault(require("openai"));
// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
const SYSTEM_PROMPTS = {
    tactical: `You are a tactical conversation advisor. Your role is to help the user
navigate high-stakes conversations by suggesting the most strategically effective
response. Be concise, direct, and actionable. Consider timing, framing, and
positioning. Prioritise responses that maintain the user's advantage.`,
    psychological: `You are a psychological persuasion expert. Analyse the conversation for
emotional cues, cognitive biases, and hidden motivations. Suggest responses that
build rapport, establish trust, and leverage psychological principles (reciprocity,
scarcity, authority, consistency, liking, social proof) to influence the outcome.
Be subtle — never sound manipulative.`,
    negotiation: `You are a world-class negotiation coach trained in Harvard-style principled
negotiation. Help the user create value, claim value, and find mutual gains.
Suggest BATNA-aware moves, anchoring strategies, and de-escalation techniques.
Always separate people from the problem. Focus on interests, not positions.`,
    general: `You are a real-time conversation assistant. Listen to the ongoing
conversation and suggest a natural, helpful response that advances the
user's goals. Be concise and sound like a real person — not a robot.`,
};
// ---------------------------------------------------------------------------
// Cerebras client (OpenAI-compatible API)
// ---------------------------------------------------------------------------
const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
let cerebrasClient = null;
function getCerebrasClient() {
    if (cerebrasClient)
        return cerebrasClient;
    if (!config_1.config.cerebrasApiKey) {
        throw new Error("CEREBRAS_API_KEY is not configured");
    }
    cerebrasClient = new openai_1.default({
        apiKey: config_1.config.cerebrasApiKey,
        baseURL: CEREBRAS_BASE_URL,
    });
    return cerebrasClient;
}
// ---------------------------------------------------------------------------
// Generate reply
// ---------------------------------------------------------------------------
async function generateReply(request) {
    const start = Date.now();
    const client = getCerebrasClient();
    const systemPrompt = SYSTEM_PROMPTS[request.mode];
    const maxWords = request.maxWords ?? 30;
    const objective = request.objective ?? "advance the conversation effectively";
    const userPrompt = buildUserPrompt(request.context, objective, maxWords);
    // Gemma-4-31b — fast enough for sub-second replies in all modes
    const model = "gemma-4-31b";
    const response = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        max_tokens: maxWords * 3, // ~3 tokens per word on average
        temperature: 0.7,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
    });
    const latencyMs = Date.now() - start;
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return {
        text,
        mode: request.mode,
        latencyMs,
        model,
    };
}
// ---------------------------------------------------------------------------
// Build user prompt from conversation context
// ---------------------------------------------------------------------------
function buildUserPrompt(context, objective, maxWords) {
    return `Here is the conversation so far:

${context.fullTranscript}

The user's objective: ${objective}

Suggest the next thing the user should say (max ${maxWords} words). 
Output ONLY the suggested reply — no preamble, no explanation, no quotes around it.

Suggested reply:`;
}
// ---------------------------------------------------------------------------
// Quick reply (sub-500ms shortcut for simple queries)
// ---------------------------------------------------------------------------
async function generateQuickReply(context, mode = "general") {
    const response = await generateReply({
        context,
        mode,
        maxWords: 20,
    });
    return response;
}
//# sourceMappingURL=ai-reply.js.map