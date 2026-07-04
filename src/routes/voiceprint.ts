/**
 * Voiceprint Routes
 *
 * Endpoints for calibrating / enrolling a user's voiceprint.
 * The mobile app sends an audio sample after sign-up, which is turned
 * into a voice embedding and stored for later diarization matching.
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import {
  generateVoiceEmbedding,
  storeVoiceprint,
  getVoiceprint,
  hasVoiceprint,
  deleteVoiceprint,
  voiceprintCount,
  matchVoiceprint,
  compareVoiceprints,
} from "../services/voiceprint";

const router = Router();

/**
 * POST /api/voiceprint/enroll
 * Enroll (create or update) a voiceprint for the authenticated user.
 * Body: { audio: "<base64 PCM16 audio>", sampleRate?: number }
 */
router.post("/enroll", requireAuth, async (req: Request, res: Response) => {
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

    const embedding = await generateVoiceEmbedding(
      audioBuffer,
      sampleRate ?? 16000
    );

    storeVoiceprint(req.user!.uid, embedding);

    return res.json({
      success: true,
      uid: req.user!.uid,
      embeddingLength: embedding.length,
    });
  } catch (err) {
    console.error("[voiceprint/enroll] Error:", err);
    return res.status(500).json({ error: "Failed to enroll voiceprint" });
  }
});

/**
 * GET /api/voiceprint/status
 * Check if the authenticated user has a voiceprint enrolled.
 */
router.get("/status", requireAuth, (req: Request, res: Response) => {
  const enrolled = hasVoiceprint(req.user!.uid);
  return res.json({
    uid: req.user!.uid,
    enrolled,
  });
});

/**
 * DELETE /api/voiceprint
 * Delete the authenticated user's voiceprint.
 */
router.delete("/", requireAuth, (req: Request, res: Response) => {
  deleteVoiceprint(req.user!.uid);
  return res.json({
    success: true,
    message: "Voiceprint deleted",
  });
});

/**
 * GET /api/voiceprint/stats
 * Admin/diagnostics: total enrolled voiceprints.
 */
router.get("/stats", (_req: Request, res: Response) => {
  return res.json({
    totalVoiceprints: voiceprintCount(),
  });
});

export default router;