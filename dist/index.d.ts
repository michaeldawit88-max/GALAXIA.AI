/**
 * Galaxia AI — Backend Server
 *
 * Entry point. Sets up Express with:
 *   - CORS
 *   - JSON body parsing
 *   - Auth routes
 *   - Voiceprint routes
 *   - Session routes
 *   - Usage routes
 *   - WebSocket server for real-time streaming
 */
declare const app: import("express-serve-static-core").Express;
declare const httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
export { app, httpServer };
//# sourceMappingURL=index.d.ts.map