"use strict";
/**
 * Session Routes
 *
 * REST endpoints for conversation session management.
 * Sessions are managed via WebSocket primarily, but these REST endpoints
 * provide simple CRUD and context retrieval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const diarization_1 = require("../services/diarization");
const ai_reply_1 = require("../services/ai-reply");
const router = (0, express_1.Router)();
/**
 * GET /api/session/:sessionId/context
 * Get the full conversation context for a session.
 */
router.get("/:sessionId/context", auth_1.requireAuth, (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        const context = (0, diarization_1.getConversationContext)(sessionId);
        return res.json({
            sessionId,
            utterances: context.utterances,
            fullTranscript: context.fullTranscript,
            durationSec: context.durationSec,
        });
    }
    catch (err) {
        return res.status(404).json({ error: "Session not found" });
    }
});
/**
 * POST /api/session/:sessionId/reply
 * Generate an AI reply for the current conversation context.
 * Body: { mode: "tactical"|"psychological"|"negotiation"|"general", objective?: string }
 */
router.post("/:sessionId/reply", auth_1.requireAuth, async (req, res) => {
    const sessionId = req.params.sessionId;
    const { mode, objective } = req.body;
    const validModes = [
        "tactical",
        "psychological",
        "negotiation",
        "general",
    ];
    const replyMode = validModes.includes(mode) ? mode : "general";
    try {
        const context = (0, diarization_1.getConversationContext)(sessionId);
        if (context.utterances.length === 0) {
            return res
                .status(400)
                .json({ error: "No conversation context available yet" });
        }
        const reply = await (0, ai_reply_1.generateReply)({
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
    }
    catch (err) {
        console.error("[session/reply] Error:", err);
        return res.status(500).json({ error: "Failed to generate reply" });
    }
});
exports.default = router;
//# sourceMappingURL=session.js.map