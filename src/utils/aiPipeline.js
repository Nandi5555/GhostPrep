const { BrowserWindow, ipcMain } = require('electron');
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
let sessionActive = false;
let transcriptionMode = 'manual'; // manual by default (auto optional)
let boundary = new IntentBoundary();

let deepgramClient = null;
let deepgramApiKey = '';
let openaiApiKey = '';
let openaiModelName = 'gpt-4.1-nano';
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

// Runtime visibility / debug state
let asrStatus = 'disconnected'; // connected|disconnected|error|connecting
let llmStatus = 'ready'; // ready|error
let listening = false;
let lastUiError = '';
let firstAudioChunkSeen = false;
let audioChunkCount = 0;
let lastInterimLogAt = 0;

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
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
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
    // Reuse existing history builder but map role names for OpenAI.
    const base = buildHistoryForModel(conversationHistoryInput, { includeScreenTurns });
    return base.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        text: h.text,
    }));
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
    openaiModel = 'gpt-4.1-nano',
    customPrompt = '',
    profile = 'interview',
    language = 'en-US',
} = {}) {
    if (isInitializingSession) return { success: false, error: 'Session initialization in progress' };
    if (!deepgramKey || !String(deepgramKey).trim()) return { success: false, error: 'Deepgram API key missing' };
    if (!openaiKey || !String(openaiKey).trim()) return { success: false, error: 'OpenAI API key missing' };

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);
    asrStatus = 'connecting';
    llmStatus = 'ready';
    listening = false;
    firstAudioChunkSeen = false;
    audioChunkCount = 0;
    lastUiError = '';
    pushAiStatus();
    log('[AI][SESSION] initialize-ai called', { profile, language });
    sendToRenderer('update-status', 'Connecting...');

    try {
        deepgramApiKey = String(deepgramKey).trim();
        openaiApiKey = String(openaiKey).trim();
        openaiModelName = String(openaiModel || 'gpt-4.1-nano').trim() || 'gpt-4.1-nano';
        log('[AI][LLM] OpenAI key present, model:', openaiModelName);

        // Fire-and-forget warmup to reduce first-token latency on the first real answer.
        try {
            setImmediate(() => {
                warmup({ apiKey: openaiApiKey, model: openaiModelName })
                    .then(ok => log('[AI][LLM] Warmup', ok ? 'ok' : 'failed'))
                    .catch(() => {});
            });
        } catch (_) {}

        // Build persistent system prompt ONCE per session (Cluely-style).
        // No per-question modifications.
        activeSystemPrompt = getSystemPrompt(profile, customPrompt, false);
        log('[AI][PROMPT] System prompt built once', { chars: activeSystemPrompt.length });

        // Fresh session state
        initializeNewSession();
        sessionActive = true;

        // Start Deepgram streaming ASR
        stopAsr();
        deepgramClient = new DeepgramStreamingClient({
            apiKey: deepgramApiKey,
            language,
            // Prefer nova-2 for broad availability; can be switched to nova-3 later.
            model: 'nova-2',
            sampleRate: 24000,
            channels: 1,
        });

        deepgramClient.connect({
            onOpen: () => {
                asrStatus = 'connected';
                listening = true;
                pushAiStatus();
                log('[AI][ASR] Connected');
                sendToRenderer('update-status', 'Listening...');
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
                surfaceUiError(`ASR error: ${msg}`, 'deepgram');
                sendToRenderer('update-status', `ASR error: ${msg}`);
            },
            onClose: info => {
                // Do not auto-reconnect; keep behavior stable/deterministic.
                if (sessionActive) {
                    asrStatus = 'disconnected';
                    listening = false;
                    pushAiStatus();
                    log('[AI][ASR] Disconnected', info || {});
                    if (String(info?.code || '') === '1006') {
                        surfaceUiError('ASR disconnected. Check Deepgram key + settings (WS 1006).', 'deepgram');
                    }
                    sendToRenderer('update-status', 'ASR disconnected');
                }
            },
        });

        pushAiStatus();
        return { success: true };
    } catch (e) {
        const msg = e?.message || String(e);
        logErr('[AI][SESSION] initialize-ai failed', msg);
        surfaceUiError(`Error: ${msg}`, 'initialize-ai');
        sessionActive = false;
        return { success: false, error: msg };
    } finally {
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
    }
}

