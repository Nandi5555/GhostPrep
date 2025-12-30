// renderer.js
const { ipcRenderer } = require('electron');

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
  let audioBuffer = [];
  const SAMPLE_RATE = 24000;
  // Smaller chunks reduce end-to-end latency for very short questions (more IPC overhead, but still light).
  const AUDIO_CHUNK_DURATION = 0.02;
  const BUFFER_SIZE = 256;
  // Cluely-style: never pause/hold audio around submits; ASR should run continuously.
  // Simple VAD config for auto end-of-speech detection
  // Lower default silence improves "speak then immediately Ctrl+Enter" responsiveness.
  // If this feels too aggressive in noisy rooms, increase via localStorage: vadSilenceMs.
  let vadSilenceMsToTrigger = parseInt(localStorage.getItem('vadSilenceMs') || '350', 10);
  let vadAmplitudeThreshold = parseFloat(localStorage.getItem('vadThreshold') || '0.02');
  let vadCooldownMs = parseInt(localStorage.getItem('vadCooldownMs') || '2000', 10);
  let vadLastTriggerAt = 0;

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'medium'; // Store current image quality for manual screenshots
let pendingScreenshotPreviewDataUrl = null; // attach to the next chat-user-turn (Assist/voice submit)

// Transcription mode:
// - manual: buffer transcription continuously, generate answers only on explicit user action
// - auto: allow automatic answering after detected turns (main process controls this)

let audioHealthInterval = null;
let lastAudioProcessTs = 0;
let audioModeCurrent = 'speaker';
let vadSpeaking = false;
let vadLastVoiceAt = 0;
let vadLastEndAt = 0;

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

// Token tracking system for rate limiting
let tokenTracker = {
    tokens: [], // Array of {timestamp, count, type} objects
    audioStartTime: null,

    // Add tokens to the tracker
    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        // Clean old tokens (older than 1 minute)
        this.cleanOldTokens();
    },

    // Calculate image tokens (used only for local throttling of screenshot capture)
    calculateImageTokens(width, height) {
        // Images ≤384px in both dimensions = 258 tokens
        if (width <= 384 && height <= 384) {
            return 258;
        }

        // Larger images are tiled into 768x768 chunks, each = 258 tokens
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;

        return totalTiles * 258;
    },

    // Track audio tokens continuously
    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        // Audio = 32 tokens per second
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    // Clean tokens older than 1 minute
    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    // Get total tokens in the last minute
    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    // Check if we should throttle based on settings
    shouldThrottle() {
        // Get rate limiting settings from localStorage
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);
        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

function cheddarElement() {
    return document.getElementById('cheddar');
}

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

// Renderer-side base64 conversion removed to reduce main-thread CPU; raw PCM sent to main.

async function initializeAi(profile = 'interview', language = 'en-US') {
    const deepgramApiKey = localStorage.getItem('deepgramApiKey')?.trim();
    const openaiApiKey = localStorage.getItem('openaiApiKey')?.trim();
    const openaiModel = (localStorage.getItem('openaiModel') || 'gpt-4o-mini').trim();

    const allowedOpenAiModels = ['gpt-4o-mini'];
    const normalizedOpenaiModel = allowedOpenAiModels.includes(openaiModel) ? openaiModel : 'gpt-4o-mini';

    if (deepgramApiKey && openaiApiKey) {
        // Determine active custom prompt content from the prompt library.
        // Fallback to legacy single customPrompt if no library/active prompt is set.
        let activeCustomPrompt = '';
        try {
            const raw = localStorage.getItem('customPrompts');
            const prompts = raw ? JSON.parse(raw) : [];
            const activeId = localStorage.getItem('activePromptId');
            if (Array.isArray(prompts) && prompts.length > 0 && activeId) {
                const active = prompts.find(p => p.id === activeId);
                activeCustomPrompt = active?.content || '';
            } else {
                activeCustomPrompt = localStorage.getItem('customPrompt') || '';
            }
        } catch (_) {
            activeCustomPrompt = localStorage.getItem('customPrompt') || '';
        }

        const result = await ipcRenderer.invoke('initialize-ai', {
            deepgramApiKey,
            openaiApiKey,
            openaiModel: normalizedOpenaiModel,
            customPrompt: activeCustomPrompt,
            profile,
            language,
        });
        if (result && result.success) {
            cheddar.e().setStatus('Live');
            try { window.__aiReady = true; } catch (_) {}
            return true;
        } else {
            cheddar.e().setStatus((result && result.error) ? String(result.error) : 'error');
            try { window.__aiReady = false; } catch (_) {}
            return false;
        }
    }
    try { window.__aiReady = false; } catch (_) {}
    return false;
}

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    cheddar.e().setStatus(status);
});

