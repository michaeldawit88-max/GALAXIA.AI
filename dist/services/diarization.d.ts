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
/**
 * Create a Deepgram live transcription connection for a session.
 * Returns the WebSocket-like connection.
 */
export declare function createDeepgramLiveConnection(sessionId: string, onUtterance: (utt: DiarizedUtterance) => void, onError: (err: Error) => void): any;
export declare function createSession(sessionId: string): void;
export declare function destroySession(sessionId: string): void;
export declare function getConversationContext(sessionId: string): ConversationContext;
export declare function addUtterance(sessionId: string, utterance: DiarizedUtterance): void;
//# sourceMappingURL=diarization.d.ts.map