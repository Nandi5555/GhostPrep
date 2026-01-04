let BrowserWindow = null;
let ipcMain = null;
try {
    const electron = require('electron');
    if (electron && typeof electron === 'object') {
        if (electron.BrowserWindow) BrowserWindow = electron.BrowserWindow;
        if (electron.ipcMain) ipcMain = electron.ipcMain;
    }
} catch (_) {}
const { spawn } = require('child_process');

const { getSystemPrompt } = require('./prompts');
const { streamResponse, warmup } = require('./llm/openaiResponsesClient');
const { IntentBoundary } = require('./intentBoundary');

// ASR
const { DeepgramStreamingClient } = require('./asr/deepgramClient');

// Conversation persistence helpers (reuse)
const { buildHistoryForModel } = require('./transcriptionFlow');

// Buffered image context (captured during a session, submitted only on explicit user action)
let pendingImages = [];
const MAX_PENDING_IMAGES = 3;
let useScreenEnabled = false;

// macOS system audio capture (speaker mode)
let systemAudioProc = null;

// Session state
let isInitializingSession = false;
let activeInitAbortController = null;
let sessionActive = false;
let transcriptionMode = 'manual'; // manual by default (auto optional)
let boundary = new IntentBoundary();

let deepgramClient = null;
let deepgramApiKey = '';
let openaiApiKey = '';
let openaiModelName = 'gpt-4o-mini';
let asrLanguage = 'en-US';
let activeSystemPrompt = '';

// Transcript buffers:
// - display*: shown in transcript tab (persists across the session)
// - buffer*: the "question buffer" since the last explicit submit (cleared on submit)
let displayFinal = '';
let displayDraft = '';
let bufferFinal = '';
let bufferDraft = '';

// Conversation history (persists across questions)
let currentSessionId = null;
let conversationHistory = [];

const DEFAULT_ASSIST_ACTION_PROMPT =
    'Answer the question directly. Treat the transcript as an interviewer question and assume it may contain minor speech-to-text errors. ' +
    'Silently correct obvious transcription mistakes and answer the intended question. Do not mention transcription errors, do not ask clarifying questions.';

const SCREEN_ONLY_ASSIST_PROMPT =
    'Describe what is visible on the shared screen as accurately as possible.\n' +
    '- Do not make assumptions beyond what is visible.\n' +
    '- If the capture is partial, do not assume missing areas.\n' +
    '- If text is too small/blurred, say it is not legible.\n' +
    '- If the screen contains code, logs, UI, or documents, use the relevant details to answer.\n' +
    '- If uncertain, say what is uncertain and why.\n' +
    '- Do not ask clarifying questions unless absolutely necessary.';

// Runtime visibility / debug state
let asrStatus = 'disconnected'; // connected|disconnected|error|connecting
let llmStatus = 'ready'; // ready|error
let listening = false;
let lastUiError = '';
let firstAudioChunkSeen = false;
let audioChunkCount = 0;
let lastInterimLogAt = 0;

function getLastNonScreenTranscript(history = []) {
    for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i] || {};
        if (turn.usedScreen) continue;
        const t = String(turn.transcription || turn.transcript || '').trim();
        if (t) return t;
    }
    return '';
}

function log(prefix, ...args) {
    try { console.log(prefix, ...args); } catch (_) {}
}
function logErr(prefix, ...args) {
    try { console.error(prefix, ...args); } catch (_) {}
}

function pushAiStatus(extra = {}) {
    try {
        sendToRenderer('ai-status', {
            asr: asrStatus,
            llm: llmStatus,
            listening: !!listening,
            lastError: lastUiError || '',
            ...extra,
        });
    } catch (_) {}
}

function emitChatUserTurn({ text, source = 'voice', actionName = '' } = {}) {
    const t = String(text || '').trim();
    if (!t) return;
    try {
        sendToRenderer('chat-user-turn', {
            text: t,
            source: String(source || 'voice'),
            actionName: String(actionName || ''),
        });
    } catch (_) {}
}