async function submitNow({ actionName = '', actionPrompt = '', uiAlreadyShown = false, textOverride = '' } = {}) {
    log('[AI][SUBMIT] submitNow() called', { actionName: String(actionName || '').trim() || '(none)' });
    if (!sessionActive) {
        surfaceUiError('ASR/LLM session not active', 'submitNow');
        return { success: false, error: 'No active session' };
    }
    if (!openaiApiKey) {
        surfaceUiError('OpenAI key missing / LLM not initialized', 'submitNow');
        return { success: false, error: 'Model not initialized' };
    }

    // Snapshot immediately: NO settle wait, NO debounce, NO minimum length.
    const overrideText = String(textOverride || '').trim();
    const snapshotText = overrideText ? overrideText : String(`${bufferFinal || ''}${bufferDraft || ''}`).trim();
    const imagesToUse = useScreenEnabled ? pendingImages : [];
    const hasImages = Array.isArray(imagesToUse) && imagesToUse.length > 0;
    log('[AI][SUBMIT] Snapshot length:', `${snapshotText.length} chars`);
    log('[AI][SUBMIT] Screenshots attached:', hasImages ? imagesToUse.length : 0);

    // Allow very short questions. If the user submits with empty transcript, only allow if screen is enabled & we have images.
    if (!snapshotText && !hasImages) {
        logErr('[AI][SUBMIT] Empty snapshot and no screenshots -> refusing to submit');
        if (asrStatus !== 'connected') {
            surfaceUiError('ASR not connected. Fix Deepgram connection first (check key), then try again.', 'submitNow');
        } else {
            surfaceUiError('No transcript captured (and no screenshots). Speak first or enable Use Screen.', 'submitNow');
        }
        return { success: false, error: 'No transcript or screen available' };
    }

    // For voice-based submits, emit a real chat user bubble with the action label.
    // The transcript is sent to the model but not displayed in the UI.
    // This matches Cluely's behavior: voice submissions show the action label, not the transcript.
    if (!overrideText && snapshotText) {
        const displayText = actionName && String(actionName).trim() ? String(actionName).trim() : 'Assist';
        emitChatUserTurn({ text: displayText, source: 'voice', actionName });
    }

    // Clear ONLY the question buffer (for transcript-triggered actions), not the display transcript.
    if (!overrideText) {
        bufferFinal = '';
        bufferDraft = '';
    }

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
        // Typed text message: send exactly as typed.
        userText = snapshotText;
    } else if (snapshotText) {
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
            ? `${prompt}\n\n${snapshotText}`
            : snapshotText;
    } else {
        // Screen-only submission (no transcript)
        userText = actionPrompt && String(actionPrompt).trim()
            ? String(actionPrompt).trim()
            : 'Analyze the screenshot and provide the best possible answer based only on what you see.';
    }

    let finalText = '';
    try {
        llmStatus = 'ready';
        pushAiStatus();
        log('[AI][LLM] Sending request to', openaiModelName);
        const t0 = Date.now();
        let firstTokenAt = 0;
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
                if (!firstTokenAt) {
                    firstTokenAt = Date.now();
                    log('[AI][LLM] First token received', { ms: firstTokenAt - t0 });
                }
                try { sendToRenderer('update-response-stream', String(delta || '')); } catch (_) {}
            },
            });

        try {
            finalText = await doCall(openaiModelName);
        } catch (e) {
            const msg = String(e?.message || e || '');
            // Fallback: if GPT-5 mini isn't available on this key/account, retry with gpt-4o-mini.
            if (
                openaiModelName !== 'gpt-4o-mini' &&
                (msg.includes('model') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('not available') || msg.includes('Invalid'))) 
            ) {
                logErr('[AI][LLM] Model failed, retrying with gpt-4o-mini', msg);
                openaiModelName = 'gpt-4o-mini';
                finalText = await doCall(openaiModelName);
            } else {
                throw e;
            }
        }
        log('[AI][LLM] Stream completed', { ms: Date.now() - t0, chars: finalText.length });
        sendToRenderer('update-response', finalText || '');
        listening = true;
        pushAiStatus();
        sendToRenderer('update-status', 'Listening...');

        try {
            saveConversationTurn(snapshotText || '(screen only)', finalText || '', { usedScreen: hasImages });
        } catch (_) {}

        lastUiError = '';
        llmStatus = 'ready';
        pushAiStatus();
        return { success: true };
    } catch (e) {
        const msg = e?.message || String(e);
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

async function startMacOSSystemAudioCapture() {
    if (process.platform !== 'darwin') {
        return { success: false, error: 'System audio capture only available on macOS' };
    }
    if (!sessionActive || !deepgramClient) {
        return { success: false, error: 'ASR not initialized' };
    }

    await killExistingSystemAudioDump();

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
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
            try { deepgramClient.sendAudio(monoChunk); } catch (_) {}
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
        if (!deepgramClient) return;
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
                deepgramClient.sendAudio(buf);
            } else if (payload && typeof payload.data === 'string') {
                // Legacy base64 path (avoid if possible)
                const buf = Buffer.from(payload.data, 'base64');
                deepgramClient.sendAudio(buf);
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
};


