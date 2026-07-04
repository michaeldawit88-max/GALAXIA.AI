/**
 * WebSocket Server
 *
 * Real-time bi-directional streaming between the mobile app and backend.
 * Handles:
 *   - Live audio chunks → diarization pipeline → transcription
 *   - Context analysis → AI reply generation → reply whispers back
 *   - Session start/end lifecycle
 *   - Usage tracking (start/end, enforce limits)
 *
 * Protocol:
 *   Client → Server:
 *     { type: "audio", data: "<base64 PCM16 chunk>" }
 *     { type: "start_session", sessionId: "<uuid>", uid: "<uid>", token: "<Firebase token>" }
 *     { type: "end_session", sessionId: "<uuid>" }
 *     { type: "set_mode", mode: "tactical"|"psychological"|"negotiation"|"general" }
 *
 *   Server → Client:
 *     { type: "utterance", speaker: "user"|"other", text: "...", confidence: 0.95 }
 *     { type: "reply", text: "...", mode: "tactical", latencyMs: 350 }
 *     { type: "usage", usedMinutes: 12, remainingMinutes: 8, tier: "free" }
 *     { type: "error", message: "..." }
 *     { type: "limit_reached", message: "Weekly free tier limit reached" }
 */
import { WebSocketServer } from "ws";
import type { Server } from "http";
export declare function initWebSocketServer(httpServer: Server): WebSocketServer;
//# sourceMappingURL=websocket.d.ts.map