function surfaceUiError(message, context = '') {
    const msg = String(message || 'Unknown error');
    lastUiError = msg;
    llmStatus = llmStatus === 'error' ? 'error' : llmStatus;
    try { sendToRenderer('update-status', msg); } catch (_) {}
    try { sendToRenderer('ui-error', { message: msg, context: String(context || '') }); } catch (_) {}
    pushAiStatus();
}

function sendToRenderer(channel, data) {
    if (!BrowserWindow) return;
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateStreamToRenderer(channel, text, { chunkSize = 10, delayMs = 18 } = {}) {
    const t = String(text || '');
    if (!t) return;
    let i = 0;
    while (i < t.length) {
        const chunk = t.slice(i, i + chunkSize);
        i += chunkSize;
        try { sendToRenderer(channel, chunk); } catch (_) {}
        // Keep UI feeling "live" but don't drag too long.
        // Small texts will finish almost immediately.
        await sleep(delayMs);
    }
}

function splitThinkingAnswer(raw) {
    const s = String(raw || '');
    const tMarker = '<<THINKING>>';
    const aMarker = '<<ANSWER>>';
    const tIdx = s.indexOf(tMarker);
    const aIdx = s.indexOf(aMarker);
    if (tIdx !== -1 && aIdx !== -1 && aIdx > tIdx) {
        const thinking = s.slice(tIdx + tMarker.length, aIdx).trim();
        const answer = s.slice(aIdx + aMarker.length).trim();
        return { thinking, answer };
    }
    // Fallback: no markers, treat as answer.
    return { thinking: '', answer: s.trim() };
}

function looksLikeModelNotFound(msg = '') {
    const m = String(msg || '').toLowerCase();
    return (
        (m.includes('model') && (m.includes('not found') || m.includes('does not exist') || m.includes('not available'))) ||
        m.includes('not supported') ||
        m.includes('invalid argument')
    );
}

function formatMergedTypedAndSpokenInput({ typedText = '', spokenText = '' } = {}) {
    const t = String(typedText || '').trim();
    const s = String(spokenText || '').trim();
    if (!t && !s) return '';
    if (t && !s) return t;
    if (!t && s) return s;

    // Explicit structure so the model reliably associates the spoken instruction with the pasted content.
    return (
        `Pasted content (text input):\n` +
        `${t}\n\n` +
        `Spoken instruction (voice transcription):\n` +
        `${s}\n`
    ).trim();
}

function clearPendingImages() {
    pendingImages = [];
}

function setUseScreenEnabled(enabled) {
    useScreenEnabled = !!enabled;
    if (!useScreenEnabled) clearPendingImages();
}

function initializeNewSession() {
    currentSessionId = Date.now().toString();
    conversationHistory = [];
    displayFinal = '';
    displayDraft = '';
    bufferFinal = '';
    bufferDraft = '';
    boundary.reset();
}

function saveConversationTurn(transcription, aiResponse, meta = {}) {
    if (!currentSessionId) initializeNewSession();
    const conversationTurn = {
        timestamp: Date.now(),
        transcription: String(transcription || '').trim(),
        ai_response: String(aiResponse || '').trim(),
        usedScreen: !!meta.usedScreen,
    };
    conversationHistory.push(conversationTurn);
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function getHistoryForOpenAI(conversationHistoryInput, { includeScreenTurns = true } = {}) {
    // Returns: array of { role: 'user'|'assistant', text }
    return buildHistoryForModel(conversationHistoryInput, {
        includeScreenTurns,
        // Keep larger context inside the same live session.
        maxMessages: 60,
        maxChars: 20000,
    });
}

function getTranscriptForUi() {
    // Interim (draft) replaces the current draft; final persists.
    // UI sees a single text blob.
    return `${displayFinal || ''}${displayDraft || ''}`;
}

function pushDraft(text) {
    displayDraft = String(text || '');
    bufferDraft = String(text || '');
    sendToRenderer('update-transcript', { finalText: displayFinal, draftText: displayDraft });
}

function commitDraftAsUtterance() {
    const t = String(displayDraft || '').trim();
    if (!t) {
        displayDraft = '';
        bufferDraft = '';
        sendToRenderer('update-transcript', { finalText: displayFinal, draftText: displayDraft });
        return;
    }

    // Commit once with a newline delimiter.
    displayFinal += `${t}\n`;
    bufferFinal += `${t}\n`;
    displayDraft = '';
    bufferDraft = '';
    sendToRenderer('update-transcript', { finalText: displayFinal, draftText: displayDraft });
}

function stopAsr() {
    if (deepgramClient) {
        try { deepgramClient.close(); } catch (_) {}
        deepgramClient = null;
    }
}

async function initializeAiSession({
    deepgramKey,
    openaiKey,
    openaiModel = 'gpt-4o-mini',
    customPrompt = '',
    profile = 'interview',
    language = 'en-US',
} = {}) {
    if (isInitializingSession) return { success: false, error: 'Session initialization in progress' };
    const hasDeepgram = !!(deepgramKey && String(deepgramKey).trim());
    const hasOpenAi = !!(openaiKey && String(openaiKey).trim());
    if (!hasDeepgram) return { success: false, error: 'Deepgram API key missing' };
    if (!hasOpenAi) return { success: false, error: 'OpenAI API key required' };

    isInitializingSession = true;
    if (activeInitAbortController) {
        try { activeInitAbortController.abort(); } catch (_) {}
    }
    activeInitAbortController = new AbortController();
    sendToRenderer('session-initializing', true);
    asrStatus = 'disconnected';
    llmStatus = 'connecting';
    listening = false;
    firstAudioChunkSeen = false;
    audioChunkCount = 0;
    lastUiError = '';
    pushAiStatus();
    log('[AI][SESSION] initialize-ai called', { profile, language });
    sendToRenderer('update-status', 'Connecting...');

    try {
        asrLanguage = String(language || 'en-US').trim() || 'en-US';
        deepgramApiKey = hasDeepgram ? String(deepgramKey).trim() : '';
        openaiApiKey = hasOpenAi ? String(openaiKey).trim() : '';
        const normalizedModel = String(openaiModel || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
        const allowedModels = ['gpt-4o-mini'];
        openaiModelName = allowedModels.includes(normalizedModel) ? normalizedModel : 'gpt-4o-mini';

        log('[AI][LLM] Providers ready', {
            openai: !!openaiApiKey,
            openaiModel: openaiModelName,
        });

        // Build persistent system prompt ONCE per session (Cluely-style).
        // No per-question modifications.
        activeSystemPrompt = getSystemPrompt(profile, customPrompt, false);
        log('[AI][PROMPT] System prompt built once', { chars: activeSystemPrompt.length });

        // Fresh session state
        initializeNewSession();
        sessionActive = false;

        const abortSignal = activeInitAbortController.signal;
        const surfaceInitError = (message) => {
            const msg = String(message || 'Unknown error');
            lastUiError = msg;
            try { sendToRenderer('update-status', msg); } catch (_) {}
            pushAiStatus();
        };
        try {
            await warmup({ apiKey: openaiApiKey, model: openaiModelName, signal: abortSignal });
            llmStatus = 'ready';
            pushAiStatus();
        } catch (e) {
            const msg = e?.name === 'AbortError' ? 'Cancelled' : (e?.message || String(e));
            if (msg !== 'Cancelled') {
                llmStatus = 'error';
                surfaceInitError(msg);
            }
            throw new Error(msg);
        }

        // Start Deepgram ASR (only after OpenAI is confirmed)
        asrStatus = 'connecting';
        pushAiStatus();
        sessionActive = true;
        stopAsr();
        deepgramClient = new DeepgramStreamingClient({
            apiKey: deepgramApiKey,
            language: asrLanguage,
            // Prefer nova-3 for best accuracy/latency (Deepgram ASR).
            model: 'nova-3',
            sampleRate: 24000,
            channels: 1,
        });

        const deepgramConnectedPromise = new Promise((resolve, reject) => {
            let settled = false;
            const timeoutMs = 9000;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                try { reject(new Error('Deepgram connection timeout')); } catch (_) {}
            }, timeoutMs);
            const cleanup = () => {
                try { clearTimeout(timer); } catch (_) {}
                try { abortSignal.removeEventListener('abort', onAbort); } catch (_) {}
            };
            const onAbort = () => {
                if (settled) return;
                settled = true;
                cleanup();
                try { reject(new Error('Cancelled')); } catch (_) {}
            };
            try { abortSignal.addEventListener('abort', onAbort); } catch (_) {}

            deepgramClient.connect({
                onOpen: () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                asrStatus = 'connected';
                listening = true;
                pushAiStatus();
                log('[AI][ASR] Connected');
                    sendToRenderer('update-status', 'Listening...');
                    resolve(true);
                },
                onInterim: (text, meta) => {
                // Always replace the draft.
                const now = Date.now();
                // Log interim at most ~3 times/sec to avoid overwhelming the console.
                if (now - lastInterimLogAt > 320) {
                    lastInterimLogAt = now;
                    log('[AI][ASR] Interim transcript:', JSON.stringify(String(text || '').slice(0, 140)));
                }
                pushDraft(text);
                },
                onUtteranceEnd: () => {
                boundary.onUtteranceEnd();
                log('[AI][ASR] Utterance end (commit draft)');
                commitDraftAsUtterance();
                // Optional auto-mode (OFF by default)
                if (boundary.shouldAutoSubmitNow({ transcriptionMode })) {
                    // Fire and forget: never block ASR callbacks.
                    log('[AI][AUTO] Auto-submit triggered by boundary');
                    setImmediate(() => {
                        try { autoSubmitIfEnabled(); } catch (_) {}
                    });
                }
                },
                onError: err => {
                    const msg = err?.message || String(err || 'ASR error');
                    asrStatus = 'error';
                    listening = false;
                    pushAiStatus();
                    logErr('[AI][ASR] Error', msg);
                    sendToRenderer('update-status', `ASR error: ${msg}`);
                    if (!settled) {
                        settled = true;
                        cleanup();
                        try { reject(new Error(msg)); } catch (_) {}
                    }
                },
                onClose: info => {
                    // Do not auto-reconnect; keep behavior stable/deterministic.
                    if (sessionActive) {
                        asrStatus = 'disconnected';
                        listening = false;
                        pushAiStatus();
                        log('[AI][ASR] Disconnected', info || {});
                        sendToRenderer('update-status', 'ASR disconnected');
                    }
                    if (!settled) {
                        settled = true;
                        cleanup();
                        try { reject(new Error('Deepgram disconnected')); } catch (_) {}
                    }
                },
            });
        });

        await deepgramConnectedPromise;
        pushAiStatus({ ready: true });
        return { success: true, ready: true };
    } catch (e) {
        const msg = e?.message || String(e);
        if (msg !== 'Cancelled') {
            logErr('[AI][SESSION] initialize-ai failed', msg);
            lastUiError = String(msg || '');
            try { sendToRenderer('update-status', lastUiError); } catch (_) {}
            pushAiStatus();
        }
        try { stopAsr(); } catch (_) {}
        sessionActive = false;
        if (msg === 'Cancelled') {
            lastUiError = '';
            try { sendToRenderer('update-status', ''); } catch (_) {}
            pushAiStatus();
            return { success: false, cancelled: true };
        }
        return { success: false, error: msg };
    } finally {
        isInitializingSession = false;
        activeInitAbortController = null;
        sendToRenderer('session-initializing', false);
    }
}

