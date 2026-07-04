/**
 * Auth Middleware
 *
 * Verifies Firebase ID tokens from the Authorization header.
 * Attaches { uid, email } to req.user on success.
 */
import { Request, Response, NextFunction } from "express";
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
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional auth — attaches user if token is present, but doesn't reject.
 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map