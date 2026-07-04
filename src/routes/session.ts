/**
 * Session Routes
 *
 * REST endpoints for conversation session management.
 * Sessions are managed via WebSocket primarily, but these REST endpoints
 * provide simple CRUD and context retrieval.
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getConversationContext,
} from "../services/diarization";
import { generateReply, ReplyMode } from "../services/ai-reply";

const router = Router();

/**
 * GET /api/session/:sessionId/context
 * Get the full conversation context for a session.
 */
router.get(
  "/:sessionId/context",
  requireAuth,
  (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;

    try {
      const context = getConversationContext(sessionId);
      return res.json({
        sessionId,
        utterances: context.utterances,
        fullTranscript: context.fullTranscript,
        durationSec: context.durationSec,
      });
    } catch (err) {
      return res.status(404).json({ error: "Session not found" });
    }
  }
);

/**
 * POST /api/session/:sessionId/reply
 * Generate an AI reply for the current conversation context.
 * Body: { mode: "tactical"|"psychological"|"negotiation"|"general", objective?: string }
 */
router.post(
  "/:sessionId/reply",
  requireAuth,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { mode, objective } = req.body;

    const validModes: ReplyMode[] = [
      "tactical",
      "psychological",
      "negotiation",
      "general",
    ];

    const replyMode: ReplyMode = validModes.includes(mode) ? mode : "general";

    try {
      const context = getConversationContext(sessionId);
      if (context.utterances.length === 0) {
        return res
          .status(400)
          .json({ error: "No conversation context available yet" });
      }

      const reply = await generateReply({
        context,
        mode: replyMode,
        objective: objective || "advance the conversation effectively",
      });

      return res.json({
        sessionId,
        reply: reply.text,
        mode: reply.mode,
        latencyMs: reply.latencyMs,
        model: reply.model,
      });
    } catch (err) {
      console.error("[session/reply] Error:", err);
      return res.status(500).json({ error: "Failed to generate reply" });
    }
  }
);

export default router;