async function submitNow({ actionName = '', actionPrompt = '', uiAlreadyShown = false, textOverride = '', typedContext = '' } = {}) {
    log('[AI][SUBMIT] submitNow() called', { actionName: String(actionName || '').trim() || '(none)' });
    if (!sessionActive) {
        surfaceUiError('ASR/LLM session not active', 'submitNow');
        return { success: false, error: 'No active session' };
    }
    if (!openaiApiKey) {
        surfaceUiError('OpenAI API key missing', 'submitNow');
        return { success: false, error: 'OpenAI API key missing' };
    }

    // Snapshot immediately: NO settle wait, NO debounce, NO minimum length.
    const overrideText = String(textOverride || '').trim();
    const typedContextText = String(typedContext || '').trim();
    const snapshotSpokenText = String(`${bufferFinal || ''}${bufferDraft || ''}`).trim();
    let snapshotText = overrideText ? overrideText : snapshotSpokenText;
    const imagesToUse = useScreenEnabled ? pendingImages : [];
    const hasImages = Array.isArray(imagesToUse) && imagesToUse.length > 0;
    log('[AI][SUBMIT] Snapshot length:', `${snapshotText.length} chars`);
    log('[AI][SUBMIT] Screenshots attached:', hasImages ? imagesToUse.length : 0);
    try {
        log('[AI][SUBMIT] History size:', Array.isArray(conversationHistory) ? conversationHistory.length : 0);
    } catch (_) {}

    // If no new input, fall back to the last non-screen transcript to avoid spurious errors
    if (!overrideText && !typedContextText && !snapshotSpokenText && !hasImages) {
        const fallbackTranscript = getLastNonScreenTranscript(conversationHistory);
        if (fallbackTranscript) {
            snapshotText = fallbackTranscript;
        }
    }

    // Allow very short questions. If the user submits with empty transcript, only allow if screen is enabled & we have images.
    if (!overrideText && !typedContextText && !snapshotText && !hasImages) {
        logErr('[AI][SUBMIT] Empty snapshot and no screenshots -> refusing to submit');
        if (asrStatus !== 'connected') {
            surfaceUiError('ASR not connected. Fix ASR connection first (check key), then try again.', 'submitNow');
        } else {
            surfaceUiError('No transcript captured (and no screenshots). Speak first or enable Use Screen.', 'submitNow');
        }
        return { success: false, error: 'No transcript or screen available' };
    }

    // For "answer now" submits (Ctrl/Cmd+Enter, Assist button, prompt buttons), emit a real chat user bubble
    // with the action label EVEN WHEN there is no transcript (screen-only).
    // This matches Cluely behavior: action submits show "Assist" in the UI while using transcript/screen as hidden context.
    if (!overrideText && ((typedContextText || snapshotText) || hasImages)) {
        const displayText = actionName && String(actionName).trim() ? String(actionName).trim() : 'Assist';
        emitChatUserTurn({ text: displayText, source: 'voice', actionName });
    }

    // Clear the question buffer on ANY explicit submit (typed or voice).
    // If we don't clear for typed submits, the next voice submit may include stale transcript and break context.
    bufferFinal = '';
    bufferDraft = '';

    // Clear image buffer once we decide to include it
    if (hasImages) clearPendingImages();

    listening = false;
    pushAiStatus();
    sendToRenderer('update-status', 'Answering...');
    if (!uiAlreadyShown) {
        const display = actionName || 'Assist';
        try { sendToRenderer('transcription-submitted', { text: display, actionName: display }); } catch (_) {}
    }

    const includeScreenTurns = !!useScreenEnabled;
    const history = getHistoryForOpenAI(conversationHistory, { includeScreenTurns });

    let userText = '';
    if (overrideText) {
        // Typed text message: merge with the most recent voice buffer if present.
        // This matches Cluely behavior where pasted content + spoken instruction is treated as one intent.
        userText = formatMergedTypedAndSpokenInput({ typedText: overrideText, spokenText: snapshotSpokenText });
    } else if (typedContextText || snapshotText) {
        const merged = typedContextText
            ? formatMergedTypedAndSpokenInput({ typedText: typedContextText, spokenText: snapshotSpokenText })
            : snapshotText;
        // Voice submission: send transcript directly without prepending redundant action prompts.
        // The system prompt already has strong instructions for handling transcription errors
        // and understanding the intended question. Prepending additional instructions can
        // interfere with the model's ability to correctly interpret the question.
        // Only prepend action prompt if it's a special action that requires specific behavior
        // beyond answering the transcript (e.g., "What should I say next?" needs different output format).
        const name = String(actionName || '').trim().toLowerCase();
        const prompt = String(actionPrompt || '').trim();
        
        // Check if this is a special action that needs specific instructions beyond default behavior.
        // Default "Assist" action should just send transcript - system prompt handles error correction.
        const isSpecialAction = prompt && 
            prompt !== DEFAULT_ASSIST_ACTION_PROMPT && 
            prompt !== 'Assist!' &&
            !name.includes('assist') &&
            prompt.length > 30 && // Only meaningful custom prompts
            !prompt.toLowerCase().includes('answer the question directly'); // Skip redundant assist prompts
        
        userText = isSpecialAction
            ? `${prompt}\n\n${merged}`
            : merged;
    } else {
        // Screen-only submission (no transcript).
        // If this is Assist (or a transcript-focused Assist prompt), use a screen-aware instruction set.
        const name = String(actionName || '').trim().toLowerCase();
        const prompt = String(actionPrompt || '').trim();
        const isAssistLike =
            !name ||
            name.includes('assist') ||
            prompt === DEFAULT_ASSIST_ACTION_PROMPT ||
            prompt === 'Assist!';
        userText = isAssistLike
            ? SCREEN_ONLY_ASSIST_PROMPT
            : (prompt ? prompt : 'Analyze the screenshot and provide the best possible answer based only on what you see.');
    }

    let finalText = '';
    try {
        llmStatus = 'ready';
        pushAiStatus();
        const t0 = Date.now();

        // OpenAI-only: stream tokens immediately to the renderer, then set one final answer at the end.
        const preferredModelName = String(openaiModelName || '').trim() || 'gpt-4o-mini';
        log('[AI][LLM] OpenAI request started', { model: preferredModelName });
        try {
            sendToRenderer('llm-start', {
                provider: 'openai',
                model: preferredModelName,
                at: Date.now(),
            });
        } catch (_) {}

        let openaiFirstTokenMs = null;
        let buf = '';
        const doCall = async (modelName) =>
            await streamResponse({
                apiKey: openaiApiKey,
                model: modelName,
                temperature: 0,
                systemPrompt: activeSystemPrompt,
                history,
                userText,
                images: hasImages ? imagesToUse : [],
                maxOutputTokens: 900,
                onDelta: delta => {
                    const d = String(delta || '');
                    if (!d) return;
                    buf += d;
                    if (openaiFirstTokenMs === null) {
                        openaiFirstTokenMs = Date.now() - t0;
                        log('[AI][LLM] OpenAI first token', { ms: openaiFirstTokenMs });
                    }
                    try { sendToRenderer('update-response-stream', d); } catch (_) {}
                },
            });

        try {
            buf = await doCall(preferredModelName);
        } catch (e) {
            // Do NOT fall back to other models. If the selected model fails, surface the error.
            throw e;
        }

        finalText = String(buf || '').trim();
        if (!finalText) {
            // Prevent infinite "loading" UI when the model returns an empty response.
            throw new Error('Empty response from model');
        }

        log('[AI][LLM] Completed', {
            ms: Date.now() - t0,
            openai: true,
            chars: (finalText || '').length,
        });

        sendToRenderer('update-response', finalText || '');
        try { sendToRenderer('llm-end', { provider: 'openai', success: true, at: Date.now() }); } catch (_) {}
        listening = true;
        pushAiStatus();
        sendToRenderer('update-status', 'Listening...');

        try {
            const storedUserText = (overrideText || typedContextText || snapshotSpokenText) ? userText : '(screen only)';
            saveConversationTurn(storedUserText || '(screen only)', finalText || '', { usedScreen: hasImages });
        } catch (_) {}

        lastUiError = '';
        llmStatus = 'ready';
        pushAiStatus();
        return { success: true };
    } catch (e) {
        const msg = e?.message || String(e);
        try { sendToRenderer('llm-end', { provider: 'openai', success: false, error: String(msg || ''), at: Date.now() }); } catch (_) {}
        llmStatus = 'error';
        listening = !!(asrStatus === 'connected');
        pushAiStatus();
        logErr('[AI][LLM] Error', msg);
        surfaceUiError(`LLM request failed: ${msg}`, 'openai');
        return { success: false, error: msg };
    }
}

