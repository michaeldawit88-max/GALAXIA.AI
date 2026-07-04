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

import { config } from "../config";
import {
  generateVoiceEmbedding,
  matchVoiceprint,
} from "./voiceprint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiarizedWord {
  word: string;
  start: number;
  end: number;
  speaker: "user" | "other" | "unknown";
  confidence: number;
}

export interface DiarizedUtterance {
  text: string;
  speaker: "user" | "other" | "unknown";
  start: number;
  end: number;
  words: DiarizedWord[];
}

export interface ConversationContext {
  utterances: DiarizedUtterance[];
  /** Full transcript so far (user + other interleaved) */
  fullTranscript: string;
  /** Duration in seconds */
  durationSec: number;
}

// ---------------------------------------------------------------------------
// In-memory session state
// ---------------------------------------------------------------------------

interface SessionState {
  utterances: DiarizedUtterance[];
  /** Deepgram raw speaker channel mapping (channelIndex → "user"|"other") */
  speakerMap: Record<number, "user" | "other">;
  /** Buffer of recent raw audio for voiceprint matching */
  recentAudioBuffer: Buffer[];
}

const sessions = new Map<string, SessionState>();

// ---------------------------------------------------------------------------
// Deepgram client (lazy)
// ---------------------------------------------------------------------------

let deepgramClient: any = null;

function getDeepgramClient() {
  if (deepgramClient) return deepgramClient;
  if (!config.deepgramApiKey) return null;

  try {
    const { createClient } = require("@deepgram/sdk");
    deepgramClient = createClient(config.deepgramApiKey);
    return deepgramClient;
  } catch {
    console.warn(
      "[diarization] @deepgram/sdk not available — running without Deepgram"
    );
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
export function createDeepgramLiveConnection(
  sessionId: string,
  onUtterance: (utt: DiarizedUtterance) => void,
  onError: (err: Error) => void
): any {
  const client = getDeepgramClient();
  if (!client) {
    // Fallback: return a mock that fires a dummy utterance for testing
    console.warn(
      "[diarization] Deepgram not configured — using fallback mock"
    );
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

  throw new Error(
    "Deepgram live transcription not yet wired — await @deepgram/sdk v3 API binding"
  );
}

// ---------------------------------------------------------------------------
// Mock fallback (for development without Deepgram key)
// ---------------------------------------------------------------------------

function createMockConnection(
  sessionId: string,
  onUtterance: (utt: DiarizedUtterance) => void
): any {
  let interval: ReturnType<typeof setInterval> | null = null;

  return {
    send: (_data: Buffer) => {
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

async function mapSpeaker(
  sessionId: string,
  deepgramSpeakerIndex: number,
  audioSample: Buffer
): Promise<"user" | "other"> {
  const state = sessions.get(sessionId);
  if (!state) return "other";

  // If we already mapped this speaker index, return cached mapping
  if (state.speakerMap[deepgramSpeakerIndex]) {
    return state.speakerMap[deepgramSpeakerIndex];
  }

  // Try to match the audio sample against stored voiceprints
  const embedding = await generateVoiceEmbedding(audioSample, 16000);
  const match = matchVoiceprint(embedding, 0.7);

  const label = match ? "user" : "other";
  state.speakerMap[deepgramSpeakerIndex] = label;

  return label;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export function createSession(sessionId: string): void {
  sessions.set(sessionId, {
    utterances: [],
    speakerMap: {},
    recentAudioBuffer: [],
  });
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getConversationContext(sessionId: string): ConversationContext {
  const state = sessions.get(sessionId);
  if (!state) {
    return { utterances: [], fullTranscript: "", durationSec: 0 };
  }

  const fullTranscript = state.utterances
    .map((u) => `${u.speaker === "user" ? "You" : "Other"}: ${u.text}`)
    .join("\n");

  const durationSec =
    state.utterances.length > 0
      ? state.utterances[state.utterances.length - 1].end
      : 0;

  return {
    utterances: state.utterances,
    fullTranscript,
    durationSec,
  };
}

export function addUtterance(
  sessionId: string,
  utterance: DiarizedUtterance
): void {
  const state = sessions.get(sessionId);
  if (state) {
    state.utterances.push(utterance);
  }
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function groupWordsBySpeaker(
  words: Array<{ word: string; start: number; end: number; speaker: number; confidence: number }>,
  sessionId: string
): DiarizedUtterance[] {
  const groups: Map<number, DiarizedWord[]> = new Map();

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

  const result: DiarizedUtterance[] = [];
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