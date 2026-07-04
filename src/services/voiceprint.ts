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

import { config } from "../config";

// In-memory voiceprint store (uid → voiceprint vector)
// In production this would be a vector DB (Pinecone, pgvector, etc.)
const voiceprintStore = new Map<string, Float32Array>();

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
export async function generateVoiceEmbedding(
  audioBuffer: Buffer,
  sampleRate: number = 16000
): Promise<Float32Array> {
  if (config.deepgramApiKey) {
    throw new Error(
      "Deepgram voice embedding not yet wired — awaiting API endpoint details. " +
      "For now, use the spectral fallback."
    );
  }

  // Fallback: simple audio-energy histogram (128 bins)
  // This is NOT a real voiceprint — it's a placeholder for MVP testing.
  const embedding = new Float32Array(128);
  if (audioBuffer.length < 256) return embedding; // too short

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

export function storeVoiceprint(uid: string, embedding: Float32Array): void {
  voiceprintStore.set(uid, embedding);
}

export function getVoiceprint(uid: string): Float32Array | undefined {
  return voiceprintStore.get(uid);
}

export function hasVoiceprint(uid: string): boolean {
  return voiceprintStore.has(uid);
}

/**
 * Compare two voice embeddings using cosine similarity.
 * Returns a score in [0, 1] where 1 = identical.
 */
export function compareVoiceprints(
  a: Float32Array,
  b: Float32Array
): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * Given a live embedding, find the best-matching stored voiceprint.
 * Returns { uid, score } or null if no match above threshold.
 */
export function matchVoiceprint(
  embedding: Float32Array,
  threshold: number = 0.7
): { uid: string; score: number } | null {
  let best: { uid: string; score: number } | null = null;

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
export function deleteVoiceprint(uid: string): void {
  voiceprintStore.delete(uid);
}

/**
 * Get total number of stored voiceprints (for diagnostics).
 */
export function voiceprintCount(): number {
  return voiceprintStore.size;
}