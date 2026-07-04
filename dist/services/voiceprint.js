"use strict";
/**
 * Voiceprint Service
 *
 * Converts raw audio samples to voice embeddings (via Deepgram's
 * spoken-text embedding or a simple spectral approach) and stores them
 * indexed by user UID.
 *
 * During conversation, incoming audio chunks are compared against stored
 * voiceprints to determine if the speaker is the user or the second party.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoiceEmbedding = generateVoiceEmbedding;
exports.storeVoiceprint = storeVoiceprint;
exports.getVoiceprint = getVoiceprint;
exports.hasVoiceprint = hasVoiceprint;
exports.compareVoiceprints = compareVoiceprints;
exports.matchVoiceprint = matchVoiceprint;
exports.deleteVoiceprint = deleteVoiceprint;
exports.voiceprintCount = voiceprintCount;
const config_1 = require("../config");
// In-memory voiceprint store (uid → voiceprint vector)
// In production this would be a vector DB (Pinecone, pgvector, etc.)
const voiceprintStore = new Map();
// ---------------------------------------------------------------------------
// Embedding via Deepgram (preferred) or a simple fallback
// ---------------------------------------------------------------------------
/**
 * Generate a voice embedding from raw PCM audio.
 *
 * Uses Deepgram's spoken-text embedding endpoint if configured.
 * Falls back to a basic spectral-energy histogram (not speaker-identifying
 * in production — suitable for dev/test only).
 */
async function generateVoiceEmbedding(audioBuffer, sampleRate = 16000) {
    if (config_1.config.deepgramApiKey) {
        throw new Error("Deepgram voice embedding not yet wired — awaiting API endpoint details. " +
            "For now, use the spectral fallback.");
    }
    // Fallback: simple audio-energy histogram (128 bins)
    // This is NOT a real voiceprint — it's a placeholder for MVP testing.
    const embedding = new Float32Array(128);
    if (audioBuffer.length < 256)
        return embedding; // too short
    const step = Math.floor(audioBuffer.length / 128);
    for (let i = 0; i < 128; i++) {
        const start = i * step;
        let sum = 0;
        for (let j = 0; j < step; j++) {
            sum += Math.abs(audioBuffer[start + j] ?? 0);
        }
        embedding[i] = sum / step / 256; // normalize to ~0-1
    }
    return embedding;
}
// ---------------------------------------------------------------------------
// Store & retrieve
// ---------------------------------------------------------------------------
function storeVoiceprint(uid, embedding) {
    voiceprintStore.set(uid, embedding);
}
function getVoiceprint(uid) {
    return voiceprintStore.get(uid);
}
function hasVoiceprint(uid) {
    return voiceprintStore.has(uid);
}
/**
 * Compare two voice embeddings using cosine similarity.
 * Returns a score in [0, 1] where 1 = identical.
 */
function compareVoiceprints(a, b) {
    if (a.length !== b.length)
        return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0)
        return 0;
    return dot / denom;
}
/**
 * Given a live embedding, find the best-matching stored voiceprint.
 * Returns { uid, score } or null if no match above threshold.
 */
function matchVoiceprint(embedding, threshold = 0.7) {
    let best = null;
    for (const [uid, stored] of voiceprintStore) {
        const score = compareVoiceprints(embedding, stored);
        if (score >= threshold && (!best || score > best.score)) {
            best = { uid, score };
        }
    }
    return best;
}
/**
 * Delete a voiceprint (e.g., on account deletion).
 */
function deleteVoiceprint(uid) {
    voiceprintStore.delete(uid);
}
/**
 * Get total number of stored voiceprints (for diagnostics).
 */
function voiceprintCount() {
    return voiceprintStore.size;
}
//# sourceMappingURL=voiceprint.js.map