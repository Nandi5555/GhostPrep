const { GoogleGenAI } = require('@google/genai');
const { BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const { ModelAdapter } = require('./modelAdapter');
const { submitBufferedTranscript, buildHistoryForModel } = require('./transcriptionFlow');

// Conversation tracking variables
 let currentSessionId = null;
 let currentTranscription = '';
 let conversationHistory = [];
 let isInitializingSession = false;

// Audio capture variables
 let systemAudioProc = null;
 // Buffered image context (captured during a session, submitted only on explicit user action)
 let pendingImages = [];
 const MAX_PENDING_IMAGES = 3;
 // Hard gate controlled by the UI toggle. When OFF, screenshots must not be buffered or used.
 let useScreenEnabled = false;

 // Adapter for on-demand model calls (guarded & model-agnostic)
 let modelAdapter = null;
 let activeSystemPrompt = '';

// Reconnection tracking variables
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 3;
let reconnectionDelay = 2000; // 2 seconds between attempts
let lastSessionParams = null;

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
    if (!useScreenEnabled) {
        clearPendingImages();
    }
}

// Conversation management functions
function initializeNewSession() {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    console.log('New conversation session started:', currentSessionId);
}

function saveConversationTurn(transcription, aiResponse, meta = {}) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
        usedScreen: !!meta.usedScreen,
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

async function sendReconnectionContext() {
    if (!global.geminiSessionRef?.current || conversationHistory.length === 0) {
        return;
    }

    try {
        // Gather all transcriptions from the conversation history
        const transcriptions = conversationHistory
            .map(turn => turn.transcription)
            .filter(transcription => transcription && transcription.trim().length > 0);

        if (transcriptions.length === 0) {
            return;
        }

        // Create the context message
        const contextMessage = `Till now all these questions were asked in the interview, answer the last one please:\n\n${transcriptions.join('\n')}`;

        console.log('Sending reconnection context with', transcriptions.length, 'previous questions');

        // Send the context message to the new session
        await global.geminiSessionRef.current.sendRealtimeInput({
            text: contextMessage,
        });
    } catch (error) {
        console.error('Error sending reconnection context:', error);
    }
}

async function getEnabledTools() {
    const tools = [];

    // Check if Google Search is enabled (default: true)
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'false');
    console.log('Google Search enabled:', googleSearchEnabled);

    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
        console.log('Added Google Search tool');
    } else {
        console.log('Google Search tool disabled');
    }

    return tools;
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready
            await new Promise(resolve => setTimeout(resolve, 20));

            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

