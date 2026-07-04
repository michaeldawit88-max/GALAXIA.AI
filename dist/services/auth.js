"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIdToken = verifyIdToken;
exports.getAuth = getAuth;
exports.getUser = getUser;
const config_1 = require("../config");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
/**
 * Firebase Auth integration — verifies ID tokens from the mobile app.
 * The service account JSON is expected as a base64-encoded env var.
 */
// Lazy-init Firebase app (singleton)
let firebaseApp = null;
function getFirebaseApp() {
    if (firebaseApp)
        return firebaseApp;
    if (!config_1.config.firebaseServiceAccountB64) {
        // In dev mode, if Firebase is not configured, return a mock
        if (config_1.config.isDevelopment) {
            return null;
        }
        throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not set — cannot initialize Firebase");
    }
    try {
        const serviceAccountJson = Buffer.from(config_1.config.firebaseServiceAccountB64, "base64").toString("utf-8");
        const serviceAccount = JSON.parse(serviceAccountJson);
        firebaseApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
        });
        return firebaseApp;
    }
    catch (err) {
        throw new Error(`Failed to initialize Firebase: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * Verify a Firebase ID token.
 * Returns the decoded token (with uid) or null if invalid.
 */
async function verifyIdToken(idToken) {
    const app = getFirebaseApp();
    // Dev-mode mock: accept "test-token" for development
    if (!app && config_1.config.isDevelopment) {
        if (idToken === "test-token") {
            return {
                uid: "test-user-123",
                email: "test@galaxia.ai",
            };
        }
        return null;
    }
    try {
        const decoded = await firebase_admin_1.default.auth().verifyIdToken(idToken);
        return decoded;
    }
    catch {
        return null;
    }
}
/**
 * Get the Firebase Auth instance (for admin operations like creating users).
 */
function getAuth() {
    const app = getFirebaseApp();
    if (!app)
        return null;
    return app.auth();
}
/**
 * Get a Firebase user by UID.
 */
async function getUser(uid) {
    const auth = getAuth();
    if (!auth)
        return null;
    try {
        return await auth.getUser(uid);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=auth.js.map