// Listen for responses - handled in GhostPrepApp.js to avoid duplicates

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    if (!window.__aiReady) {
        return;
    }
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();

    try {
        // Ensure this window is excluded from the capture stream used for AI screenshots.
        // Critical: must be set BEFORE getDisplayMedia so the stream never contains our UI.
        try { await ipcRenderer.invoke('set-ai-capture-exclusion', true); } catch (_) {}

        const audioMode = (localStorage.getItem('selectedAudioMode') || 'speaker').toLowerCase();
        audioModeCurrent = audioMode;
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            if (audioMode === 'speaker') {
                // Start macOS system audio capture
                const audioResult = await ipcRenderer.invoke('start-macos-system-audio');
                if (!audioResult.success) {
                    throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
                }
            }

            // Get screen capture for screenshots
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use browser audio on macOS
            });

            // macOS screen capture started - audio handled by SystemAudioDump or mic

            // If mic mode, capture microphone and process
            if (audioMode === 'mic') {
                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on macOS:', micError);
                }
            }
        } else if (isLinux) {
            // Linux - use display media for screen capture and getUserMedia for microphone
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use system audio loopback on Linux
            });

            if (audioMode === 'mic') {
                // Get microphone input for Linux
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    // Linux microphone capture started

                    // Setup audio processing for microphone on Linux
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                    // Continue without microphone if permission denied
                }
            } else {
                // Speaker-only mode on Linux is not reliably supported; skip audio to avoid mic input
                console.info('Audio Mode: speaker-only selected on Linux; skipping mic capture.');
            }

            // Linux screen capture started
        } else {
            // Windows - use display media with loopback for system audio
            if (audioMode === 'speaker') {
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

                // Windows capture started with loopback audio

                // Setup audio processing for Windows loopback audio only
                setupWindowsLoopbackProcessing();
            } else {
                // Mic-only: capture screen without audio, then get microphone stream
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });

                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Windows:', micError);
                }
            }
        }

        // MediaStream obtained

        // IMPORTANT: keep the old capture pipeline (display media stream),
        // but do NOT do interval-based screenshots anymore.
        // We will capture only at the moment the user submits a question.
        const useScreen = localStorage.getItem('assistantUseScreen') === 'true';
        try { await ipcRenderer.invoke('set-use-screen-enabled', useScreen); } catch (_) {}
    } catch (err) {
        console.error('Error starting capture:', err);
        cheddar.e().setStatus('error');
        // If capture did not start, revert capture-only exclusion.
        try { await ipcRenderer.invoke('set-ai-capture-exclusion', false); } catch (_) {}
    }

    try {
        startAudioHealthMonitor();
    } catch (_) {}
}

async function startScreenCaptureScheduling(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Deprecated: interval scheduling removed. Keep as no-op for backward compatibility.
    return;
}

