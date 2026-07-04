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

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config";
import { initWebSocketServer } from "./services/websocket";

// Routes
import authRoutes from "./routes/auth";
import voiceprintRoutes from "./routes/voiceprint";
import sessionRoutes from "./routes/session";
import usageRoutes from "./routes/usage";

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // 10MB for audio payloads

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
app.use("/api/auth", authRoutes);
app.use("/api/voiceprint", voiceprintRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/usage", usageRoutes);

// ---------------------------------------------------------------------------
// WebSocket server (mounted on the same HTTP server)
// ---------------------------------------------------------------------------

const wss = initWebSocketServer(httpServer);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║         Galaxia AI — Backend Server          ║
╠══════════════════════════════════════════════╣
║  REST API:   http://localhost:${config.port}/api  ║
║  WebSocket:  ws://localhost:${config.port}/ws     ║
║  Health:     http://localhost:${config.port}/health║
║  Env:        ${config.nodeEnv.padEnd(32)}║
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

export { app, httpServer };