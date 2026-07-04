import { config } from "../config";
import admin from "firebase-admin";

/**
 * Firebase Auth integration — verifies ID tokens from the mobile app.
 * The service account JSON is expected as a base64-encoded env var.
 */

// Lazy-init Firebase app (singleton)
let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  if (!config.firebaseServiceAccountB64) {
    // In dev mode, if Firebase is not configured, return a mock
    if (config.isDevelopment) {
      return null as unknown as admin.app.App;
    }
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_B64 is not set — cannot initialize Firebase"
    );
  }

  try {
    const serviceAccountJson = Buffer.from(
      config.firebaseServiceAccountB64,
      "base64"
    ).toString("utf-8");
    const serviceAccount = JSON.parse(serviceAccountJson);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    return firebaseApp;
  } catch (err) {
    throw new Error(
      `Failed to initialize Firebase: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Verify a Firebase ID token.
 * Returns the decoded token (with uid) or null if invalid.
 */
export async function verifyIdToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken | null> {
  const app = getFirebaseApp();

  // Dev-mode mock: accept "test-token" for development
  if (!app && config.isDevelopment) {
    if (idToken === "test-token") {
      return {
        uid: "test-user-123",
        email: "test@galaxia.ai",
      } as admin.auth.DecodedIdToken;
    }
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get the Firebase Auth instance (for admin operations like creating users).
 */
export function getAuth(): admin.auth.Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return app.auth();
}

/**
 * Get a Firebase user by UID.
 */
export async function getUser(uid: string): Promise<admin.auth.UserRecord | null> {
  const auth = getAuth();
  if (!auth) return null;
  try {
    return await auth.getUser(uid);
  } catch {
    return null;
  }
}