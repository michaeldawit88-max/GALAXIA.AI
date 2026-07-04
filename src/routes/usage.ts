/**
 * Usage Routes
 *
 * Endpoints for checking usage limits, tier status, and subscription management.
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getUsageSummary,
  getUserTier,
  setUserTier,
  UserTier,
  startSession,
  endSession,
} from "../services/usage";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * GET /api/usage
 * Get the current user's usage summary (used this week, remaining, tier).
 */
router.get("/", requireAuth, (req: Request, res: Response) => {
  const summary = getUsageSummary(req.user!.uid);
  return res.json(summary);
});

/**
 * GET /api/usage/tier
 * Get the user's current tier.
 */
router.get("/tier", requireAuth, (req: Request, res: Response) => {
  const tier = getUserTier(req.user!.uid);
  return res.json({ uid: req.user!.uid, tier });
});

/**
 * POST /api/usage/tier
 * Update the user's tier (admin/subscription webhook).
 * Body: { tier: "free"|"paid", subscriptionEnd?: "ISO date string" }
 */
router.post("/tier", requireAuth, (req: Request, res: Response) => {
  const { tier, subscriptionEnd } = req.body;

  if (!tier || !["free", "paid"].includes(tier)) {
    return res.status(400).json({ error: "tier must be 'free' or 'paid'" });
  }

  setUserTier(req.user!.uid, tier as UserTier, subscriptionEnd);
  return res.json({
    success: true,
    uid: req.user!.uid,
    tier: tier as UserTier,
  });
});

/**
 * POST /api/usage/session/start
 * Start a usage-tracked session (alternative to WebSocket).
 */
router.post("/session/start", requireAuth, (req: Request, res: Response) => {
  const summary = getUsageSummary(req.user!.uid);

  if (!summary.canStartSession) {
    return res.status(402).json({
      error: "Free tier limit reached. Upgrade to paid for unlimited usage.",
      usage: summary,
    });
  }

  const sessionId = uuidv4();
  const record = startSession(req.user!.uid, sessionId);

  return res.json({
    sessionId,
    startedAt: record.startTime,
    tier: record.tier,
  });
});

/**
 * POST /api/usage/session/end
 * End a usage-tracked session.
 * Body: { sessionId: string }
 */
router.post("/session/end", requireAuth, (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const record = endSession(req.user!.uid, sessionId);
  const summary = getUsageSummary(req.user!.uid);

  return res.json({
    sessionId,
    durationSec: record.durationSec,
    usage: summary,
  });
});

export default router;