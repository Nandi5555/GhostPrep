/**
 * ModelAdapter
 * Neutral, model-agnostic interface used by the app.
 *
 * Goals:
 * - UI never depends on model-specific behavior (streaming quirks, auto-responses, etc.)
 * - Centralize model selection, compatibility checks, and safe fallbacks.
 */
const DEFAULT_MODEL_CANDIDATES = [
    // REQUIRED: user wants ONLY this model
    'gemini-2.0-flash-exp',
];

function buildContents({ userText, history = [], images = [] }) {
    const contents = [];

    // History: array of { role: 'user'|'model', text: string }
    for (const h of history) {
        const role = h?.role === 'model' ? 'model' : 'user';
        const text = String(h?.text || '').trim();
        if (!text) continue;
        contents.push({ role, parts: [{ text }] });
    }

    const parts = [];
    if (userText && String(userText).trim()) {
        parts.push({ text: String(userText).trim() });
    }
    for (const img of images) {
        if (!img?.data) continue;
        parts.push({
            inlineData: {
                mimeType: img.mimeType || 'image/jpeg',
                data: img.data,
            },
        });
    }
    if (parts.length) {
        contents.push({ role: 'user', parts });
    }

    return contents;
}

class ModelAdapter {
    constructor({ apiKey, preferredModels } = {}) {
        if (!apiKey) throw new Error('ModelAdapter requires apiKey');
        this.apiKey = apiKey;
        this.preferredModels = Array.isArray(preferredModels) && preferredModels.length ? preferredModels : DEFAULT_MODEL_CANDIDATES;
        this._resolvedModel = null;
    }

    async resolveModelName() {
        if (this._resolvedModel) return this._resolvedModel;
        this._resolvedModel = this.preferredModels[0] || DEFAULT_MODEL_CANDIDATES[0];
        return this._resolvedModel;
    }

    /**
     * Generate a single text response.
     * This is intentionally non-streaming; UI streaming is implemented separately if needed.
     */
    async generateText({ systemInstruction, userText, history, images, generationConfig } = {}) {
        const model = await this.resolveModelName();

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const body = {
            contents: buildContents({ userText, history, images }),
        };

        if (systemInstruction && String(systemInstruction).trim()) {
            body.systemInstruction = { parts: [{ text: String(systemInstruction).trim() }] };
        }
        if (generationConfig && typeof generationConfig === 'object') {
            body.generationConfig = generationConfig;
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`Model generateContent failed (${resp.status}): ${txt?.slice(0, 400)}`);
        }

        const json = await resp.json();
        const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
        const parts = candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts) ? parts.map(p => p?.text || '').join('') : '';
        return (text || '').trim();
    }

    /**
     * Generate a text response with streaming deltas.
     *
     * Uses Gemini SSE streaming: :streamGenerateContent?alt=sse
     * Calls `onDelta(deltaText)` as soon as each text chunk arrives.
     * Returns the final full text (trimmed).
     */
    async generateTextStream({ systemInstruction, userText, history, images, generationConfig, onDelta } = {}) {
        const model = await this.resolveModelName();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

        const body = {
            contents: buildContents({ userText, history, images }),
        };
        if (systemInstruction && String(systemInstruction).trim()) {
            body.systemInstruction = { parts: [{ text: String(systemInstruction).trim() }] };
        }
        if (generationConfig && typeof generationConfig === 'object') {
            body.generationConfig = generationConfig;
        }

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(`Model streamGenerateContent failed (${resp.status}): ${txt?.slice(0, 400)}`);
        }
        if (!resp.body) {
            // Extremely rare; fallback to non-streaming.
            const full = await resp.text().catch(() => '');
            if (typeof onDelta === 'function' && full) onDelta(full);
            return String(full || '').trim();
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';

        const emit = delta => {
            const d = String(delta || '');
            if (!d) return;
            fullText += d;
            if (typeof onDelta === 'function') {
                try { onDelta(d); } catch (_) {}
            }
        };

        // SSE parsing: events are separated by a blank line.
        // Each event may include one or more "data:" lines.
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // Normalize line endings for robust SSE parsing.
            if (buffer.includes('\r\n')) buffer = buffer.replace(/\r\n/g, '\n');

            let sepIndex;
            while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
                const event = buffer.slice(0, sepIndex);
                buffer = buffer.slice(sepIndex + 2);

                const lines = event.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const payload = trimmed.slice(5).trim();
                    if (!payload) continue;
                    if (payload === '[DONE]') continue;

                    let json;
                    try {
                        json = JSON.parse(payload);
                    } catch (_) {
                        continue;
                    }

                    const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
                    const parts = candidates?.[0]?.content?.parts;
                    const chunkText = Array.isArray(parts) ? parts.map(p => p?.text || '').join('') : '';
                    if (!chunkText) continue;

                    // Some servers send cumulative text; some send deltas.
                    // Convert cumulative -> delta when possible.
                    if (chunkText.startsWith(fullText)) {
                        emit(chunkText.slice(fullText.length));
                    } else {
                        emit(chunkText);
                    }
                }
            }
        }

        // Flush any remaining decoded text (in case stream didn't end with \n\n)
        if (buffer && buffer.includes('data:')) {
            const lines = buffer.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
                    const parts = candidates?.[0]?.content?.parts;
                    const chunkText = Array.isArray(parts) ? parts.map(p => p?.text || '').join('') : '';
                    if (!chunkText) continue;
                    if (chunkText.startsWith(fullText)) {
                        emit(chunkText.slice(fullText.length));
                    } else {
                        emit(chunkText);
                    }
                } catch (_) {}
            }
        }

        return String(fullText || '').trim();
    }
}

module.exports = {
    ModelAdapter,
    DEFAULT_MODEL_CANDIDATES,
};


