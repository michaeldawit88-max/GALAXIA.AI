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
 *   - cerebras-llama-3.3-70b (fast, low-latency) for most replies
 *   - cerebras-llama-3.1-8b (lighter) for simple queries
 *
 * The system prompt dynamically adjusts based on the conversation mode:
 *   "tactical", "psychological", "negotiation", or "general".
 */

import { config } from "../config";
import OpenAI from "openai";
import type { ConversationContext } from "./diarization";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReplyMode = "tactical" | "psychological" | "negotiation" | "general";

export interface ReplyRequest {
  context: ConversationContext;
  mode: ReplyMode;
  /** Optional: what the user wants to achieve (e.g., "close the deal", "get a raise") */
  objective?: string;
  /** Optional: maximum response length in words */
  maxWords?: number;
}

export interface ReplyResponse {
  text: string;
  mode: ReplyMode;
  /** Time taken to generate (ms) */
  latencyMs: number;
  model: string;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<ReplyMode, string> = {
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

let cerebrasClient: OpenAI | null = null;

function getCerebrasClient(): OpenAI {
  if (cerebrasClient) return cerebrasClient;

  if (!config.cerebrasApiKey) {
    throw new Error("CEREBRAS_API_KEY is not configured");
  }

  cerebrasClient = new OpenAI({
    apiKey: config.cerebrasApiKey,
    baseURL: CEREBRAS_BASE_URL,
  });
  return cerebrasClient;
}

// ---------------------------------------------------------------------------
// Generate reply
// ---------------------------------------------------------------------------

export async function generateReply(request: ReplyRequest): Promise<ReplyResponse> {
  const start = Date.now();
  const client = getCerebrasClient();

  const systemPrompt = SYSTEM_PROMPTS[request.mode];
  const maxWords = request.maxWords ?? 30;
  const objective = request.objective ?? "advance the conversation effectively";

  const userPrompt = buildUserPrompt(request.context, objective, maxWords);

  // Cerebras Llama-3.3-70b — fast enough for sub-second replies in all modes
  const model = "cerebras-llama-3.3-70b";

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

function buildUserPrompt(
  context: ConversationContext,
  objective: string,
  maxWords: number
): string {
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

export async function generateQuickReply(
  context: ConversationContext,
  mode: ReplyMode = "general"
): Promise<ReplyResponse> {
  const response = await generateReply({
    context,
    mode,
    maxWords: 20,
  });
  return response;
}