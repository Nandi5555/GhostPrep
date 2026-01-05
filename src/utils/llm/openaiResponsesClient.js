/**
 * OpenAI Responses API client (text + optional images -> answer).
 *
 * Requirements:
 * - text-only LLM input (no audio)
 * - temperature 0
 * - streaming enabled
 * - emits deltas ASAP for low first-token latency
 */

let _OpenAIClientCtorPromise = null;
const _clientByApiKey = new Map();

async function getOpenAIClient(apiKey) {
    const k = String(apiKey || '').trim();
    if (!k) throw new Error('OpenAI API key missing');
    const existing = _clientByApiKey.get(k);
    if (existing) return existing;

    if (!_OpenAIClientCtorPromise) {
        _OpenAIClientCtorPromise = import('openai').then(m => m?.default || m);
    }
    const OpenAI = await _OpenAIClientCtorPromise;
    const client = new OpenAI({ apiKey: k });
    _clientByApiKey.set(k, client);
    return client;
}

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

function extractOutputTextFromResponseLike(obj) {
    try {
        if (!obj || typeof obj !== 'object') return '';

        // Some events include { response: {...} }, others include { item: {...} }.
        const candidates = [];
        if (obj.response && typeof obj.response === 'object') candidates.push(obj.response);
        if (obj.item && typeof obj.item === 'object') candidates.push(obj.item);
        candidates.push(obj);

        const out = [];
        const pushText = (t) => {
            const s = typeof t === 'string' ? t : '';
            if (s) out.push(s);
        };

        for (const c of candidates) {
            // Primary Responses shape: response.output = [{ type:'message', content:[{type:'output_text', text:'...'}]}]
            const outputArr = Array.isArray(c?.output) ? c.output : null;
            if (outputArr) {
                for (const item of outputArr) {
                    const content = Array.isArray(item?.content) ? item.content : [];
                    for (const part of content) {
                        if (part?.type === 'output_text' && typeof part?.text === 'string') {
                            pushText(part.text);
                        }
                    }
                }
            }

            // Some item-done events may include a direct content array.
            const contentArr = Array.isArray(c?.content) ? c.content : null;
            if (contentArr) {
                for (const part of contentArr) {
                    if (part?.type === 'output_text' && typeof part?.text === 'string') {
                        pushText(part.text);
                    }
                }
            }

            // Fallbacks seen in some APIs
            if (typeof c?.text === 'string') pushText(c.text);
            if (typeof c?.output_text === 'string') pushText(c.output_text);
        }

        return out.join('').trim();
    } catch (_) {
        return '';
    }
}

function extractUrlCitationsFromResponseLike(obj) {
    try {
        if (!obj || typeof obj !== 'object') return [];

        const candidates = [];
        if (obj.response && typeof obj.response === 'object') candidates.push(obj.response);
        if (obj.item && typeof obj.item === 'object') candidates.push(obj.item);
        candidates.push(obj);

        const byUrl = new Map();
        const add = (ann) => {
            const url = typeof ann?.url === 'string' ? ann.url.trim() : '';
            if (!url) return;
            const title = typeof ann?.title === 'string' ? ann.title.trim() : '';
            if (!byUrl.has(url)) byUrl.set(url, { url, title });
        };

        for (const c of candidates) {
            const outputArr = Array.isArray(c?.output) ? c.output : null;
            if (outputArr) {
                for (const item of outputArr) {
                    const content = Array.isArray(item?.content) ? item.content : [];
                    for (const part of content) {
                        const anns = Array.isArray(part?.annotations) ? part.annotations : [];
                        for (const ann of anns) {
                            if (ann?.type === 'url_citation') add(ann);
                        }
                    }
                }
            }

            const contentArr = Array.isArray(c?.content) ? c.content : null;
            if (contentArr) {
                for (const part of contentArr) {
                    const anns = Array.isArray(part?.annotations) ? part.annotations : [];
                    for (const ann of anns) {
                        if (ann?.type === 'url_citation') add(ann);
                    }
                }
            }

            const annsTop = Array.isArray(c?.annotations) ? c.annotations : [];
            for (const ann of annsTop) {
                if (ann?.type === 'url_citation') add(ann);
            }
        }

        return [...byUrl.values()];
    } catch (_) {
        return [];
    }
}

function collectWebSearchCalls(obj, out = []) {
    if (!obj) return out;
    if (Array.isArray(obj)) {
        for (const v of obj) collectWebSearchCalls(v, out);
        return out;
    }
    if (typeof obj !== 'object') return out;
    if (obj.type === 'web_search_call') out.push(obj);
    for (const k of Object.keys(obj)) {
        collectWebSearchCalls(obj[k], out);
    }
    return out;
}

