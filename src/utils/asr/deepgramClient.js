const WebSocket = require('ws');

/**
 * Deepgram streaming ASR client (audio -> text only).
 *
 * Design goals:
 * - ultra-low latency interim transcripts
 * - never generates answers
 * - treats interim transcripts as "replace current draft"
 * - commits the current draft once on utterance end (speech_final / UtteranceEnd)
 */
class DeepgramStreamingClient {
    constructor({
        apiKey,
        language = 'en-US',
        model = 'nova-3',
        sampleRate = 24000,
        channels = 1,
        endpointingMs = 300,
        utteranceEndMs = 900,
    } = {}) {
        if (!apiKey) throw new Error('DeepgramStreamingClient requires apiKey');
        this.apiKey = apiKey;
        this.language = language;
        this.model = model;
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.endpointingMs = endpointingMs;
        this.utteranceEndMs = utteranceEndMs;

        this.ws = null;
        this._keepAliveTimer = null;
        this._open = false;

        this.onInterim = () => {};
        this.onUtteranceEnd = () => {};
        this.onError = () => {};
        this.onOpen = () => {};
        this.onClose = () => {};
    }

    connect({ onInterim, onUtteranceEnd, onError, onOpen, onClose } = {}) {
        if (typeof onInterim === 'function') this.onInterim = onInterim;
        if (typeof onUtteranceEnd === 'function') this.onUtteranceEnd = onUtteranceEnd;
        if (typeof onError === 'function') this.onError = onError;
        if (typeof onOpen === 'function') this.onOpen = onOpen;
        if (typeof onClose === 'function') this.onClose = onClose;

        // Keep params minimal for maximum compatibility.
        // We'll add endpointing/utterance options only when we confirm the server supports them.
        const params = new URLSearchParams({
            encoding: 'linear16',
            sample_rate: String(this.sampleRate),
            channels: String(this.channels),
            model: this.model,
            language: this.language,
            punctuate: 'true',
            smart_format: 'true',
            interim_results: 'true',
        });

        const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
        const ws = new WebSocket(url, {
            headers: {
                Authorization: `Token ${this.apiKey}`,
            },
        });
        this.ws = ws;
        // Help debug 400s: capture the response body for non-101 upgrade responses.
        ws.on('unexpected-response', (_req, res) => {
            try {
                let body = '';
                res.on('data', chunk => {
                    body += chunk.toString('utf8');
                });
                res.on('end', () => {
                    const msg = `Unexpected server response: ${res.statusCode} ${res.statusMessage || ''} ${body ? `- ${body}` : ''}`.trim();
                    try { this.onError(new Error(msg)); } catch (_) {}
                });
            } catch (e) {
                try { this.onError(e); } catch (_) {}
            }
        });

        ws.on('open', () => {
            this._open = true;
            // Best-effort keepalive; Deepgram supports KeepAlive messages.
            this._keepAliveTimer = setInterval(() => {
                try {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
                    }
                } catch (_) {}
            }, 15000);
            try { this.onOpen(); } catch (_) {}
        });

        ws.on('message', data => {
            try {
                const txt = Buffer.isBuffer(data) ? data.toString('utf8') : String(data || '');
                if (!txt) return;
                const msg = JSON.parse(txt);

                // Utterance end message
                if (msg && msg.type === 'UtteranceEnd') {
                    try { this.onUtteranceEnd(); } catch (_) {}
                    return;
                }

                const alt = msg?.channel?.alternatives?.[0];
                const transcript = (alt?.transcript || '').trim();
                const speechFinal = !!msg?.speech_final;
                const isFinal = !!msg?.is_final;

                // Deepgram sends many messages; ignore empty transcripts.
                if (transcript) {
                    // For Cluely-style UX, treat ANY transcript update as "replace draft".
                    try { this.onInterim(transcript, { isFinal, speechFinal }); } catch (_) {}
                }

                // Commit once when speech ends (endpoint)
                if (speechFinal) {
                    try { this.onUtteranceEnd(); } catch (_) {}
                }
            } catch (e) {
                // Ignore parse errors; forward serious issues
                try { this.onError(e); } catch (_) {}
            }
        });

        ws.on('error', err => {
            try { this.onError(err); } catch (_) {}
        });

        ws.on('close', (code, reason) => {
            this._open = false;
            if (this._keepAliveTimer) {
                try { clearInterval(this._keepAliveTimer); } catch (_) {}
                this._keepAliveTimer = null;
            }
            try { this.onClose({ code, reason: String(reason || '') }); } catch (_) {}
        });
    }

    sendAudio(buffer) {
        if (!buffer) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        try {
            // Deepgram expects raw PCM bytes as binary frames.
            this.ws.send(buffer);
        } catch (e) {
            try { this.onError(e); } catch (_) {}
        }
    }

    close() {
        if (this._keepAliveTimer) {
            try { clearInterval(this._keepAliveTimer); } catch (_) {}
            this._keepAliveTimer = null;
        }
        if (this.ws) {
            try { this.ws.close(); } catch (_) {}
            this.ws = null;
        }
        this._open = false;
    }
}

module.exports = {
    DeepgramStreamingClient,
};

