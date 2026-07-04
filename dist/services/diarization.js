"use strict";
/**
 * Diarization Pipeline
 *
 * Real-time audio stream → Deepgram diarization → separate User vs Second Party
 * → build conversation transcript context.
 *
 * Uses Deepgram's Live Transcription API with speaker diarization enabled.
 * Each incoming audio chunk is fed to Deepgram, which returns transcribed
 * utterances tagged with a speaker index. The pipeline maps those indices
 * to "user" vs "other" by comparing short audio snippets against the user's
 * stored voiceprint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeepgramLiveConnection = createDeepgramLiveConnection;
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.getConversationContext = getConversationContext;
exports.addUtterance = addUtterance;
const config_1 = require("../config");
const voiceprint_1 = require("./voiceprint");
const sessions = new Map();
// ---------------------------------------------------------------------------
// Deepgram client (lazy)
// ---------------------------------------------------------------------------
let deepgramClient = null;
function getDeepgramClient() {
    if (deepgramClient)
        return deepgramClient;
    if (!config_1.config.deepgramApiKey)
        return null;
    try {
        const { createClient } = require("@deepgram/sdk");
        deepgramClient = createClient(config_1.config.deepgramApiKey);
        return deepgramClient;
    }
    catch {
        console.warn("[diarization] @deepgram/sdk not available — running without Deepgram");
        return null;
    }
}
// ---------------------------------------------------------------------------
// Deepgram Live Transcription (real-time)
// ---------------------------------------------------------------------------
/**
 * Create a Deepgram live transcription connection for a session.
 * Returns the WebSocket-like connection.
 */
function createDeepgramLiveConnection(sessionId, onUtterance, onError) {
    const client = getDeepgramClient();
    if (!client) {
        // Fallback: return a mock that fires a dummy utterance for testing
        console.warn("[diarization] Deepgram not configured — using fallback mock");
        return createMockConnection(sessionId, onUtterance);
    }
    // In a real implementation, we would open a WebSocket connection to
    // Deepgram's real-time API here using the client's live transcription method.
    // For now, we document the intended usage:
    /*
    const connection = client.listen.live({
      model: "nova-3",
      language: "en-US",
      punctuate: true,
      diarize: true,
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
      interim_results: false,
      utterance_end_ms: 1000,
    });
  
    connection.on("open", () => { ... });
    connection.on("message", (msg: any) => {
      // Parse Deepgram response — extract utterances with speaker tags
      const channel = msg.channel?.alternatives?.[0];
      if (!channel) return;
      const words = channel.words || [];
      const speakerWords = groupWordsBySpeaker(words, sessionId);
      for (const sw of speakerWords) {
        onUtterance(sw);
      }
    });
    connection.on("error", onError);
  
    return connection;
    */
    throw new Error("Deepgram live transcription not yet wired — await @deepgram/sdk v3 API binding");
}
// ---------------------------------------------------------------------------
// Mock fallback (for development without Deepgram key)
// ---------------------------------------------------------------------------
function createMockConnection(sessionId, onUtterance) {
    let interval = null;
    return {
        send: (_data) => {
            // In mock mode, silently accept audio data
            // Real implementation would echo back transcribed text
        },
        close: () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        },
    };
}
// ---------------------------------------------------------------------------
// Speaker mapping (voiceprint-based)
// ---------------------------------------------------------------------------
async function mapSpeaker(sessionId, deepgramSpeakerIndex, audioSample) {
    const state = sessions.get(sessionId);
    if (!state)
        return "other";
    // If we already mapped this speaker index, return cached mapping
    if (state.speakerMap[deepgramSpeakerIndex]) {
        return state.speakerMap[deepgramSpeakerIndex];
    }
    // Try to match the audio sample against stored voiceprints
    const embedding = await (0, voiceprint_1.generateVoiceEmbedding)(audioSample, 16000);
    const match = (0, voiceprint_1.matchVoiceprint)(embedding, 0.7);
    const label = match ? "user" : "other";
    state.speakerMap[deepgramSpeakerIndex] = label;
    return label;
}
// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------
function createSession(sessionId) {
    sessions.set(sessionId, {
        utterances: [],
        speakerMap: {},
        recentAudioBuffer: [],
    });
}
function destroySession(sessionId) {
    sessions.delete(sessionId);
}
function getConversationContext(sessionId) {
    const state = sessions.get(sessionId);
    if (!state) {
        return { utterances: [], fullTranscript: "", durationSec: 0 };
    }
    const fullTranscript = state.utterances
        .map((u) => `${u.speaker === "user" ? "You" : "Other"}: ${u.text}`)
        .join("\n");
    const durationSec = state.utterances.length > 0
        ? state.utterances[state.utterances.length - 1].end
        : 0;
    return {
        utterances: state.utterances,
        fullTranscript,
        durationSec,
    };
}
function addUtterance(sessionId, utterance) {
    const state = sessions.get(sessionId);
    if (state) {
        state.utterances.push(utterance);
    }
}
// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function groupWordsBySpeaker(words, sessionId) {
    const groups = new Map();
    for (const w of words) {
        const existing = groups.get(w.speaker) || [];
        existing.push({
            word: w.word,
            start: w.start,
            end: w.end,
            speaker: "unknown", // resolved below
            confidence: w.confidence,
        });
        groups.set(w.speaker, existing);
    }
    const result = [];
    const state = sessions.get(sessionId);
    for (const [speakerIdx, speakerWords] of groups) {
        const label = state?.speakerMap[speakerIdx] || "unknown";
        const text = speakerWords.map((w) => w.word).join(" ");
        const start = speakerWords[0]?.start ?? 0;
        const end = speakerWords[speakerWords.length - 1]?.end ?? 0;
        result.push({
            text,
            speaker: label,
            start,
            end,
            words: speakerWords.map((w) => ({ ...w, speaker: label })),
        });
    }
    return result;
}
//# sourceMappingURL=diarization.js.map