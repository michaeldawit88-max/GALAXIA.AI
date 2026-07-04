/**
 * Auth Routes
 *
 * Endpoints for Firebase Auth integration.
 * Note: actual sign-in/sign-up happens on the client via Firebase SDK.
 * This server just verifies tokens.
 */

import { Router, Request, Response } from "express";
import { verifyIdToken, getAuth } from "../services/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/verify
 * Verify a Firebase ID token and return user info.
 * Body: { token: string }
 */
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "token is required" });
    }

    const decoded = await verifyIdToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    return res.json({
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified ?? false,
    });
  } catch (err) {
    console.error("[auth/verify] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/auth/me
 * Returns the current user's profile (requires auth).
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth();
    if (!auth) {
      return res.json({
        uid: req.user!.uid,
        email: req.user!.email,
        note: "Firebase not configured — limited info available",
      });
    }

    const userRecord = await auth.getUser(req.user!.uid);
    return res.json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      phoneNumber: userRecord.phoneNumber,
      emailVerified: userRecord.emailVerified,
      createdAt: userRecord.metadata.creationTime,
    });
  } catch (err) {
    console.error("[auth/me] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;