let autoSubmitInFlight = false;
async function autoSubmitIfEnabled() {
    if (transcriptionMode !== 'auto') return;
    if (autoSubmitInFlight) return;
    autoSubmitInFlight = true;
    try {
        // Auto submit uses the same snapshot rules, but still never blocks ASR.
        await submitNow({ actionName: 'Assist', actionPrompt: '' });
    } finally {
        autoSubmitInFlight = false;
    }
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        if (process.platform !== 'darwin') return resolve();
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], { stdio: 'ignore' });
        killProc.on('close', () => resolve());
        killProc.on('error', () => resolve());
        setTimeout(() => {
            try { killProc.kill(); } catch (_) {}
            resolve();
        }, 2000);
    });
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }
    return monoBuffer;
}

function pcm16ToWav(pcmBuffer, sampleRate = 24000, channels = 1) {
    const byteRate = sampleRate * channels * 2;
    const blockAlign = channels * 2;
    const dataSize = pcmBuffer.length;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // PCM chunk size
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmBuffer.copy(buffer, 44);
    return buffer;
}

function sendAudioToAsr(buf) {
    if (!buf || !buf.length) return;
    if (deepgramClient) {
        try { deepgramClient.sendAudio(buf); } catch (_) {}
    }
}

async function startMacOSSystemAudioCapture() {
    if (process.platform !== 'darwin') {
        return { success: false, error: 'System audio capture only available on macOS' };
    }
    if (!sessionActive) {
        return { success: false, error: 'ASR not initialized' };
    }
    if (!deepgramClient) {
        return { success: false, error: 'ASR not initialized' };
    }

    await killExistingSystemAudioDump();

    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    // macOS: ensure the binary is executable, otherwise spawn() fails with EACCES.
    // This can happen if the file mode wasn't preserved (e.g., zip download, git mode loss).
    try {
        fs.accessSync(systemAudioPath, fs.constants.X_OK);
    } catch (_) {
        try {
            fs.chmodSync(systemAudioPath, 0o755);
        } catch (e) {
            return {
                success: false,
                error:
                    `SystemAudioDump is not executable (${e?.message || e}). ` +
                    `Fix by running: chmod +x "${systemAudioPath}"`,
            };
        }
    }

    systemAudioProc = spawn(systemAudioPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (!systemAudioProc.pid) {
        systemAudioProc = null;
        return { success: false, error: 'Failed to start SystemAudioDump' };
    }

    const CHUNK_DURATION = 0.02;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = Math.floor(SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION);

    let audioBuffer = Buffer.alloc(0);
    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);
        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);
            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            try { sendAudioToAsr(monoChunk); } catch (_) {}
        }
        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });
    systemAudioProc.stderr.on('data', () => {});
    systemAudioProc.on('close', () => {
        systemAudioProc = null;
    });
    systemAudioProc.on('error', () => {
        systemAudioProc = null;
    });

    return { success: true };
}

