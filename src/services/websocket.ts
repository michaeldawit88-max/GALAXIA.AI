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

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { v4 as uuidv4 } from "uuid";
import { verifyIdToken } from "./auth";
import {
  createSession,
  destroySession,
  addUtterance,
  getConversationContext,
  createDeepgramLiveConnection,
} from "./diarization";
import { generateReply } from "./ai-reply";
import type { ReplyMode } from "./ai-reply";
import {
  startSession,
  endSession,
  getUsageSummary,
  canStartSession,
  ensureTables,
} from "./usage";

// ---------------------------------------------------------------------------
// Client session state
// ---------------------------------------------------------------------------

interface ClientState {
  uid: string;
  sessionId: string;
  mode: ReplyMode;
  authenticated: boolean;
  connectedAt: Date;
}

const clients = new Map<WebSocket, ClientState>();

// ---------------------------------------------------------------------------
// Initialize & start
// ---------------------------------------------------------------------------

export function initWebSocketServer(httpServer: Server): WebSocketServer {
  // Ensure DB tables exist
  ensureTables();

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    const clientId = uuidv4();
    console.log(`[ws] New connection: ${clientId}`);

    clients.set(ws, {
      uid: "",
      sessionId: "",
      mode: "general",
      authenticated: false,
      connectedAt: new Date(),
    });

    ws.on("message", async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString("utf-8"));
        await handleMessage(ws, msg);
      } catch (err) {
        send(ws, {
          type: "error",
          message: `Invalid message: ${
            err instanceof Error ? err.message : "parse error"
          }`,
        });
      }
    });

    ws.on("close", async () => {
      const state = clients.get(ws);
      if (state?.uid && state.sessionId) {
        endSession(state.uid, state.sessionId);
        destroySession(state.sessionId);
        console.log(
          `[ws] Session ended: ${state.uid}/${state.sessionId}`
        );
      }
      clients.delete(ws);
      console.log(`[ws] Connection closed: ${clientId}`);
    });

    ws.on("error", (err) => {
      console.error(`[ws] Error on ${clientId}:`, err.message);
    });

    // Send welcome
    send(ws, {
      type: "connected",
      clientId,
      timestamp: new Date().toISOString(),
    });
  });

  console.log("[ws] WebSocket server initialized on /ws");
  return wss;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

async function handleMessage(ws: WebSocket, msg: any) {
  const state = clients.get(ws);
  if (!state) return;

  switch (msg.type) {
    case "start_session":
      await handleStartSession(ws, state, msg);
      break;

    case "end_session":
      await handleEndSession(ws, state, msg);
      break;

    case "audio":
      handleAudio(ws, state, msg);
      break;

    case "set_mode":
      handleSetMode(ws, state, msg);
      break;

    case "get_usage":
      handleGetUsage(ws, state);
      break;

    default:
      send(ws, {
        type: "error",
        message: `Unknown message type: ${msg.type}`,
      });
  }
}

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

async function handleStartSession(
  ws: WebSocket,
  state: ClientState,
  msg: any
) {
  const { uid, token, sessionId, mode } = msg;

  if (!uid || !token) {
    return send(ws, {
      type: "error",
      message: "start_session requires uid and token",
    });
  }

  // Verify Firebase token
  const decoded = await verifyIdToken(token);
  if (!decoded || decoded.uid !== uid) {
    return send(ws, {
      type: "error",
      message: "Authentication failed — invalid token",
    });
  }

  // Check usage limits
  if (!canStartSession(uid)) {
    return send(ws, {
      type: "limit_reached",
      message:
        "You've used all 20 minutes of your free tier this week. Upgrade to paid for unlimited usage.",
    });
  }

  const sid = sessionId || uuidv4();

  // Record session start
  const usageRecord = startSession(uid, sid);

  // Create diarization session
  createSession(sid);

  // Send usage summary
  const usage = getUsageSummary(uid);

  state.uid = uid;
  state.sessionId = sid;
  state.mode = mode || "general";
  state.authenticated = true;

  send(ws, {
    type: "session_started",
    sessionId: sid,
    usage,
  });

  console.log(`[ws] Session started: ${uid}/${sid} (${state.mode})`);
}

// ---------------------------------------------------------------------------
// End session
// ---------------------------------------------------------------------------

async function handleEndSession(
  ws: WebSocket,
  state: ClientState,
  msg: any
) {
  if (!state.uid || !state.sessionId) {
    return send(ws, { type: "error", message: "No active session" });
  }

  const record = endSession(state.uid, state.sessionId);
  destroySession(state.sessionId);

  const usage = getUsageSummary(state.uid);

  send(ws, {
    type: "session_ended",
    sessionId: state.sessionId,
    durationSec: record.durationSec,
    usage,
  });

  state.sessionId = "";
  console.log(
    `[ws] Session ended: ${state.uid}/${msg.sessionId} (${record.durationSec}s)`
  );
}

// ---------------------------------------------------------------------------
// Audio chunk handler
// ---------------------------------------------------------------------------

function handleAudio(ws: WebSocket, state: ClientState, msg: any) {
  if (!state.authenticated || !state.sessionId) {
    return send(ws, {
      type: "error",
      message: "Must start a session before sending audio",
    });
  }

  // In production: forward the audio chunk to Deepgram live connection.
  // For now, we echo back a placeholder utterance for development testing.
  const utterance = {
    type: "utterance" as const,
    speaker: "other" as const,
    text: "(audio received — processing)",
    confidence: 0.9,
  };

  send(ws, utterance);

  // Store the utterance in the conversation context
  addUtterance(state.sessionId, {
    text: utterance.text,
    speaker: utterance.speaker,
    start: Date.now() / 1000,
    end: (Date.now() + 2) / 1000,
    words: [],
  });
}

// ---------------------------------------------------------------------------
// Set mode
// ---------------------------------------------------------------------------

function handleSetMode(ws: WebSocket, state: ClientState, msg: any) {
  const validModes: ReplyMode[] = [
    "tactical",
    "psychological",
    "negotiation",
    "general",
  ];

  if (!validModes.includes(msg.mode)) {
    return send(ws, {
      type: "error",
      message: `Invalid mode. Valid modes: ${validModes.join(", ")}`,
    });
  }

  state.mode = msg.mode as ReplyMode;

  send(ws, {
    type: "mode_set",
    mode: state.mode,
  });
}

// ---------------------------------------------------------------------------
// Get usage
// ---------------------------------------------------------------------------

function handleGetUsage(ws: WebSocket, state: ClientState) {
  if (!state.uid) {
    return send(ws, { type: "error", message: "Not authenticated" });
  }

  const usage = getUsageSummary(state.uid);
  send(ws, { type: "usage", ...usage });
}

// ---------------------------------------------------------------------------
// Helper: send JSON to client
// ---------------------------------------------------------------------------

function send(ws: WebSocket, data: Record<string, any>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}