// Expose renderer utilities to app shell
try {
    window.cheddar = window.cheddar || {};
    window.cheddar.initializeAi = initializeAi;
    window.cheddar.startCapture = startCapture;
} catch (_) {}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        lastAudioProcessTs = Date.now();
        const inputData = e.inputBuffer.getChannelData(0);

        // Voice activity detection (Linux mic) - used for UI indicators and to signal end-of-speech;
        // never auto-submits to the model.
        try {
            // Compute RMS amplitude (stride 4 for lower CPU)
            let sum = 0;
            for (let i = 0; i < inputData.length; i += 4) {
                const v = inputData[i];
                sum += v * v;
            }
            const rms = Math.sqrt(sum / (inputData.length / 4));
            const now = Date.now();
            if (rms >= vadAmplitudeThreshold) {
                vadLastVoiceAt = now;
                if (!vadSpeaking && (now - (vadLastEndAt || 0)) >= vadCooldownMs) {
                    vadSpeaking = true;
                    try { ipcRenderer.send('speech-start'); } catch (_) {}
                }
            } else {
                if (vadSpeaking && vadLastVoiceAt && (now - vadLastVoiceAt) >= vadSilenceMsToTrigger) {
                    vadSpeaking = false;
                    vadLastEndAt = now;
                    try { ipcRenderer.send('speech-end'); } catch (_) {}
                }
            }
        } catch (_) {}

        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const raw = new Uint8Array(pcmData16.buffer);

            try {
                ipcRenderer.send('audio-chunk', {
                    raw,
                    mimeType: 'audio/pcm;rate=24000',
                });
            } catch (_) {}
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    audioProcessor = micProcessor;
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        lastAudioProcessTs = Date.now();
        const inputData = e.inputBuffer.getChannelData(0);

        // Voice activity detection (Windows loopback) - used for UI indicators and to signal end-of-speech;
        // never auto-submits to the model.
        try {
            // Compute RMS amplitude (stride 4 for lower CPU)
            let sum = 0;
            for (let i = 0; i < inputData.length; i += 4) {
                const v = inputData[i];
                sum += v * v;
            }
            const rms = Math.sqrt(sum / (inputData.length / 4));
            const now = Date.now();
            if (rms >= vadAmplitudeThreshold) {
                vadLastVoiceAt = now;
                if (!vadSpeaking && (now - (vadLastEndAt || 0)) >= vadCooldownMs) {
                    vadSpeaking = true;
                    try { ipcRenderer.send('speech-start'); } catch (_) {}
                }
            } else {
                if (vadSpeaking && vadLastVoiceAt && (now - vadLastVoiceAt) >= vadSilenceMsToTrigger) {
                    vadSpeaking = false;
                    vadLastEndAt = now;
                    try { ipcRenderer.send('speech-end'); } catch (_) {}
                }
            }
        } catch (_) {}

        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const raw = new Uint8Array(pcmData16.buffer);

            try {
                ipcRenderer.send('audio-chunk', {
                    raw,
                    mimeType: 'audio/pcm;rate=24000',
                });
            } catch (_) {}
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

