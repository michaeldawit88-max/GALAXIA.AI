"use strict";
/**
 * Usage Tracking Service
 *
 * Tracks conversation time per user across sessions.
 * Enforces free-tier limit (20 minutes/week) and supports paid unlimited tier.
 *
 * Data is stored in a shared SQLite database (via Turso/team-db).
 * The schema:
 *   - usage_records: (uid, session_id, start_time, end_time, duration_sec, tier)
 *   - user_tiers: (uid, tier, subscription_end)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTables = ensureTables;
exports.getUserTier = getUserTier;
exports.setUserTier = setUserTier;
exports.startSession = startSession;
exports.endSession = endSession;
exports.getUsageSummary = getUsageSummary;
exports.canStartSession = canStartSession;
const config_1 = require("../config");
const child_process_1 = require("child_process");
// ---------------------------------------------------------------------------
// team-db helper
// ---------------------------------------------------------------------------
function runDb(sql) {
    try {
        const output = (0, child_process_1.execSync)(`team-db "${sql.replace(/"/g, '\\"')}"`, {
            encoding: "utf-8",
            timeout: 10_000,
        });
        return JSON.parse(output.trim());
    }
    catch (err) {
        console.error("[usage] DB error:", err);
        throw new Error(`Usage DB query failed: ${err.message}`);
    }
}
// ---------------------------------------------------------------------------
// Ensure tables exist
// ---------------------------------------------------------------------------
function ensureTables() {
    runDb(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      session_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_sec INTEGER DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
    runDb(`
    CREATE TABLE IF NOT EXISTS user_tiers (
      uid TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'free',
      subscription_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
// ---------------------------------------------------------------------------
// Tier management
// ---------------------------------------------------------------------------
function getUserTier(uid) {
    const rows = runDb(`SELECT tier, subscription_end FROM user_tiers WHERE uid = '${uid}'`);
    if (!Array.isArray(rows) || rows.length === 0)
        return "free";
    const row = rows[0];
    const tier = row.tier;
    // Check subscription expiry for paid users
    if (tier === "paid" && row.subscription_end) {
        const end = new Date(row.subscription_end);
        if (end < new Date()) {
            // Subscription expired — downgrade
            runDb(`UPDATE user_tiers SET tier = 'free', updated_at = datetime('now') WHERE uid = '${uid}'`);
            return "free";
        }
    }
    return tier;
}
function setUserTier(uid, tier, subscriptionEnd) {
    runDb(`
    INSERT INTO user_tiers (uid, tier, subscription_end, updated_at)
    VALUES ('${uid}', '${tier}', ${subscriptionEnd ? `'${subscriptionEnd}'` : "NULL"}, datetime('now'))
    ON CONFLICT(uid) DO UPDATE SET
      tier = '${tier}',
      subscription_end = ${subscriptionEnd ? `'${subscriptionEnd}'` : "NULL"},
      updated_at = datetime('now')
  `);
}
// ---------------------------------------------------------------------------
// Session tracking
// ---------------------------------------------------------------------------
function startSession(uid, sessionId) {
    const tier = getUserTier(uid);
    const startTime = new Date().toISOString();
    runDb(`
    INSERT INTO usage_records (uid, session_id, start_time, tier)
    VALUES ('${uid}', '${sessionId}', '${startTime}', '${tier}')
  `);
    return {
        uid,
        sessionId,
        startTime,
        endTime: null,
        durationSec: 0,
        tier,
    };
}
function endSession(uid, sessionId) {
    const endTime = new Date().toISOString();
    // Get start time to calculate duration
    const rows = runDb(`SELECT start_time FROM usage_records WHERE uid = '${uid}' AND session_id = '${sessionId}'`);
    let durationSec = 0;
    if (Array.isArray(rows) && rows.length > 0) {
        const start = new Date(rows[0].start_time);
        const end = new Date(endTime);
        durationSec = Math.round((end.getTime() - start.getTime()) / 1000);
    }
    runDb(`
    UPDATE usage_records
    SET end_time = '${endTime}', duration_sec = ${durationSec}
    WHERE uid = '${uid}' AND session_id = '${sessionId}'
  `);
    return {
        uid,
        sessionId,
        startTime: rows[0]?.start_time ?? endTime,
        endTime,
        durationSec,
        tier: getUserTier(uid),
    };
}
// ---------------------------------------------------------------------------
// Usage summary (weekly)
// ---------------------------------------------------------------------------
function getUsageSummary(uid) {
    const tier = getUserTier(uid);
    // Paid users have unlimited usage
    if (tier === "paid") {
        return {
            usedMinutesThisWeek: 0,
            remainingMinutesThisWeek: Infinity,
            tier: "paid",
            canStartSession: true,
        };
    }
    // Calculate usage this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const rows = runDb(`
    SELECT COALESCE(SUM(duration_sec), 0) as total_sec
    FROM usage_records
    WHERE uid = '${uid}'
      AND start_time >= '${startOfWeek.toISOString()}'
      AND end_time IS NOT NULL
  `);
    const totalSec = Array.isArray(rows) && rows.length > 0 ? rows[0].total_sec : 0;
    const usedMinutes = Math.round(totalSec / 60);
    const freeLimitMinutes = config_1.config.freeTierMinutesPerWeek;
    const remaining = Math.max(0, freeLimitMinutes - usedMinutes);
    return {
        usedMinutesThisWeek: usedMinutes,
        remainingMinutesThisWeek: remaining,
        tier: "free",
        canStartSession: remaining > 0,
    };
}
// ---------------------------------------------------------------------------
// Can user start a session?
// ---------------------------------------------------------------------------
function canStartSession(uid) {
    const summary = getUsageSummary(uid);
    return summary.canStartSession;
}
//# sourceMappingURL=usage.js.map