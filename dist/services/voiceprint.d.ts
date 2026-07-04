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
/**
 * Generate a voice embedding from raw PCM audio.
 *
 * Uses Deepgram's spoken-text embedding endpoint if configured.
 * Falls back to a basic spectral-energy histogram (not speaker-identifying
 * in production — suitable for dev/test only).
 */
export declare function generateVoiceEmbedding(audioBuffer: Buffer, sampleRate?: number): Promise<Float32Array>;
export declare function storeVoiceprint(uid: string, embedding: Float32Array): void;
export declare function getVoiceprint(uid: string): Float32Array | undefined;
export declare function hasVoiceprint(uid: string): boolean;
/**
 * Compare two voice embeddings using cosine similarity.
 * Returns a score in [0, 1] where 1 = identical.
 */
export declare function compareVoiceprints(a: Float32Array, b: Float32Array): number;
/**
 * Given a live embedding, find the best-matching stored voiceprint.
 * Returns { uid, score } or null if no match above threshold.
 */
export declare function matchVoiceprint(embedding: Float32Array, threshold?: number): {
    uid: string;
    score: number;
} | null;
/**
 * Delete a voiceprint (e.g., on account deletion).
 */
export declare function deleteVoiceprint(uid: string): void;
/**
 * Get total number of stored voiceprints (for diagnostics).
 */
export declare function voiceprintCount(): number;
//# sourceMappingURL=voiceprint.d.ts.map