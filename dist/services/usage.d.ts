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
export type UserTier = "free" | "paid";
export interface UsageRecord {
    uid: string;
    sessionId: string;
    startTime: string;
    endTime: string | null;
    durationSec: number;
    tier: UserTier;
}
export interface UsageSummary {
    usedMinutesThisWeek: number;
    remainingMinutesThisWeek: number;
    tier: UserTier;
    canStartSession: boolean;
}
export declare function ensureTables(): void;
export declare function getUserTier(uid: string): UserTier;
export declare function setUserTier(uid: string, tier: UserTier, subscriptionEnd?: string): void;
export declare function startSession(uid: string, sessionId: string): UsageRecord;
export declare function endSession(uid: string, sessionId: string): UsageRecord;
export declare function getUsageSummary(uid: string): UsageSummary;
export declare function canStartSession(uid: string): boolean;
//# sourceMappingURL=usage.d.ts.map