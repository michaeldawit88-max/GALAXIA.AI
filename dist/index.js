"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const config_1 = require("./config");
const websocket_1 = require("./services/websocket");
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const voiceprint_1 = __importDefault(require("./routes/voiceprint"));
const session_1 = __importDefault(require("./routes/session"));
const usage_1 = __importDefault(require("./routes/usage"));
// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" })); // 10MB for audio payloads
// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "galaxia-ai-server",
        version: "1.0.0",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
// API Routes
app.use("/api/auth", auth_1.default);
app.use("/api/voiceprint", voiceprint_1.default);
app.use("/api/session", session_1.default);
app.use("/api/usage", usage_1.default);
// ---------------------------------------------------------------------------
// WebSocket server (mounted on the same HTTP server)
// ---------------------------------------------------------------------------
const wss = (0, websocket_1.initWebSocketServer)(httpServer);
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
httpServer.listen(config_1.config.port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║         Galaxia AI — Backend Server          ║
╠══════════════════════════════════════════════╣
║  REST API:   http://localhost:${config_1.config.port}/api  ║
║  WebSocket:  ws://localhost:${config_1.config.port}/ws     ║
║  Health:     http://localhost:${config_1.config.port}/health║
║  Env:        ${config_1.config.nodeEnv.padEnd(32)}║
╚══════════════════════════════════════════════╝
  `);
});
// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
process.on("SIGTERM", () => {
    console.log("[server] SIGTERM received — shutting down gracefully...");
    wss.close(() => {
        httpServer.close(() => {
            console.log("[server] Server shut down");
            process.exit(0);
        });
    });
});
process.on("SIGINT", () => {
    console.log("[server] SIGINT received — shutting down gracefully...");
    wss.close(() => {
        httpServer.close(() => {
            console.log("[server] Server shut down");
            process.exit(0);
        });
    });
});
//# sourceMappingURL=index.js.map