async function streamResponse({
    apiKey,
    model = 'gpt-4o-mini',
    systemPrompt,
    history,
    userText,
    images,
    temperature = 0,
    temp,
    maxOutputTokens = 700,
    tokens,
    topP,
    top_p,
    store,
    text,
    webSearch,
    onDelta,
    onCitations,
} = {}) {
    if (!apiKey) throw new Error('OpenAI API key missing');
    const input = buildInput({ systemPrompt, history, userText, images });
    if (!input.length) throw new Error('No input to send');

    const modelName = String(model || '').trim();

    const resolvedTemperature =
        typeof temperature === 'number'
            ? temperature
            : (typeof temp === 'number' ? temp : undefined);
    const resolvedMaxOutputTokens =
        typeof maxOutputTokens === 'number'
            ? maxOutputTokens
            : (typeof tokens === 'number' ? tokens : undefined);
    const resolvedTopP =
        typeof topP === 'number'
            ? topP
            : (typeof top_p === 'number' ? top_p : undefined);

    let resolvedText = text;
    if (typeof resolvedText === 'string' && resolvedText.trim()) {
        resolvedText = { format: resolvedText.trim() };
    }
    if (!resolvedText) {
        resolvedText = { format: 'text' };
    }
    if (resolvedText && typeof resolvedText === 'object' && typeof resolvedText.format === 'string') {
        resolvedText = { format: { type: resolvedText.format } };
    }

    const body = {
        model: modelName,
        stream: true,
        max_output_tokens: resolvedMaxOutputTokens,
        input,
        text: resolvedText,
    };
    if (typeof resolvedTemperature === 'number') {
        body.temperature = resolvedTemperature;
    }
    if (typeof resolvedTopP === 'number') {
        body.top_p = resolvedTopP;
    }
    if (typeof store === 'boolean') {
        body.store = store;
    } else if (modelName === 'gpt-4o-mini') {
        body.store = true;
    }

    if (webSearch && typeof webSearch === 'object' && webSearch.enabled) {
        const allowed = ['gpt-4o-mini', 'gpt-4.1-mini'];
        if (allowed.includes(modelName)) {
            body.tools = [{ type: 'web_search' }];
        }
    }

    const client = await getOpenAIClient(apiKey);

    let fullText = '';
    let finalFromEvents = '';
    const seenWebSearch = new Set();
    const citationsByUrl = new Map();

    const emit = delta => {
        const d = String(delta || '');
        if (!d) return;
        fullText += d;
        if (typeof onDelta === 'function') {
            try { onDelta(d); } catch (_) {}
        }
    };

    let stream;
    try {
        stream = await client.responses.create(body);
    } catch (e) {
        const status = e?.status || e?.response?.status;
        const msg = e?.message || String(e);
        if (status === 429) throw new Error(`OpenAI rate limited (429): ${msg}`);
        throw new Error(msg);
    }

    for await (const event of stream) {
        try {
            const calls = collectWebSearchCalls(event, []);
            for (const c of calls) {
                const query = typeof c?.query === 'string' ? c.query.trim() : '';
                const id = String(c?.id || c?.call_id || c?.tool_call_id || query || '');
                if (!id) continue;
                if (seenWebSearch.has(id)) continue;
                seenWebSearch.add(id);
                const results = Array.isArray(c?.results) ? c.results : [];
                const urls = results
                    .map(r => (typeof r?.url === 'string' ? r.url : ''))
                    .filter(Boolean)
                    .slice(0, 8);
                try {
                    console.log('[AI][WEB_SEARCH] Tool call', {
                        model: modelName,
                        query,
                        results: results.length,
                        urls,
                    });
                } catch (_) {}
            }
        } catch (_) {}

        if (event?.type === 'response.output_text.delta' && typeof event?.delta === 'string') {
            emit(event.delta);
        }

        if (
            event?.type === 'response.completed' ||
            event?.type === 'response.output_item.done' ||
            event?.type === 'response.output_text.done' ||
            event?.type === 'response.output_item.added'
        ) {
            const extracted = extractOutputTextFromResponseLike(event);
            if (extracted) finalFromEvents = extracted;

            const citations = extractUrlCitationsFromResponseLike(event);
            for (const c of citations) {
                const url = typeof c?.url === 'string' ? c.url.trim() : '';
                if (!url) continue;
                if (!citationsByUrl.has(url)) citationsByUrl.set(url, c);
            }
        }

        if (event?.type === 'response.error') {
            const msg = event?.error?.message || 'OpenAI stream error';
            throw new Error(String(msg));
        }
    }

    const out = String(fullText || '').trim() || String(finalFromEvents || '').trim();
    // If we got a final text but streamed no deltas, emit it once so the UI updates immediately.
    if (!String(fullText || '').trim() && out && typeof onDelta === 'function') {
        try { onDelta(out); } catch (_) {}
    }

    if (typeof onCitations === 'function') {
        try { onCitations([...citationsByUrl.values()]); } catch (_) {}
    }
    return out;
}

async function warmup({
    apiKey,
    model = 'gpt-4o-mini',
    signal,
} = {}) {
    if (!apiKey) return false;
    const modelName = String(model || '').trim();
    const body = {
        model: modelName,
        stream: false,
        max_output_tokens: 16,
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'ok' }] }],
        temperature: 0,
    };
    const client = await getOpenAIClient(apiKey);
    try {
        if (signal) {
            await client.responses.create(body, { signal });
        } else {
            await client.responses.create(body);
        }
        return true;
    } catch (e) {
        const status = e?.status || e?.response?.status;
        const msg = e?.message || String(e);
        throw new Error(`OpenAI warmup failed (${status || 'error'}): ${String(msg || '').trim().slice(0, 260)}`);
    }
}

module.exports = {
    streamResponse,
    buildInput,
    warmup,
};
