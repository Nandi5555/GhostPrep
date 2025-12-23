/**
 * Minimal Gemini (Google Generative Language API) client for text + optional images.
 *
 * We intentionally use the REST API here to keep the dependency surface small and
 * predictable in Electron main, and because we can simulate "thinking" streaming
 * in the UI even when the API response is non-streaming.
 */

function mapHistoryToGemini(history = []) {
    // history: array of { role: 'user'|'assistant', text }
    // Gemini uses role: 'user' | 'model'
    const contents = [];
    for (const h of history || []) {
        const role = h?.role === 'assistant' ? 'model' : 'user';
        const text = String(h?.text || '').trim();
        if (!text) continue;
        contents.push({
            role,
            parts: [{ text }],
        });
    }
    return contents;
}

function extractTextFromGeminiJson(json) {
    try {
        const parts = json?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return '';
        return parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('');
    } catch (_) {
        return '';
    }
}

function buildUserParts({ userText, images = [] } = {}) {
    const parts = [];
    const t = String(userText || '').trim();
    if (t) parts.push({ text: t });
    for (const img of images || []) {
        const data = String(img?.data || '').trim();
        if (!data) continue;
        const mimeType = String(img?.mimeType || 'image/jpeg') || 'image/jpeg';
        parts.push({
            inlineData: {
                mimeType,
                data, // base64 (no data: prefix)
            },
        });
    }
    return parts;
}

async function generateContentStream({
    apiKey,
    model = 'gemini-3-flash',
    systemPrompt = '',
    history = [],
    userText = '',
    images = [],
    temperature = 0,
    maxOutputTokens = 900,
    onDelta,
} = {}) {
    if (!apiKey) throw new Error('Gemini API key missing');

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent` +
        `?alt=sse&key=${encodeURIComponent(String(apiKey).trim())}`;

    const contents = [
        ...mapHistoryToGemini(history),
        {
            role: 'user',
            parts: buildUserParts({ userText, images }),
        },
    ].filter(Boolean);

    if (!contents.length) throw new Error('No input to send');

    const body = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens,
        },
    };

    const sys = String(systemPrompt || '').trim();
    if (sys) {
        body.systemInstruction = { parts: [{ text: sys }] };
    }

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Gemini streamGenerateContent failed (${resp.status}): ${txt?.slice(0, 400)}`);
    }
    if (!resp.body) {
        const txt = await resp.text().catch(() => '');
        return String(txt || '').trim();
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let lastEmittedLen = 0;

    const emitDelta = (nextFull) => {
        const s = String(nextFull || '');
        if (!s) return;
        // Some Gemini streaming responses return cumulative text; emit only the suffix.
        const delta = s.length >= lastEmittedLen ? s.slice(lastEmittedLen) : s;
        lastEmittedLen = s.length;
        if (!delta) return;
        fullText = s;
        if (typeof onDelta === 'function') {
            try { onDelta(delta); } catch (_) {}
        }
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('\r\n')) buffer = buffer.replace(/\r\n/g, '\n');

        // SSE blocks separated by blank lines.
        let sepIndex;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const eventBlock = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            const lines = eventBlock.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                let json;
                try { json = JSON.parse(payload); } catch (_) { continue; }
                const t = extractTextFromGeminiJson(json);
                if (t) emitDelta((fullText || '') + t);
            }
        }

        // Fallback: newline-delimited JSON (best-effort)
        const nl = buffer.lastIndexOf('\n');
        if (nl > 0 && !buffer.includes('data:')) {
            const chunk = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            for (const line of chunk.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                let json;
                try { json = JSON.parse(trimmed); } catch (_) { continue; }
                const t = extractTextFromGeminiJson(json);
                if (t) emitDelta((fullText || '') + t);
            }
        }
    }

    return String(fullText || '').trim();
}

async function generateContent({
    apiKey,
    model = 'gemini-3-flash',
    systemPrompt = '',
    history = [],
    userText = '',
    images = [],
    temperature = 0,
    maxOutputTokens = 900,
} = {}) {
    if (!apiKey) throw new Error('Gemini API key missing');

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
        `?key=${encodeURIComponent(String(apiKey).trim())}`;

    const contents = [
        ...mapHistoryToGemini(history),
        {
            role: 'user',
            parts: buildUserParts({ userText, images }),
        },
    ].filter(Boolean);

    if (!contents.length) throw new Error('No input to send');

    const body = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens,
        },
    };

    const sys = String(systemPrompt || '').trim();
    if (sys) {
        body.systemInstruction = { parts: [{ text: sys }] };
    }

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Gemini generateContent failed (${resp.status}): ${txt?.slice(0, 400)}`);
    }

    const json = await resp.json().catch(() => ({}));
    const parts = json?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        const safety = json?.candidates?.[0]?.finishReason || 'unknown';
        throw new Error(`Gemini returned no content (finishReason: ${safety})`);
    }

    const text = parts
        .map(p => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();

    return text;
}

module.exports = {
    generateContent,
    generateContentStream,
};