function startAudioHealthMonitor() {
    if (audioHealthInterval) {
        try { clearInterval(audioHealthInterval); } catch (_) {}
    }
    audioHealthInterval = setInterval(() => {
        try {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
            if (lastAudioProcessTs && Date.now() - lastAudioProcessTs > 800) {
                if (audioContext) {
                    audioContext.resume().catch(() => {});
                }
                if (!isLinux && mediaStream) {
                    setupWindowsLoopbackProcessing();
                }
            }
        } catch (_) {}
    }, 1000);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    try {
        console.log('[AI][RENDERER] Screenshot capture start', { quality: imageQuality, isManual });
    } catch (_) {}
    if (!mediaStream) return { success: false, error: 'No media stream' };

    // Check rate limiting for automated screenshots only
    if (!isManual && tokenTracker.shouldThrottle()) {
        return { success: false, error: 'Throttled' };
    }

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        // Lazy init of canvas based on video dimensions
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = hiddenVideo.videoWidth;
        offscreenCanvas.height = hiddenVideo.videoHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        return { success: false, error: 'Video not ready' };
    }

    // Avoid flicker: do NOT hide/opacity-toggle the app window here.
    // The window should already be excluded from the stream via set-ai-capture-exclusion(true).
    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Redact this app window from the screenshot so our overlay UI is never sent to the LLM.
    // This avoids needing OS-level content protection (which on macOS would hide the app from meetings/screen share).
    try {
        const bounds = await ipcRenderer.invoke('get-window-bounds');
        const display = await ipcRenderer.invoke('get-window-display-metrics');
        if (bounds && display && display.bounds && (display.scaleFactor || display.scaleFactor === 0)) {
            const scaleFactor = Number(display.scaleFactor) || 1;
            const videoW = offscreenCanvas.width;
            const videoH = offscreenCanvas.height;

            const candW1 = display.size && display.size.width ? Number(display.size.width) : NaN;
            const candH1 = display.size && display.size.height ? Number(display.size.height) : NaN;
            const candW2 = Number(display.bounds.width) * scaleFactor;
            const candH2 = Number(display.bounds.height) * scaleFactor;

            const displayPixelW = isFinite(candW1) && Math.abs(candW1 - videoW) < Math.abs(candW2 - videoW) ? candW1 : candW2;
            const displayPixelH = isFinite(candH1) && Math.abs(candH1 - videoH) < Math.abs(candH2 - videoH) ? candH1 : candH2;

            const sx = displayPixelW ? videoW / displayPixelW : 1;
            const sy = displayPixelH ? videoH / displayPixelH : 1;

            // Window bounds + display bounds are in DIP; convert to pixels via scaleFactor, then scale to video space.
            const relXDip = Number(bounds.x) - Number(display.bounds.x);
            const relYDip = Number(bounds.y) - Number(display.bounds.y);
            const wDip = Number(bounds.width);
            const hDip = Number(bounds.height);

            const x = Math.round(relXDip * scaleFactor * sx);
            const y = Math.round(relYDip * scaleFactor * sy);
            const w = Math.round(wDip * scaleFactor * sx);
            const h = Math.round(hDip * scaleFactor * sy);

            // Slight padding to cover shadows/borders.
            const pad = Math.round(12 * scaleFactor * Math.max(sx, sy));
            const rx = Math.max(0, x - pad);
            const ry = Math.max(0, y - pad);
            const rw = Math.min(videoW - rx, w + pad * 2);
            const rh = Math.min(videoH - ry, h + pad * 2);

            if (rw > 4 && rh > 4) {
                offscreenContext.save();
                offscreenContext.fillStyle = 'rgba(0, 0, 0, 1)';
                offscreenContext.fillRect(rx, ry, rw, rh);
                offscreenContext.restore();
            }
        }
    } catch (e) {
        // Best-effort: never fail screenshot capture if redaction fails.
        try { console.warn('[AI][RENDERER] Redaction failed:', e?.message || e); } catch (_) {}
    }

    // Check if image was drawn properly by sampling a pixel
    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
        // Check if all pixels are black (0,0,0) or transparent
        return index === 3 ? true : value === 0;
    });

    if (isBlank) {
        console.warn('Screenshot appears to be blank/black');
    }

    let qualityValue;
    switch (imageQuality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.7;
            break;
        case 'low':
            qualityValue = 0.5;
            break;
        default:
            qualityValue = 0.7; // Default to medium
    }

    // IMPORTANT: return a Promise so callers can await until the screenshot is actually buffered in main.
    return await new Promise(resolve => {
        offscreenCanvas.toBlob(
            async blob => {
                if (!blob) {
                    console.error('Failed to create blob from canvas');
                    return resolve({ success: false, error: 'Failed to create blob' });
                }

                const reader = new FileReader();
                reader.onloadend = async () => {
                    try {
                        const dataUrl = String(reader.result || '');
                        const base64data = dataUrl.split(',')[1];

                        // Validate base64 data
                        if (!base64data || base64data.length < 100) {
                            console.error('Invalid base64 data generated');
                            return resolve({ success: false, error: 'Invalid base64 data' });
                        }

                        // Sync main-process screen gate with current toggle state to avoid OFF->ON races.
                        const useScreenNow = localStorage.getItem('assistantUseScreen') === 'true';
                        try { await ipcRenderer.invoke('set-use-screen-enabled', useScreenNow); } catch (_) {}
                        if (!useScreenNow) {
                            return resolve({ success: false, error: 'Use Screen disabled' });
                        }

                        const result = await ipcRenderer.invoke('send-image-content', { data: base64data });

                        if (result && result.success) {
                            // Track image tokens after successful send
                            const imageTokens = tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
                            tokenTracker.addTokens(imageTokens, 'image');
                            try { console.log('[AI][RENDERER] Screenshot capture complete', { ok: true }); } catch (_) {}
                            return resolve({ success: true, previewDataUrl: dataUrl });
                        }
                        console.error('Failed to send image:', result?.error);
                        try { console.log('[AI][RENDERER] Screenshot capture complete', { ok: false, error: result?.error }); } catch (_) {}
                        return resolve({ success: false, error: result?.error || 'Failed to send image' });
                    } catch (e) {
                        console.error('Error sending image:', e);
                        try { console.log('[AI][RENDERER] Screenshot capture complete', { ok: false, error: e?.message }); } catch (_) {}
                        return resolve({ success: false, error: e?.message || 'Error sending image' });
                    }
                };
                reader.readAsDataURL(blob);
            },
            'image/jpeg',
            qualityValue
        );
    });
}

