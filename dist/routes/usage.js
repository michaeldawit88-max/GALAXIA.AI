"use strict";
/**
 * Usage Routes
 *
 * Endpoints for checking usage limits, tier status, and subscription management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const usage_1 = require("../services/usage");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
/**
 * GET /api/usage
 * Get the current user's usage summary (used this week, remaining, tier).
 */
router.get("/", auth_1.requireAuth, (req, res) => {
    const summary = (0, usage_1.getUsageSummary)(req.user.uid);
    return res.json(summary);
});
/**
 * GET /api/usage/tier
 * Get the user's current tier.
 */
router.get("/tier", auth_1.requireAuth, (req, res) => {
    const tier = (0, usage_1.getUserTier)(req.user.uid);
    return res.json({ uid: req.user.uid, tier });
});
/**
 * POST /api/usage/tier
 * Update the user's tier (admin/subscription webhook).
 * Body: { tier: "free"|"paid", subscriptionEnd?: "ISO date string" }
 */
router.post("/tier", auth_1.requireAuth, (req, res) => {
    const { tier, subscriptionEnd } = req.body;
    if (!tier || !["free", "paid"].includes(tier)) {
        return res.status(400).json({ error: "tier must be 'free' or 'paid'" });
    }
    (0, usage_1.setUserTier)(req.user.uid, tier, subscriptionEnd);
    return res.json({
        success: true,
        uid: req.user.uid,
        tier: tier,
    });
});
/**
 * POST /api/usage/session/start
 * Start a usage-tracked session (alternative to WebSocket).
 */
router.post("/session/start", auth_1.requireAuth, (req, res) => {
    const summary = (0, usage_1.getUsageSummary)(req.user.uid);
    if (!summary.canStartSession) {
        return res.status(402).json({
            error: "Free tier limit reached. Upgrade to paid for unlimited usage.",
            usage: summary,
        });
    }
    const sessionId = (0, uuid_1.v4)();
    const record = (0, usage_1.startSession)(req.user.uid, sessionId);
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
router.post("/session/end", auth_1.requireAuth, (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
    }
    const record = (0, usage_1.endSession)(req.user.uid, sessionId);
    const summary = (0, usage_1.getUsageSummary)(req.user.uid);
    return res.json({
        sessionId,
        durationSec: record.durationSec,
        usage: summary,
    });
});
exports.default = router;
//# sourceMappingURL=usage.js.map