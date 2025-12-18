/**
 * OpenAI Responses API client (text + optional images -> answer).
 *
 * Requirements:
 * - text-only LLM input (no audio)
 * - temperature 0
 * - streaming enabled
 * - emits deltas ASAP for low first-token latency
 */

function buildInput({ systemPrompt, history = [], userText, images = [] } = {}) {
    const input = [];

    if (systemPrompt && String(systemPrompt).trim()) {
        input.push({
            role: 'system',
            content: [{ type: 'input_text', text: String(systemPrompt).trim() }],
        });
    }

    // history: array of { role: 'user'|'assistant', text }
    for (const h of history) {
        const role = h?.role === 'assistant' ? 'assistant' : 'user';
        const text = String(h?.text || '').trim();
        if (!text) continue;
        input.push({
            role,
            // IMPORTANT (Responses API):
            // - user messages use input_* content items
            // - assistant messages use output_* content items
            // Otherwise, subsequent turns will 400 with:
            // "Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'."
            content: [{ type: role === 'assistant' ? 'output_text' : 'input_text', text }],
        });
    }

    const userContent = [];
    if (userText && String(userText).trim()) {
        userContent.push({ type: 'input_text', text: String(userText).trim() });
    }
    for (const img of images) {
        if (!img?.data) continue;
        const mime = img.mimeType || 'image/jpeg';
        userContent.push({
            type: 'input_image',
            image_url: `data:${mime};base64,${img.data}`,
        });
    }
    if (userContent.length) {
        input.push({ role: 'user', content: userContent });
    }

    return input;
}

async function streamResponse({
    apiKey,
    model = 'gpt-4o-mini',
    systemPrompt,
    history,
    userText,
    images,
    temperature = 0,
    maxOutputTokens = 700,
    onDelta,
} = {}) {
    if (!apiKey) throw new Error('OpenAI API key missing');
    const input = buildInput({ systemPrompt, history, userText, images });
    if (!input.length) throw new Error('No input to send');

    const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature,
            stream: true,
            max_output_tokens: maxOutputTokens,
            input,
        }),
    });

    if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`OpenAI responses failed (${resp.status}): ${txt?.slice(0, 400)}`);
    }
    if (!resp.body) {
        const txt = await resp.text().catch(() => '');
        if (typeof onDelta === 'function' && txt) onDelta(txt);
        return String(txt || '').trim();
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

    // SSE parsing: events separated by blank line, lines can be "event:" and "data:".
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('\r\n')) buffer = buffer.replace(/\r\n/g, '\n');

        let sepIndex;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const eventBlock = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            const lines = eventBlock.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;

                let json;
                try {
                    json = JSON.parse(payload);
                } catch (_) {
                    continue;
                }

                // Primary streaming delta event:
                // { "type": "response.output_text.delta", "delta": "..." }
                if (json?.type === 'response.output_text.delta' && typeof json?.delta === 'string') {
                    emit(json.delta);
                }

                // Errors can come as streamed events too.
                if (json?.type === 'response.error') {
                    const msg = json?.error?.message || 'OpenAI stream error';
                    throw new Error(String(msg));
                }
            }
        }
    }

    // Flush remainder (best-effort)
    if (buffer && buffer.includes('data:')) {
        const lines = buffer.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
                const json = JSON.parse(payload);
                if (json?.type === 'response.output_text.delta' && typeof json?.delta === 'string') {
                    emit(json.delta);
                }
            } catch (_) {}
        }
    }

    return String(fullText || '').trim();
}

async function warmup({
    apiKey,
    model = 'gpt-4o-mini',
} = {}) {
    if (!apiKey) return false;
    try {
        // Tiny request to warm TLS + connection pools so the first "real" answer is faster.
        const resp = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0,
                stream: false,
                max_output_tokens: 1,
                input: [
                    { role: 'user', content: [{ type: 'input_text', text: 'ok' }] },
                ],
            }),
        });
        return !!resp.ok;
    } catch (_) {
        return false;
    }
}

module.exports = {
    streamResponse,
    buildInput,
    warmup,
};