async function attemptReconnection() {
    if (!lastSessionParams || reconnectionAttempts >= maxReconnectionAttempts) {
        console.log('Max reconnection attempts reached or no session params stored');
        sendToRenderer('update-status', 'Session closed');
        return false;
    }

    // Safety check: ensure lastSessionParams has required properties
    if (!lastSessionParams.apiKey) {
        console.log('No API key in session params - stopping reconnection');
        sendToRenderer('update-status', 'Session closed');
        return false;
    }

    reconnectionAttempts++;
    console.log(`Attempting reconnection ${reconnectionAttempts}/${maxReconnectionAttempts}...`);

    // Wait before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, reconnectionDelay));

    // Double-check lastSessionParams is still valid after delay
    if (!lastSessionParams || !lastSessionParams.apiKey) {
        console.log('Session params cleared during reconnection delay - stopping');
        sendToRenderer('update-status', 'Session closed');
        return false;
    }

    try {
        const session = await initializeGeminiSession(
            lastSessionParams.apiKey,
            lastSessionParams.customPrompt,
            lastSessionParams.profile,
            lastSessionParams.language,
            true // isReconnection flag
        );

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;
            reconnectionAttempts = 0; // Reset counter on successful reconnection
            console.log('Live session reconnected');

            // Send context message with previous transcriptions
            await sendReconnectionContext();

            return true;
        }
    } catch (error) {
        console.error(`Reconnection attempt ${reconnectionAttempts} failed:`, error);
    }

    // If this attempt failed, try again
    if (reconnectionAttempts < maxReconnectionAttempts) {
        return attemptReconnection();
    } else {
        console.log('All reconnection attempts failed');
        sendToRenderer('update-status', 'Session closed');
        return false;
    }
}

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    // Manual transcription is the only mode. UI/logic never relies on model-specific auto behaviors.

    // Store session parameters for reconnection (only if not already reconnecting)
    if (!isReconnection) {
        lastSessionParams = {
            apiKey,
            customPrompt,
            profile,
            language,
        };
        reconnectionAttempts = 0; // Reset counter for new session
    }

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
    });

    // Get enabled tools first to determine Google Search status
    const enabledTools = await getEnabledTools();
    const googleSearchEnabled = enabledTools.some(tool => tool.googleSearch);

    const systemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled);
    activeSystemPrompt = systemPrompt;
    try {
        modelAdapter = new ModelAdapter({ apiKey });
    } catch (e) {
        modelAdapter = null;
        console.error('Failed to initialize ModelAdapter:', e?.message || e);
    }

    // Initialize new conversation session (only if not reconnecting)
    if (!isReconnection) {
        initializeNewSession();
    }

    try {
        let opened = false;
        let resolveReady;
        const readyPromise = new Promise(resolve => {
            resolveReady = resolve;
        });

        const transcriptionOnlyInstruction =
            'You are a transcription engine. Output only speech-to-text transcription and nothing else. ' +
            'Do not answer questions, do not provide advice, and do not generate any assistant replies.';

        // Prefer a configuration that does NOT generate model responses during live audio.
        // If the API rejects empty responseModalities, we fall back to TEXT but still ignore modelTurn.
        let session = null;
        try {
            session = await client.live.connect({
                model: 'gemini-2.0-flash-exp',
                callbacks: {
                onopen: function () {
                    opened = true;
                    sendToRenderer('update-status', 'Live session connected');
                    try { resolveReady({ ok: true }); } catch (_) {}
                },
                onmessage: function (message) {
                    console.log('----------------', message);

                    if (message.serverContent?.inputTranscription?.text) {
                        const t = message.serverContent.inputTranscription.text;
                        currentTranscription += t;
                        try { sendToRenderer('update-transcript-stream', t); } catch (_) {}
                    }

                    if (message.serverContent?.turnComplete) {
                        sendToRenderer('update-status', 'Listening...');
                        try { sendToRenderer('transcript-turn-complete'); } catch (_) {}
                    }
                },
                onerror: function (e) {
                    console.debug('Error:', e.message);

                    // Check if the error is related to invalid API key
                    const isApiKeyError =
                        e.message &&
                        (e.message.includes('API key not valid') ||
                            e.message.includes('invalid API key') ||
                            e.message.includes('authentication failed') ||
                            e.message.includes('unauthorized'));
                    
                    if (isApiKeyError) {
                        console.log('Error due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Error: Invalid API key');
                        try { resolveReady({ ok: false, reason: 'invalid_key' }); } catch (_) {}
                        return;
                    }

                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.debug('Session closed:', e.reason);

                    // Check if the session closed due to invalid API key
                    const isApiKeyError =
                        e.reason &&
                        (e.reason.includes('API key not valid') ||
                            e.reason.includes('invalid API key') ||
                            e.reason.includes('authentication failed') ||
                            e.reason.includes('unauthorized'));

                    if (isApiKeyError) {
                        console.log('Session closed due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Session closed: Invalid API key');
                        // If we never opened, treat as failed initialization
                        if (!opened) {
                            try { resolveReady({ ok: false, reason: 'invalid_key' }); } catch (_) {}
                        }
                        return;
                    }

                 

                    // Attempt automatic reconnection for server-side closures
                    if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
                        console.log('Attempting automatic reconnection...');
                        attemptReconnection();
                    } else {
                        sendToRenderer('update-status', 'Session closed');
                    }
                },
            },
            config: {
                    responseModalities: [],
                    tools: [], // tools not needed for transcription-only live stream
                    inputAudioTranscription: {},
                    contextWindowCompression: { slidingWindow: {} },
                    speechConfig: { languageCode: language },
                    systemInstruction: { parts: [{ text: transcriptionOnlyInstruction }] },
                },
            });
        } catch (e) {
            // Fallback: some server configs may require response modalities
            session = await client.live.connect({
                model: 'gemini-2.0-flash-exp',
                callbacks: {
                    onopen: function () {
                        opened = true;
                        sendToRenderer('update-status', 'Live session connected');
                        try { resolveReady({ ok: true }); } catch (_) {}
                    },
                    onmessage: function (message) {
                        console.log('----------------', message);
                        if (message.serverContent?.inputTranscription?.text) {
                            const t = message.serverContent.inputTranscription.text;
                            currentTranscription += t;
                            try { sendToRenderer('update-transcript-stream', t); } catch (_) {}
                        }
                        if (message.serverContent?.turnComplete) {
                            sendToRenderer('update-status', 'Listening...');
                            try { sendToRenderer('transcript-turn-complete'); } catch (_) {}
                        }
                    },
                    onerror: function (err) {
                        console.debug('Error:', err.message);
                        sendToRenderer('update-status', 'Error: ' + err.message);
                    },
                    onclose: function (evt) {
                        console.debug('Session closed:', evt.reason);
                        if (lastSessionParams && reconnectionAttempts < maxReconnectionAttempts) {
                            console.log('Attempting automatic reconnection...');
                            attemptReconnection();
                        } else {
                            sendToRenderer('update-status', 'Session closed');
                        }
                    },
                },
                config: {
                    responseModalities: ['TEXT'],
                    tools: [],
                    inputAudioTranscription: {},
                    contextWindowCompression: { slidingWindow: {} },
                    speechConfig: { languageCode: language },
                    systemInstruction: { parts: [{ text: transcriptionOnlyInstruction }] },
                },
            });
        }
        // Wait for handshake success or invalid-key failure, with timeout
        const result = await Promise.race([
            readyPromise,
            new Promise(resolve => setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 5000)),
        ]);

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);

        if (result && result.ok) {
            return session;
        }
        return null;
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return null;
    }
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    systemAudioProc = spawn(systemAudioPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (!systemAudioProc.pid) {
        console.error('Failed to start SystemAudioDump');
        return false;
    }

    console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 0.025;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            const base64Data = monoChunk.toString('base64');
            sendAudioToGemini(base64Data, geminiSessionRef);

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
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

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}
// This will send audio to Gemini in real-time
async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // UI-controlled screen visibility gate
    ipcMain.handle('set-use-screen-enabled', async (_event, enabled) => {
        try {
            setUseScreenEnabled(!!enabled);
            return { success: true, enabled: useScreenEnabled };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });
    // UI responsiveness: allow renderer to request immediate action-bubble display.
    // This does NOT change backend/model behavior; it only updates the chat UI instantly.
    ipcMain.on('ui-action-triggered', (_event, payload) => {
        try {
            const label = (payload && (payload.label || payload.text)) ? String(payload.label || payload.text).trim() : '';
            if (!label) return;
            sendToRenderer('transcription-submitted', { text: label, actionName: label });
        } catch (_) {}
    });
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        const session = await initializeGeminiSession(apiKey, customPrompt, profile, language);
        if (session) {
            process.stdout.write('\x1b[36minitialize-gemini\x1b[0m');
            geminiSessionRef.current = session;
            return true;
        }
        return false;
    });
    // Audio send queue to prevent overlapping sends and reduce IPC backpressure
    let audioSendQueue = [];
    let audioSending = false;
    const AUDIO_QUEUE_MAX = 50;

    async function flushAudioQueue() {
        if (audioSending) return;
        audioSending = true;
        try {
            while (audioSendQueue.length > 0 && geminiSessionRef.current) {
                const next = audioSendQueue.shift();
                await geminiSessionRef.current.sendRealtimeInput({ audio: next });
            }
        } catch (error) {
            console.error('Error sending queued audio:', error);
        } finally {
            audioSending = false;
        }
    }

    ipcMain.on('audio-chunk', (event, payload) => {
        if (!geminiSessionRef.current) return;
        try {
            process.stdout.write('.')
            let audioPart;
            if (payload && typeof payload.data === 'string') {
                audioPart = { data: payload.data, mimeType: payload.mimeType };
            } else if (payload && payload.raw) {
                const buf = Buffer.isBuffer(payload.raw) ? payload.raw : Buffer.from(payload.raw);
                const base64 = buf.toString('base64');
                audioPart = { data: base64, mimeType: payload.mimeType };
            } else {
                return;
            }

            audioSendQueue.push(audioPart);
            if (audioSendQueue.length > AUDIO_QUEUE_MAX) {
                audioSendQueue.splice(0, audioSendQueue.length - AUDIO_QUEUE_MAX);
            }
            setImmediate(flushAudioQueue);
        } catch (error) {
            console.error('Error queuing audio:', error);
        }
    });
    ipcMain.on('speech-start', () => {
        try { sendToRenderer('update-status', 'Transcribing...'); } catch (_) {}
    });
    

    ipcMain.handle('send-image-content', async (event, { data, debug }) => {
        try {
            process.stdout.write('?');
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            // Buffer images only if screen viewing is enabled.
            if (!useScreenEnabled) {
                // Ignore silently so renderer capture doesn't error; this prevents stale screen reuse.
                return { success: true, ignored: true };
            }

            pendingImages.push({ data, mimeType: 'image/jpeg' });
            if (pendingImages.length > MAX_PENDING_IMAGES) {
                pendingImages.splice(0, pendingImages.length - MAX_PENDING_IMAGES);
            }

            return { success: true };
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-current-transcription', async (event, payload) => {
        if (!modelAdapter) return { success: false, error: 'Model not initialized' };
        try {
            // Try to use whatever we have; if empty, wait briefly for interim transcription
            process.stdout.write('!');
            let text = (currentTranscription || '').trim();
            if (!text) {
                const deadline = Date.now() + 100;
                while (!text && Date.now() < deadline) {
                    await new Promise(resolve => setTimeout(resolve, 25));
                    text = (currentTranscription || '').trim();
                }
            }

            const actionName = (payload && payload.actionName) ? String(payload.actionName).trim() : '';
            const actionPrompt = (payload && payload.actionPrompt) ? String(payload.actionPrompt).trim() : '';

            // Clear the buffer immediately (we only submit what was present at the time of user action)
            currentTranscription = '';

            sendToRenderer('update-status', 'Submitting...');

            // Screen-only support: if no transcript but we have buffered screenshots, still submit.
            const imagesToUse = useScreenEnabled ? pendingImages : [];
            const hasImages = Array.isArray(imagesToUse) && imagesToUse.length > 0;
            const hasText = !!text;

            if (!hasText && !hasImages) {
                return { success: false, error: 'No transcription or screen available' };
            }

            let questionText = '';
            let responseText = '';
            let rawTranscript = '';
            const includeScreenTurns = !!useScreenEnabled;
            const screenOffGuard = useScreenEnabled
                ? ''
                : 'Screen viewing is OFF. Do not use or rely on any previously described screen content. If the question requires screen details, respond that you cannot see the screen because Use Screen is OFF.';

            if (hasText) {
                const combinedActionPrompt = screenOffGuard
                    ? (actionPrompt ? `${actionPrompt}\n\n${screenOffGuard}` : screenOffGuard)
                    : actionPrompt;
                const result = await submitBufferedTranscript({
                    transcript: text,
                    actionName,
                    actionPrompt: combinedActionPrompt,
                    systemInstruction: activeSystemPrompt,
                    conversationHistory,
                    images: imagesToUse,
                    modelAdapter,
                });
                questionText = result.questionText;
                responseText = result.responseText || '';
                rawTranscript = result.rawTranscript || text;
            } else {
                // Screen-only: ask the model to analyze the screenshot. Do not require transcript.
                questionText = actionName ? `[${actionName}] (screen)` : '(screen)';
                rawTranscript = '(screen only)';
                const userText = actionPrompt && actionPrompt.length
                    ? actionPrompt
                    : 'Analyze the screenshot and provide the best possible answer based only on what you see.';

                const history = buildHistoryForModel(conversationHistory, { includeScreenTurns });
                responseText = await modelAdapter.generateText({
                    systemInstruction: activeSystemPrompt,
                    userText,
                    history,
                    images: imagesToUse,
                });
            }

            // If the UI already displayed the action label (ui-action-triggered), avoid duplicating.
            if (!(payload && payload.uiAlreadyShown)) {
                const displayText = actionName || 'Assist';
                try { sendToRenderer('transcription-submitted', { text: displayText, actionName: displayText }); } catch (_) {}
            }

            clearPendingImages();
            sendToRenderer('update-response', responseText || '');
            sendToRenderer('update-status', 'Listening...');

            // Save conversation turn
            try {
                saveConversationTurn(rawTranscript, responseText || '', { usedScreen: hasImages });
            } catch (_) {}
            return { success: true };
        } catch (error) {
            console.error('Error sending current transcription:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!modelAdapter) return { success: false, error: 'Model not initialized' };

        try {
            process.stdout.write('>');
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            sendToRenderer('update-status', 'Submitting...');
            const includeScreenTurns = !!useScreenEnabled;
            const history = buildHistoryForModel(conversationHistory, { includeScreenTurns });
            const imagesToUse = useScreenEnabled ? pendingImages : [];
            const screenOffGuard = useScreenEnabled
                ? ''
                : 'Screen viewing is OFF. Do not use or rely on any previously described screen content. If the question requires screen details, respond that you cannot see the screen because Use Screen is OFF.';
            const userText = screenOffGuard ? `${screenOffGuard}\n\n${text.trim()}` : text.trim();

            const responseText = await modelAdapter.generateText({
                systemInstruction: activeSystemPrompt,
                userText,
                history,
                images: imagesToUse,
            });

            clearPendingImages();
            sendToRenderer('update-response', responseText || '');
            sendToRenderer('update-status', 'Listening...');
            try {
                saveConversationTurn(text.trim(), responseText || '', { usedScreen: Array.isArray(imagesToUse) && imagesToUse.length > 0 });
            } catch (_) {}
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            process.stdout.write('x');
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            process.stdout.write('sa');
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            process.stdout.write('cs');
            stopMacOSAudioCapture();
            clearPendingImages();
            currentTranscription = '';

            // Clear session params to prevent reconnection when user closes session
            lastSessionParams = null;

            // Cleanup any pending resources and stop audio/video capture
            if (geminiSessionRef.current) {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }
            modelAdapter = null;
            activeSystemPrompt = '';

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            process.stdout.write('gcs');
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            process.stdout.write('sns');
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });

}

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    getStoredSetting,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    sendReconnectionContext,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    setupGeminiIpcHandlers,
    attemptReconnection,
};
