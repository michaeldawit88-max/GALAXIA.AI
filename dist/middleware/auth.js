"use strict";
/**
 * Auth Middleware
 *
 * Verifies Firebase ID tokens from the Authorization header.
 * Attaches { uid, email } to req.user on success.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const auth_1 = require("../services/auth");
/**
 * Middleware: require a valid Firebase ID token.
 * Token must be in: Authorization: Bearer <token>
 */
async function requireAuth(req, res, next) {
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
    const decoded = await (0, auth_1.verifyIdToken)(token);
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
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        if (token) {
            const decoded = await (0, auth_1.verifyIdToken)(token);
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
//# sourceMappingURL=auth.js.map