async function captureManualScreenshot(imageQuality = null) {
    const quality = imageQuality || currentImageQuality;
    return await captureScreenshot(quality, true); // Pass true for isManual
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

// Capture + return preview for UI chip
async function captureManualScreenshotWithPreview(imageQuality = null) {
    const res = await captureManualScreenshot(imageQuality);
    if (res && res.success && res.previewDataUrl) return { success: true, previewDataUrl: res.previewDataUrl };
    return { success: false, error: res?.error || 'Capture failed' };
}
window.captureManualScreenshotWithPreview = captureManualScreenshotWithPreview;

// Allow voice/assist submits to attach the preview to the next chat turn
window.__stashNextChatScreenshotPreview = (dataUrl) => {
    try { pendingScreenshotPreviewDataUrl = String(dataUrl || '') || null; } catch (_) { pendingScreenshotPreviewDataUrl = null; }
};
window.__popNextChatScreenshotPreview = () => {
    const v = pendingScreenshotPreviewDataUrl;
    pendingScreenshotPreviewDataUrl = null;
    return v;
};

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-system-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;

    if (audioHealthInterval) {
        try { clearInterval(audioHealthInterval); } catch (_) {}
        audioHealthInterval = null;
    }

    // End capture-only exclusion (Undetectable may still keep protection enabled).
    try { ipcRenderer.invoke('set-ai-capture-exclusion', false).catch(() => {}); } catch (_) {}
}

function stopScreenCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (hiddenVideo) {
        try { hiddenVideo.pause(); } catch (_) {}
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
    // Inform main process to disable and clear buffered screenshots
    try { ipcRenderer.invoke('set-use-screen-enabled', false).catch(() => {}); } catch (_) {}

    // End capture-only exclusion when screen capture is stopped.
    try { ipcRenderer.invoke('set-ai-capture-exclusion', false).catch(() => {}); } catch (_) {}
}

// Send text message to the Answer LLM (OpenAI)
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (!result.success) {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Conversation storage functions using IndexedDB
let conversationDB = null;

async function initConversationStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ConversationHistory', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            conversationDB = request.result;
            resolve(conversationDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveConversationSession(sessionId, conversationHistory) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    const sessionData = {
        sessionId: sessionId,
        timestamp: parseInt(sessionId),
        conversationHistory: conversationHistory,
        lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(sessionData);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getConversationSession(sessionId) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

async function deleteConversationSessions(sessionIds) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const ids = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    await Promise.all(
        ids.map(
            id =>
                new Promise((resolve, reject) => {
                    const request = store.delete(id);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(true);
                })
        )
    );

    return true;
}

async function clearAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
    });
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Initialize conversation storage when renderer loads
initConversationStorage().catch(console.error);

