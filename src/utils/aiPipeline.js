const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');

const { getSystemPrompt } = require('./prompts');
const { streamResponse, warmup } = require('./llm/openaiResponsesClient');
const { generateContent: geminiGenerateContent, generateContentStream: geminiGenerateContentStream } = require('./llm/geminiClient');
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
let geminiApiKey = '';
let geminiModelName = 'gemini-3-flash';
let geminiThinkingEnabled = true;
let llmEnsembleEnabled = true;
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
    'Assist using ONLY the current screen context (screenshot).\n' +
    '- If the screen shows a question/prompt: answer it directly.\n' +
    '- If the screen shows code: infer what is being asked (output prediction vs logic explanation vs purpose) and answer accordingly.\n' +
    '- If the screen shows UI/content: infer the user intent from visible context and help immediately.\n' +
    '- Be concise, correct, and action-oriented.\n' +
    '- Do NOT ask clarifying questions unless absolutely necessary.';

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

async function geminiCallWithFallback(args, preferredModel) {
    const tryModels = [
        String(preferredModel || '').trim(),
        'gemini-3-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
    ].filter(Boolean);

    let lastErr = null;
    for (const m of tryModels) {
        try {
            return await geminiGenerateContent({ ...args, model: m });
        } catch (e) {
            lastErr = e;
            const msg = e?.message || String(e || '');
            if (!looksLikeModelNotFound(msg)) {
                throw e;
            }
            // try next model
        }
    }
    throw lastErr || new Error('Gemini call failed');
}

