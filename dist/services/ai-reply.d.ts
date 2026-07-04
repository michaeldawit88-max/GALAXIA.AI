/**
 * AI Reply Engine
 *
 * Takes the current conversation context (transcript of what's been said)
 * and generates a tactical, persuasive, or negotiation-optimised reply
 * using OpenAI.
 *
 * Models:
 *   - gpt-4o-mini (fast, low-latency) for most replies
 *   - gpt-4o (deeper reasoning) for complex negotiation scenarios
 *
 * The system prompt dynamically adjusts based on the conversation mode:
 *   "tactical", "psychological", "negotiation", or "general".
 */
import type { ConversationContext } from "./diarization";
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
export declare function generateReply(request: ReplyRequest): Promise<ReplyResponse>;
export declare function generateQuickReply(context: ConversationContext, mode?: ReplyMode): Promise<ReplyResponse>;
//# sourceMappingURL=ai-reply.d.ts.map