// Handle shortcuts based on current view
async function handleShortcut(shortcutKey) {
    // Handling shortcut

    // Get current view from the app
    const currentView = window.cheddar.getCurrentView ? window.cheddar.getCurrentView() : null;

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        try { console.log('[AI][RENDERER] Ctrl/Cmd+Enter detected', { currentView }); } catch (_) {}
        if (currentView === 'main') {
            // Trigger the start session from main view

            // First try to get the app component and call handleStart directly
            const appElement = document.querySelector('ghostprep-app');
            if (appElement && typeof appElement.handleStart === 'function') {
                appElement.handleStart();
            } else {
                // Fallback: simulate click on the start button
                const mainView = document.querySelector('main-view');
                if (mainView) {
                    const startButton = mainView.shadowRoot?.querySelector('.start-button');
                    if (startButton && !startButton.classList.contains('initializing')) {
                        startButton.click();
                    } else {
                        console.warn('Start button not available or initializing');
                    }
                } else {
                    console.warn('Could not find main-view element');
                }
            }
        } else {
            const useScreen = localStorage.getItem('assistantUseScreen') === 'true';
            if (useScreen) {
                // Capture now so this submit includes the screenshot.
                try {
                    if (typeof window.captureManualScreenshotWithPreview === 'function') {
                        const quality = localStorage.getItem('selectedImageQuality') || 'medium';
                        const cap = await window.captureManualScreenshotWithPreview(quality);
                        if (cap && cap.success && cap.previewDataUrl) {
                            try { window.__stashNextChatScreenshotPreview?.(cap.previewDataUrl); } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
            ipcRenderer
                .invoke('send-current-transcription', {
                    actionName: 'Assist',
                    actionPrompt:
                        'Answer the question directly. Treat the transcript as an interviewer question and assume it may contain minor speech-to-text errors. ' +
                        'Silently correct obvious transcription mistakes and answer the intended question. Do not mention transcription errors, do not ask clarifying questions.',
                    uiAlreadyShown: true,
                    // If the user has pasted content into the text box but is submitting via Ctrl/Cmd+Enter,
                    // include it so voice + text are treated as one intent (Cluely-style).
                    typedText: (() => {
                        try {
                            const el = document.querySelector('#textInput');
                            return el && el.value ? String(el.value) : '';
                        } catch (_) {
                            return '';
                        }
                    })(),
                })
                .then(result => {
                    if (!result.success) {
                        console.error('Failed to send current transcription:', result.error);
                    }
                })
                .catch(error => {
                    console.error('Error sending current transcription:', error);
                });
        }
    }
}

    window.cheddar = {
        initializeAi,
        startCapture,
        stopCapture,
        startScreenCaptureScheduling,
        stopScreenCapture,
        sendTextMessage,
        handleShortcut,
        // Conversation history functions
        getAllConversationSessions,
        getConversationSession,
        initConversationStorage,
        deleteConversationSessions,
        clearAllConversationSessions,
        // Content protection function
        getContentProtection: () => {
            // Read-only: use undetectableEnabled; fall back to legacy keys; default OFF
            const undetectable = localStorage.getItem('undetectableEnabled');
            if (undetectable !== null) return undetectable === 'true';
        const legacyCP = localStorage.getItem('contentProtection');
        if (legacyCP !== null) return legacyCP === 'true';
        const legacyToggle = localStorage.getItem('undetectableTEnabled');
        if (legacyToggle !== null) return legacyToggle === 'true';
        return false;
    },
    isLinux: isLinux,
    isMacOS: isMacOS,
    e: cheddarElement,
};