async function synthesizeFinalAnswer({ questionText, openaiDraft, geminiDraft } = {}) {
    // Use Gemini Flash as the default synthesizer (fast). If Gemini not available, return OpenAI draft.
    const q = String(questionText || '').trim();
    const a = String(openaiDraft || '').trim();
    const g = String(geminiDraft || '').trim();
    if (!g && a) return a;
    if (!a && g) return g;
    if (!a && !g) return '';

    if (!geminiApiKey) return a || g;

    const prompt =
        `Combine the two drafts into ONE best final answer.\n` +
        `- Keep it concise and correct.\n` +
        `- Preserve helpful structure (short headings / bullets).\n` +
        `- Remove duplicates.\n` +
        `- Do NOT mention that there were multiple models.\n\n` +
        `Question:\n${q}\n\n` +
        `Draft A:\n${a}\n\n` +
        `Draft B:\n${g}\n\n` +
        `Final answer:`;

    try {
        const out = await geminiCallWithFallback(
            {
                apiKey: geminiApiKey,
                systemPrompt: '',
                history: [],
                userText: prompt,
                images: [],
                temperature: 0,
                maxOutputTokens: 900,
            },
            geminiModelName
        );
        return String(out || '').trim() || (a || g);
    } catch (_) {
        return a || g;
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
    // Returns: array of { role: 'user'|'assistant', text }
    return buildHistoryForModel(conversationHistoryInput, {
        includeScreenTurns,
        // Keep larger context inside the same live session.
        maxMessages: 40,
        maxChars: 12000,
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
    openaiModel = 'gpt-4.1-nano',
    geminiKey,
    geminiModel = 'gemini-3-flash',
    geminiThinking = true,
    llmEnsemble = true,
    customPrompt = '',
    profile = 'interview',
    language = 'en-US',
} = {}) {
    if (isInitializingSession) return { success: false, error: 'Session initialization in progress' };
    if (!deepgramKey || !String(deepgramKey).trim()) return { success: false, error: 'Deepgram API key missing' };
    const hasOpenAi = !!(openaiKey && String(openaiKey).trim());
    const hasGemini = !!(geminiKey && String(geminiKey).trim());
    if (!hasOpenAi && !hasGemini) return { success: false, error: 'OpenAI or Gemini API key required' };

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
        openaiApiKey = hasOpenAi ? String(openaiKey).trim() : '';
        openaiModelName = String(openaiModel || 'gpt-4.1-nano').trim() || 'gpt-4.1-nano';

        geminiApiKey = hasGemini ? String(geminiKey).trim() : '';
        geminiModelName = String(geminiModel || 'gemini-3-flash').trim() || 'gemini-3-flash';
        geminiThinkingEnabled = geminiThinking !== false;
        llmEnsembleEnabled = llmEnsemble !== false;

        log('[AI][LLM] Providers ready', {
            openai: !!openaiApiKey,
            openaiModel: openaiModelName,
            gemini: !!geminiApiKey,
            geminiModel: geminiModelName,
            thinking: geminiThinkingEnabled,
            ensemble: llmEnsembleEnabled,
        });

        // Fire-and-forget warmup to reduce first-token latency on the first real answer.
        try {
            setImmediate(() => {
                if (openaiApiKey) {
                    warmup({ apiKey: openaiApiKey, model: openaiModelName })
                        .then(ok => log('[AI][LLM] Warmup', ok ? 'ok' : 'failed'))
                        .catch(() => {});
                }
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
    if (!openaiApiKey && !geminiApiKey) {
        surfaceUiError('No LLM provider configured (OpenAI or Gemini)', 'submitNow');
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

    // For "answer now" submits (Ctrl/Cmd+Enter, Assist button, prompt buttons), emit a real chat user bubble
    // with the action label EVEN WHEN there is no transcript (screen-only).
    // This matches Cluely behavior: action submits show "Assist" in the UI while using transcript/screen as hidden context.
    if (!overrideText && (snapshotText || hasImages)) {
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

        // Kick off BOTH LLMs in parallel:
        // - Gemini: "thinking" (Cluely-style panel) + draft answer (single call, non-stream) then simulated streaming to UI.
        // - OpenAI: draft answer (streamed internally but buffered until thinking completes).

        let openaiDraft = '';
        let openaiErr = null;
        let openaiFirstTokenMs = null;
        const openaiPromise = (async () => {
            if (!openaiApiKey) return '';
            log('[AI][LLM] OpenAI request started', { model: openaiModelName });
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
                        // Stream immediately to renderer (ChatGPT/Cluely style).
                        // We still keep a buffer so we can set the final response text reliably.
                        buf += d;
                        if (openaiFirstTokenMs === null) {
                            openaiFirstTokenMs = Date.now() - t0;
                            log('[AI][LLM] OpenAI first token', { ms: openaiFirstTokenMs });
                        }
                        try { sendToRenderer('update-response-stream', d); } catch (_) {}
                    },
                });

            try {
                buf = await doCall(openaiModelName);
                return String(buf || '').trim();
            } catch (e) {
                const msg = String(e?.message || e || '');
                // Fallback: if GPT-5 mini isn't available on this key/account, retry with gpt-4o-mini.
                if (
                    openaiModelName !== 'gpt-4o-mini' &&
                    (msg.toLowerCase().includes('model') && (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('not available') || msg.toLowerCase().includes('invalid')))
                ) {
                    logErr('[AI][LLM] OpenAI model failed, retrying with gpt-4o-mini', msg);
                    openaiModelName = 'gpt-4o-mini';
                    buf = await doCall(openaiModelName);
                    return String(buf || '').trim();
                }
                throw e;
            }
        })().then(t => (openaiDraft = t)).catch(e => (openaiErr = e));

        let geminiThinkingText = '';
        let geminiDraft = '';
        const THINKING_BUDGET_MS = 900; // keep "thinking" short so answers feel fast
        const THINKING_MAX_CHARS = 650; // avoid long thinking blocks (UI + latency)
        const ENSEMBLE_BUDGET_MS = 900; // do not wait too long for 2nd model when synthesizing

        // Gemini thinking is a separate lightweight call so it returns quickly.
        let geminiThinkingErr = null;
        const geminiThinkingPromise = (async () => {
            if (!geminiApiKey || !geminiThinkingEnabled) return '';
            const thinkingInstruction =
                `Write a VERY SHORT "thinking" note (max 60 words).\n` +
                `Format EXACTLY:\n` +
                `Question: ...\n` +
                `Main Point: ...\n` +
                `Supporting Explanation: ...\n` +
                `No answer. No extra sections.`;

            log('[AI][LLM] Gemini thinking started', { model: geminiModelName });
            const raw = await geminiCallWithFallback(
                {
                    apiKey: geminiApiKey,
                    systemPrompt: activeSystemPrompt,
                    history,
                    userText: `${thinkingInstruction}\n\nUser prompt:\n${userText}`,
                    images: hasImages ? imagesToUse : [],
                    temperature: 0,
                    maxOutputTokens: 140,
                },
                geminiModelName
            );
            return String(raw || '').trim();
        })()
            .then(t => (geminiThinkingText = String(t || '').trim()))
            .catch(e => (geminiThinkingErr = e));

        // Gemini answer draft is only needed for:
        // - fallback (when OpenAI key is missing or OpenAI fails)
        // - ensemble (combine both drafts)
        let geminiAnswerErr = null;
        const needGeminiAnswer = !!geminiApiKey && (!openaiApiKey || llmEnsembleEnabled);
        const geminiAnswerPromise = needGeminiAnswer
            ? (async () => {
                  log('[AI][LLM] Gemini answer started', { model: geminiModelName, ensemble: llmEnsembleEnabled });

                  // If OpenAI is NOT configured, stream Gemini answer tokens to UI (fast, ChatGPT-like).
                  // If OpenAI is configured, Gemini is used only as a draft/ensemble input, so no UI streaming.
                  const shouldStreamGeminiToUi = !openaiApiKey;
                  const raw = shouldStreamGeminiToUi
                      ? await geminiGenerateContentStream({
                            apiKey: geminiApiKey,
                            model: geminiModelName,
                            systemPrompt: activeSystemPrompt,
                            history,
                            userText,
                            images: hasImages ? imagesToUse : [],
                            temperature: 0,
                            maxOutputTokens: 900,
                            onDelta: d => {
                                const s = String(d || '');
                                if (!s) return;
                                try { sendToRenderer('update-response-stream', s); } catch (_) {}
                            },
                        })
                      : await geminiCallWithFallback(
                            {
                                apiKey: geminiApiKey,
                                systemPrompt: activeSystemPrompt,
                                history,
                                userText,
                                images: hasImages ? imagesToUse : [],
                                temperature: 0,
                                maxOutputTokens: 900,
                            },
                            geminiModelName
                        );
                  return String(raw || '').trim();
              })()
                  .then(t => (geminiDraft = String(t || '').trim()))
                  .catch(e => (geminiAnswerErr = e))
            : Promise.resolve();

        // Thinking panel: show immediately, then finalize once Gemini returns (OpenAI continues in parallel).
        if (geminiThinkingEnabled && geminiApiKey) {
            try {
                // Start thinking stream (simulate)
                try { sendToRenderer('update-thinking-stream', ''); } catch (_) {}
                await simulateStreamToRenderer('update-thinking-stream', 'Thinking...\n', { chunkSize: 10, delayMs: 18 });

                // Wait a bit for Gemini; do not block indefinitely.
                await Promise.race([geminiThinkingPromise, sleep(THINKING_BUDGET_MS)]);

                if (geminiThinkingText) {
                    // Stream the thinking text (then set final to replace any placeholder text in UI state).
                    const clipped = geminiThinkingText.length > THINKING_MAX_CHARS
                        ? `${geminiThinkingText.slice(0, THINKING_MAX_CHARS)}…`
                        : geminiThinkingText;
                    await simulateStreamToRenderer('update-thinking-stream', clipped, { chunkSize: 24, delayMs: 8 });
                    try { sendToRenderer('update-thinking-final', clipped); } catch (_) {}
                } else {
                    const fallbackThinking = geminiThinkingErr ? 'Thinking unavailable (Gemini error).' : 'Done.';
                    await simulateStreamToRenderer('update-thinking-stream', fallbackThinking, { chunkSize: 24, delayMs: 10 });
                    try { sendToRenderer('update-thinking-final', fallbackThinking); } catch (_) {}
                }
            } catch (_) {}
        }

        // Resolve answer drafts with speed-bounded waits.
        // Always wait for OpenAI if configured; Gemini answer waits only if needed.
        await Promise.allSettled([openaiPromise]);
        if (!openaiDraft && needGeminiAnswer) {
            await Promise.allSettled([geminiAnswerPromise]);
        } else if (llmEnsembleEnabled && openaiDraft && needGeminiAnswer) {
            // Try to get Gemini draft, but don't wait too long.
            await Promise.race([geminiAnswerPromise, sleep(ENSEMBLE_BUDGET_MS)]);
        }

        if (openaiErr) logErr('[AI][LLM] OpenAI failed', openaiErr?.message || String(openaiErr));
        if (geminiThinkingErr) logErr('[AI][LLM] Gemini thinking failed', geminiThinkingErr?.message || String(geminiThinkingErr));
        if (geminiAnswerErr) logErr('[AI][LLM] Gemini answer failed', geminiAnswerErr?.message || String(geminiAnswerErr));

        // Pick final answer (IMPORTANT):
        // We may use multiple models internally, but the user should see ONLY ONE answer.
        // If OpenAI is configured, it is the single streamed output; do NOT replace it later
        // with a synthesized/second answer (that causes flicker / "double response" perception).
        //
        // If OpenAI is not configured, Gemini is streamed and becomes the single final answer.
        finalText = openaiDraft || geminiDraft || '';

        log('[AI][LLM] Completed', {
            ms: Date.now() - t0,
            openai: !!openaiDraft,
            gemini: !!geminiDraft,
            chars: (finalText || '').length,
        });

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
    geminiApiKey = '';
    geminiModelName = 'gemini-3-flash';
    geminiThinkingEnabled = true;
    llmEnsembleEnabled = true;
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
            geminiKey: p.geminiApiKey,
            geminiModel: p.geminiModel,
            geminiThinking: p.geminiThinking,
            llmEnsemble: p.llmEnsemble,
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


