import admin from "firebase-admin";
/**
 * Verify a Firebase ID token.
 * Returns the decoded token (with uid) or null if invalid.
 */
export declare function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken | null>;
/**
 * Get the Firebase Auth instance (for admin operations like creating users).
 */
export declare function getAuth(): admin.auth.Auth | null;
/**
 * Get a Firebase user by UID.
 */
export declare function getUser(uid: string): Promise<admin.auth.UserRecord | null>;
//# sourceMappingURL=auth.d.ts.map