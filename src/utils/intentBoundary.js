/**
 * Intent & boundary layer (lightweight, non-blocking).
 *
 * Rules:
 * - NEVER blocks explicit user actions (Ctrl/Cmd+Enter)
 * - Used ONLY for optional auto mode
 * - Uses VAD signals + ASR endpointing events
 */

class IntentBoundary {
    constructor() {
        this.reset();
        // Auto-mode debouncing: prevent repeated triggers for the same utterance end
        this._lastAutoTriggerAt = 0;
        this.autoCooldownMs = 800;
    }

    reset() {
        this.vadSpeaking = false;
        this.lastSpeechStartAt = 0;
        this.lastSpeechEndAt = 0;
        this.lastUtteranceEndAt = 0;
    }

    onSpeechStart() {
        this.vadSpeaking = true;
        this.lastSpeechStartAt = Date.now();
    }

    onSpeechEnd() {
        this.vadSpeaking = false;
        this.lastSpeechEndAt = Date.now();
    }

    onUtteranceEnd() {
        this.lastUtteranceEndAt = Date.now();
    }

    /**
     * Decide whether auto-submit should trigger now.
     * Must be fast, deterministic, and never used for manual submit.
     */
    shouldAutoSubmitNow({ transcriptionMode } = {}) {
        if (transcriptionMode !== 'auto') return false;
        const now = Date.now();
        if (now - this._lastAutoTriggerAt < this.autoCooldownMs) return false;
        // Require an utterance end event (ASR endpointing).
        if (!this.lastUtteranceEndAt) return false;
        // Prefer not to auto-submit while still speaking.
        if (this.vadSpeaking) return false;
        this._lastAutoTriggerAt = now;
        return true;
    }
}

module.exports = {
    IntentBoundary,
};


