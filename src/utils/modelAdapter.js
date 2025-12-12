/**
 * ModelAdapter
 * Neutral, model-agnostic interface used by the app.
 *
 * Goals:
 * - UI never depends on model-specific behavior (streaming quirks, auto-responses, etc.)
 * - Centralize model selection, compatibility checks, and safe fallbacks.
 */
const DEFAULT_MODEL_CANDIDATES = [
    // Preferred (can be swapped in the future without UI changes)
    'gemini-2.0-flash-exp',
    // Reasonable fallbacks
    'gemini-2.0-flash',
    'gemini-1.5-flash',
];

async function listModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!resp.ok) {
        throw new Error(`Failed to list models (${resp.status})`);
    }
    const json = await resp.json();
    const models = Array.isArray(json?.models) ? json.models : [];
    return models.map(m => (m?.name || '').replace(/^models\//, '')).filter(Boolean);
}

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
        this._listedModels = null;
    }

    async resolveModelName() {
        if (this._resolvedModel) return this._resolvedModel;

        try {
            if (!this._listedModels) {
                this._listedModels = await listModels(this.apiKey);
            }
            for (const candidate of this.preferredModels) {
                if (this._listedModels.includes(candidate)) {
                    this._resolvedModel = candidate;
                    return candidate;
                }
            }
        } catch (_) {
            // If listing fails, fall back to first candidate.
        }

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
}

module.exports = {
    ModelAdapter,
    DEFAULT_MODEL_CANDIDATES,
};


