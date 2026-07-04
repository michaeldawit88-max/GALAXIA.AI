"use strict";
/**
 * Voiceprint Routes
 *
 * Endpoints for calibrating / enrolling a user's voiceprint.
 * The mobile app sends an audio sample after sign-up, which is turned
 * into a voice embedding and stored for later diarization matching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const voiceprint_1 = require("../services/voiceprint");
const router = (0, express_1.Router)();
/**
 * POST /api/voiceprint/enroll
 * Enroll (create or update) a voiceprint for the authenticated user.
 * Body: { audio: "<base64 PCM16 audio>", sampleRate?: number }
 */
router.post("/enroll", auth_1.requireAuth, async (req, res) => {
    try {
        const { audio, sampleRate } = req.body;
        if (!audio || typeof audio !== "string") {
            return res.status(400).json({ error: "audio (base64) is required" });
        }
        const audioBuffer = Buffer.from(audio, "base64");
        if (audioBuffer.length < 1024) {
            return res
                .status(400)
                .json({ error: "Audio sample too short (< 1024 bytes)" });
        }
        const embedding = await (0, voiceprint_1.generateVoiceEmbedding)(audioBuffer, sampleRate ?? 16000);
        (0, voiceprint_1.storeVoiceprint)(req.user.uid, embedding);
        return res.json({
            success: true,
            uid: req.user.uid,
            embeddingLength: embedding.length,
        });
    }
    catch (err) {
        console.error("[voiceprint/enroll] Error:", err);
        return res.status(500).json({ error: "Failed to enroll voiceprint" });
    }
});
/**
 * GET /api/voiceprint/status
 * Check if the authenticated user has a voiceprint enrolled.
 */
router.get("/status", auth_1.requireAuth, (req, res) => {
    const enrolled = (0, voiceprint_1.hasVoiceprint)(req.user.uid);
    return res.json({
        uid: req.user.uid,
        enrolled,
    });
});
/**
 * DELETE /api/voiceprint
 * Delete the authenticated user's voiceprint.
 */
router.delete("/", auth_1.requireAuth, (req, res) => {
    (0, voiceprint_1.deleteVoiceprint)(req.user.uid);
    return res.json({
        success: true,
        message: "Voiceprint deleted",
    });
});
/**
 * GET /api/voiceprint/stats
 * Admin/diagnostics: total enrolled voiceprints.
 */
router.get("/stats", (_req, res) => {
    return res.json({
        totalVoiceprints: (0, voiceprint_1.voiceprintCount)(),
    });
});
exports.default = router;
//# sourceMappingURL=voiceprint.js.map