function stopMacOSSystemAudioCapture() {
    if (systemAudioProc) {
        try { systemAudioProc.kill('SIGTERM'); } catch (_) {}
        systemAudioProc = null;
    }
}

function closeAiSession() {
    log('[AI][SESSION] close-ai-session');
    try { stopMacOSSystemAudioCapture(); } catch (_) {}
    try { stopAsr(); } catch (_) {}
    clearPendingImages();
    sessionActive = false;
    asrStatus = 'disconnected';
    llmStatus = 'ready';
    listening = false;
    deepgramApiKey = '';
    openaiApiKey = '';
    activeSystemPrompt = '';
    displayFinal = '';
    displayDraft = '';
    bufferFinal = '';
    bufferDraft = '';
    boundary.reset();
    pushAiStatus();
    return { success: true };
}

function setupAiIpcHandlers() {
    // Provider keys + session init
    ipcMain.handle('initialize-ai', async (_event, payload) => {
        const p = payload && typeof payload === 'object' ? payload : {};
        return await initializeAiSession({
            deepgramKey: p.deepgramApiKey,
            openaiKey: p.openaiApiKey,
            openaiModel: p.openaiModel,
            customPrompt: p.customPrompt || '',
            profile: p.profile || 'interview',
            language: p.language || 'en-US',
        });
    });

    ipcMain.handle('cancel-ai-initialize', async () => {
        try {
            if (activeInitAbortController) {
                try { activeInitAbortController.abort(); } catch (_) {}
            }
            try { stopAsr(); } catch (_) {}
            sessionActive = false;
            asrStatus = 'disconnected';
            listening = false;
            pushAiStatus();
            try { sendToRenderer('session-initializing', false); } catch (_) {}
            return { success: true };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    ipcMain.handle('close-ai-session', async () => {
        return closeAiSession();
    });

    // Screen gate
    ipcMain.handle('set-use-screen-enabled', async (_event, enabled) => {
        try {
            setUseScreenEnabled(!!enabled);
            log('[AI][SCREEN] Use Screen set to', useScreenEnabled);
            pushAiStatus({ useScreen: useScreenEnabled });
            return { success: true, enabled: useScreenEnabled };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    // VAD signals (from renderer)
    ipcMain.on('speech-start', () => {
        boundary.onSpeechStart();
    });
    ipcMain.on('speech-end', () => {
        boundary.onSpeechEnd();
    });

    // Audio ingest (from renderer)
    ipcMain.on('audio-chunk', (_event, payload) => {
        if (!sessionActive) return;
        try {
            audioChunkCount++;
            if (!firstAudioChunkSeen) {
                firstAudioChunkSeen = true;
                log('[AI][ASR] First audio chunk received');
            }
            if (payload && payload.raw) {
                // raw: Uint8Array
                const buf = Buffer.isBuffer(payload.raw)
                    ? payload.raw
                    : (payload.raw instanceof ArrayBuffer)
                          ? Buffer.from(payload.raw)
                          : ArrayBuffer.isView(payload.raw)
                                ? Buffer.from(payload.raw.buffer, payload.raw.byteOffset, payload.raw.byteLength)
                                : Buffer.from(payload.raw);
                sendAudioToAsr(buf);
            } else if (payload && typeof payload.data === 'string') {
                // Legacy base64 path (avoid if possible)
                const buf = Buffer.from(payload.data, 'base64');
                sendAudioToAsr(buf);
            }
        } catch (_) {}
    });

    // macOS system audio capture control (speaker mode)
    ipcMain.handle('start-macos-system-audio', async () => {
        return await startMacOSSystemAudioCapture();
    });
    ipcMain.handle('stop-macos-system-audio', async () => {
        try {
            stopMacOSSystemAudioCapture();
            return { success: true };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    // Buffer screenshots (renderer sends base64 jpeg)
    ipcMain.handle('send-image-content', async (_event, { data } = {}) => {
        try {
            if (!data || typeof data !== 'string') return { success: false, error: 'Invalid image data' };
            if (!useScreenEnabled) return { success: true, ignored: true };
            pendingImages.push({ data, mimeType: 'image/jpeg' });
            if (pendingImages.length > MAX_PENDING_IMAGES) {
                pendingImages.splice(0, pendingImages.length - MAX_PENDING_IMAGES);
            }
            log('[AI][SCREEN] Screenshot buffered', { count: pendingImages.length });
            return { success: true };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    // Update transcription mode (auto/manual)
    ipcMain.handle('update-transcription-mode', async (_event, mode) => {
        transcriptionMode = mode === 'auto' ? 'auto' : 'manual';
        return { success: true, mode: transcriptionMode };
    });

    // Manual submit: buffered transcript snapshot -> answer
    ipcMain.handle('send-current-transcription', async (_event, payload) => {
        const p = payload && typeof payload === 'object' ? payload : {};
        log('[AI][SUBMIT] Ctrl/Cmd+Enter received', { actionName: p.actionName || '' });
        return await submitNow({
            actionName: p.actionName || '',
            actionPrompt: p.actionPrompt || '',
            uiAlreadyShown: !!p.uiAlreadyShown,
            typedContext: p.typedText || p.typedContext || '',
        });
    });

    // Typed text submit -> answer
    ipcMain.handle('send-text-message', async (_event, text) => {
        if (!sessionActive) return { success: false, error: 'No active session' };
        const t = String(text || '').trim();
        if (!t) return { success: false, error: 'Invalid text message' };
        // UI already inserts the typed message into the chat thread; do not emit an action bubble.
        return await submitNow({ actionName: '', actionPrompt: '', uiAlreadyShown: true, textOverride: t });
    });
}

module.exports = {
    sendToRenderer,
    setupAiIpcHandlers,
    closeAiSession,
    stopMacOSSystemAudioCapture,
    formatMergedTypedAndSpokenInput,
};
