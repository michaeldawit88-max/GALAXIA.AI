/**
 * Auth Middleware
 *
 * Verifies Firebase ID tokens from the Authorization header.
 * Attaches { uid, email } to req.user on success.
 */

import { Request, Response, NextFunction } from "express";
import { verifyIdToken } from "../services/auth";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

/**
 * Middleware: require a valid Firebase ID token.
 * Token must be in: Authorization: Bearer <token>
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Empty token" });
    return;
  }

  const decoded = await verifyIdToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = {
    uid: decoded.uid,
    email: decoded.email,
  };

  next();
}

/**
 * Optional auth — attaches user if token is present, but doesn't reject.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        req.user = {
          uid: decoded.uid,
          email: decoded.email,
        };
      }
    }
  }

  next();
}