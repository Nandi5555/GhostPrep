import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { AppHeader } from './AppHeader.js';
import { resizeLayout } from '../../utils/windowResize.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AdvancedView } from '../views/AdvancedView.js';
import { PermissionsView } from '../views/PermissionsView.js';
import { scrollbarStyles } from '../styles/scrollbarStyles.js';

export class GhostPrepApp extends LitElement {
    static styles = [
        scrollbarStyles,
        css`
        * {
            box-sizing: border-box;
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            margin: 0px;
            padding: 0px;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background-color: var(--background-transparent);
            color: var(--text-color);
        }

        .window-container {
            height: 100vh;
            border-radius: 7px;
            overflow: hidden;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .main-content {
            flex: 1;
            padding: var(--main-content-padding);
            overflow-y: auto;
            margin-top: var(--main-content-margin-top);
            border-radius: var(--content-border-radius);
            transition: max-height 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease;
            background: var(--main-content-background);
            backdrop-filter: blur(8px);
            box-shadow: none;
        }

        .main-content.with-border {
            border: 1px solid var(--border-color);
        }

        .main-content.assistant-view { padding: 10px; border: none; }

        .main-content.onboarding-view {
            padding: 0;
            border: none;
            background: transparent;
        }

        .view-container {
            opacity: 1;
            transform: translateY(0);
            transition:
                opacity 0.15s ease-out,
                transform 0.15s ease-out;
            height: 100%;
        }

        .view-container.entering {
            opacity: 0;
            transform: translateY(10px);
        }
        .main-content.collapsed {
            max-height: 0;
            opacity: 0;
            padding: 0;
            margin-top: 0;
            overflow: hidden;
            border: none;
        }

        .main-content.expanded {
            max-height: 100vh;
            opacity: 1;
        }
    `,
    ];

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        questions: { type: Array },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        advancedMode: { type: Boolean },
        _isClickThrough: { state: true },
        // New: prompt configuration panel open state
        promptPanelOpen: { type: Boolean },
        transcriptText: { type: String },
        activeAssistantTab: { type: String },
        mainCollapsed: { type: Boolean },
        // Toast for non-silent failures
        toastText: { type: String },
        toastState: { type: String },
        toastType: { type: String },
        permissionStatus: { type: Object },
    };

    constructor() {
        super();
        // Check if onboarding has been completed
        const onboardingCompleted = localStorage.getItem('onboardingCompleted');
        this.currentView = onboardingCompleted ? 'main' : 'onboarding';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        this.selectedLanguage = localStorage.getItem('selectedLanguage') || 'en-US';
        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this.advancedMode = localStorage.getItem('advancedMode') === 'true';
        this.responses = [];
        this.currentResponseIndex = -1;
        this.questions = [];
        this._isClickThrough = false;
        this.promptPanelOpen = false;
        this.transcriptText = '';
        this.activeAssistantTab = 'chat';
        this.mainCollapsed = this.currentView === 'main';

        this.toastText = '';
        this.toastState = 'hide';
        this.toastType = 'info';
        this._toastTimer = null;

        this.permissionStatus = null;
    }

    connectedCallback() {
        super.connectedCallback();
        // Compact mode is the ONLY supported layout mode; ensure it stays applied.
        this.applyCompactLayout();

        // Set up IPC listeners if needed
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            // Final responses
            ipcRenderer.on('update-response', (_, response) => {
                this.handleResponseFinal(response);
            });
            // Streaming partial updates
            ipcRenderer.on('update-response-stream', (_, partial) => {
                this.handleResponseStream(partial);
            });
            ipcRenderer.on('update-status', (_, status) => {
                this.setStatus(status);
                const lower = String(status || '').toLowerCase();
                if (lower.includes('invalid api key')) {
                    this.currentView = 'main';
                    const mainView = this.shadowRoot.querySelector('main-view');
                    if (mainView && typeof mainView.showToast === 'function') {
                        mainView.showToast('Invalid API key', 'error');
                    }
                    this.requestUpdate();
                }
            });
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            ipcRenderer.on('ui-error', (_, payload) => {
                try {
                    const msg = String(payload?.message || 'Unknown error');
                    this.showToast(msg, 'error');
                } catch (_) {}
            });
            // Cluely-style transcript streaming:
            // - interim replaces the current draft
            // - final commits into finalText (with newlines) without duplication
            ipcRenderer.on('update-transcript', (_, payload) => {
                try {
                    const finalText = String(payload?.finalText || '');
                    const draftText = String(payload?.draftText || '');
                    this.transcriptText = `${finalText}${draftText}`;
                    this.requestUpdate();
                } catch (_) {}
            });
            // Cluely-style: voice-based submits also create a real chat user bubble with transcript snapshot.
            ipcRenderer.on('chat-user-turn', (_, payload) => {
                try {
                    const text = String(payload?.text || '').trim();
                    if (!text) return;
                    // Attach screenshot preview for this submit (if Use Screen was ON).
                    let preview = '';
                    try {
                        if (typeof window.__popNextChatScreenshotPreview === 'function') {
                            preview = String(window.__popNextChatScreenshotPreview() || '');
                        }
                    } catch (_) {
                        preview = '';
                    }
                    const qItem = preview ? { text, screenshot: { previewDataUrl: preview } } : text;

                    const nextQuestions = [...(this.questions || []), qItem];
                    let nextResponses = Array.isArray(this.responses) ? [...this.responses] : [];
                    if (nextResponses.length < nextQuestions.length) nextResponses.push('');
                    this.questions = nextQuestions;
                    this.responses = nextResponses;
                    this.currentResponseIndex = nextQuestions.length - 1;
                    this.requestUpdate();
                } catch (_) {}
            });
        }

        // Add functions to window.cheddar for IPC callbacks
        this.setupCheddarCallbacks();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-response-stream');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('update-transcript');
            ipcRenderer.removeAllListeners('chat-user-turn');
            ipcRenderer.removeAllListeners('ui-error');
        }
        try { this.handleReasoningComplete(); } catch (_) {}
    }

    showToast(message, type = 'info') {
        this.toastText = message || '';
        this.toastType = type;
        this.toastState = 'show';
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
        }
        this._toastTimer = setTimeout(() => {
            this.toastState = 'hide';
            this.requestUpdate();
        }, 3200);
        this.requestUpdate();
    }

    setupCheddarCallbacks() {
        // Initialize window.cheddar if it doesn't exist
        if (!window.cheddar) {
            window.cheddar = {};
        }

        // Add function to get current view
        window.cheddar.getCurrentView = () => {
            return this.currentView;
        };

        // Provide browser-preview stubs for Electron renderer functions when unavailable
        const isMac = navigator.platform.includes('Mac');
        const isLinux = navigator.platform.includes('Linux');

        if (typeof window.cheddar.initializeAi !== 'function') {
            window.cheddar.initializeAi = async () => true;
        }
        if (typeof window.cheddar.startCapture !== 'function') {
            window.cheddar.startCapture = () => {};
        }
        if (typeof window.cheddar.stopCapture !== 'function') {
            window.cheddar.stopCapture = () => {};
        }
        if (typeof window.cheddar.sendTextMessage !== 'function') {
            window.cheddar.sendTextMessage = async () => ({ success: true });
        }
        if (typeof window.cheddar.getAllConversationSessions !== 'function') {
            window.cheddar.getAllConversationSessions = async () => [];
        }
        if (typeof window.cheddar.getConversationSession !== 'function') {
            window.cheddar.getConversationSession = async () => null;
        }
        if (typeof window.cheddar.initConversationStorage !== 'function') {
            window.cheddar.initConversationStorage = async () => {};
        }
        if (typeof window.cheddar.getContentProtection !== 'function') {
            // Default to true so preview behaves like protected content
            window.cheddar.getContentProtection = () => true;
        }
        if (typeof window.cheddar.e !== 'function') {
            window.cheddar.e = () => document.getElementById('cheddar');
        }
        if (typeof window.cheddar.isMacOS === 'undefined') {
            window.cheddar.isMacOS = isMac;
        }
        if (typeof window.cheddar.isLinux === 'undefined') {
            window.cheddar.isLinux = isLinux;
        }
    }

    setStatus(text) {
        this.statusText = text;
    }

    setResponse(response) {
        this.responses.push(response);

        // If user is viewing the latest response (or no responses yet), auto-navigate to new response
        if (this.currentResponseIndex === this.responses.length - 2 || this.currentResponseIndex === -1) {
            this.currentResponseIndex = this.responses.length - 1;
        }

        this.requestUpdate();
    }

    // --- Streaming support ---
    _isStreaming = false;
    _streamCumulativeTarget = '';
    _typingInterval = null; // no longer used; streaming handled in AssistantView
    _typingCharsPerTick = 1; // legacy; not used
    _streamSession = 0;
    _lastStreamDelta = '';
    _streamIsFinal = false;
    _streamResponseIndex = -1;

    handleResponseStream(partial) {
        try {
            if (!partial || typeof partial !== 'string') return;

            // Start streaming on first chunk.
            // Cluely-style: stream tokens into the latest answer bubble immediately.
            if (!this._isStreaming) {
                this._isStreaming = true;
                this._streamCumulativeTarget = '';
                const qLen = (this.questions || []).length;
                let nextResponses = Array.isArray(this.responses) ? [...this.responses] : [];

                // Ensure we have a response slot for the latest question.
                if (qLen > 0) {
                    while (nextResponses.length < qLen) nextResponses.push('');
                    const idx = Math.min(
                        Math.max(this.currentResponseIndex >= 0 ? this.currentResponseIndex : qLen - 1, 0),
                        qLen - 1
                    );
                    this._streamResponseIndex = idx;
                    this.currentResponseIndex = idx;
                } else {
                    // Edge case: no question exists; create a slot.
                    this.questions = [...(this.questions || []), ''];
                    nextResponses.push('');
                    this._streamResponseIndex = nextResponses.length - 1;
                    this.currentResponseIndex = this._streamResponseIndex;
                }

                this.responses = nextResponses;
                // Signal new stream session to AssistantView
                this._streamSession++;
                this._lastStreamDelta = partial;
                this._streamIsFinal = false;
            } else {
                this._lastStreamDelta = partial;
            }
            this.requestUpdate();
        } catch (e) {
            console.warn('handleResponseStream error:', e);
        }
    }

    handleResponseFinal(finalText) {
        try {
            if (typeof finalText !== 'string') return;

            // Always finalize into the active streaming slot when available.
            const qLen = (this.questions || []).length;
            let nextResponses = Array.isArray(this.responses) ? [...this.responses] : [];
            const idx = this._streamResponseIndex >= 0
                ? this._streamResponseIndex
                : (qLen > 0 ? qLen - 1 : nextResponses.length - 1);

            if (qLen > 0) {
                while (nextResponses.length < qLen) nextResponses.push('');
            } else if (idx < 0) {
                this.questions = [...(this.questions || []), ''];
                nextResponses.push('');
            }

            const safeIdx = idx >= 0 ? idx : (nextResponses.length - 1);
            nextResponses[safeIdx] = finalText;
            this.responses = nextResponses;
            this.currentResponseIndex = safeIdx;

            // Streaming session ends on final (we already appended deltas to responses directly).
            this._streamIsFinal = false;
            this._isStreaming = false;
            this._lastStreamDelta = '';
            this._streamCumulativeTarget = '';
            this._streamResponseIndex = -1;
            this.requestUpdate();
        } finally {
            // no-op
        }
    }

    _applyTyping() {
        try {
            if (!this._isStreaming || this.responses.length === 0) return;
            const idx = this.responses.length - 1;
            const current = this.responses[idx] || '';
            const target = this._streamCumulativeTarget || '';

            if (current.length >= target.length) {
                return; // wait for more target text
            }

            const nextLen = Math.min(current.length + this._typingCharsPerTick, target.length);
            const next = target.slice(0, nextLen);
            this.responses[idx] = next;
            this.currentResponseIndex = idx;
            this.requestUpdate();
        } catch (e) {
            console.warn('applyTyping error:', e);
        }
    }

    handleStreamFinished() {
        // End the streaming state after AssistantView typed all characters
        this._isStreaming = false;
        this._streamIsFinal = false;
        this._lastStreamDelta = '';
        this._streamCumulativeTarget = '';
        if (this._typingInterval) {
            clearInterval(this._typingInterval);
            this._typingInterval = null;
        }
        this.requestUpdate();
    }

    // Header event handlers
    handleCustomizeClick() {
        this.currentView = 'customize';
        this.requestUpdate();
    }

    handleHelpClick() {
        this.currentView = 'help';
        this.requestUpdate();
    }

    handleHistoryClick() {
        this.currentView = 'history';
        this.requestUpdate();
    }

    handleAdvancedClick() {
        this.currentView = 'advanced';
        this.requestUpdate();
    }

    async handleClose() {
        if (this.currentView === 'customize' || this.currentView === 'help' || this.currentView === 'history') {
            this.currentView = 'main';
        } else if (this.currentView === 'assistant') {
            if (window.cheddar) {
                window.cheddar.stopCapture();
            }

            // Close the session
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-ai-session');
            }
            this.sessionActive = false;
            this.currentView = 'main';
        } else {
            // Quit the entire application
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // Main view event handlers
    async handleStart() {
        // Cluely-style: require provider keys (stored in Customize)
        const deepgramApiKey = localStorage.getItem('deepgramApiKey')?.trim();
        const openaiApiKey = localStorage.getItem('openaiApiKey')?.trim();
        if (!deepgramApiKey || !openaiApiKey) {
            const mainView = this.shadowRoot.querySelector('main-view');
            if (mainView && typeof mainView.showToast === 'function') {
                mainView.showToast('Set Deepgram + OpenAI keys in Customize → AI Providers', 'error');
            } else if (mainView && mainView.triggerApiKeyError) {
                mainView.triggerApiKeyError();
            }
            return;
        }

        if (window.cheddar) {
            const result = await window.cheddar.initializeAi(this.selectedProfile, this.selectedLanguage);
            if (!result) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && typeof mainView.showToast === 'function') {
                    mainView.showToast('Failed to start AI session', 'error');
                }
                return;
            }
            window.cheddar.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        }
        this.responses = [];
        this.currentResponseIndex = -1;
        this.questions = [];
        this.transcriptText = '';
        this.startTime = Date.now();
        this.currentView = 'assistant';
        try { resizeLayout(); } catch (_) {}
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://ghostprep.com/help/api-key');
        }
    }

    // Customize view event handlers
    handleProfileChange(profile) {
        this.selectedProfile = profile;
    }

    handleLanguageChange(language) {
        this.selectedLanguage = language;
    }

    async handleTranscriptionModeChange(mode) {
        try {
            // Persist is handled by CustomizeView; notify main for runtime gating
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-transcription-mode', mode);
            }
        } catch (error) {
            console.error('Failed to update transcription mode:', error);
        }
    }

    handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
    }

    handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        localStorage.setItem('selectedImageQuality', quality);
    }

    handleAdvancedModeChange(advancedMode) {
        this.advancedMode = advancedMode;
        localStorage.setItem('advancedMode', advancedMode.toString());
    }

    handleBackClick() {
        this.currentView = 'main';
        this.requestUpdate();
    }

    // Help view event handlers
    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    // Assistant view event handlers
    async handleSendText(message, { screenshotPreviewDataUrl = '' } = {}) {
        if (window.cheddar) {
            try {
                const preview = String(screenshotPreviewDataUrl || '');
                const qItem = preview ? { text: message, screenshot: { previewDataUrl: preview } } : message;
                const nextQuestions = [...(this.questions || []), qItem];
                let nextResponses = Array.isArray(this.responses) ? [...this.responses] : [];
                if (nextResponses.length < nextQuestions.length) {
                    nextResponses.push('');
                }
                this.questions = nextQuestions;
                this.responses = nextResponses;
                this.currentResponseIndex = nextQuestions.length - 1;
            } catch (_) {}
            const result = await window.cheddar.sendTextMessage(message);

            if (!result.success) {
                console.error('Failed to send message:', result.error);
                this.setStatus('Error sending message: ' + result.error);
            } else {
                this.setStatus('Message sent...');
            }
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
    }

    // Onboarding event handlers
    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Only notify main process of view change if the view actually changed
        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);

            // Add a small delay to smooth out the transition
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        if (changedProperties.has('currentView')) {
            if (this.currentView === 'main') {
                this.mainCollapsed = true;
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('advancedMode')) {
            localStorage.setItem('advancedMode', this.advancedMode.toString());
        }
    }

    renderCurrentView() {
        if (this.currentView === 'permissions') {
            return html`
                <permissions-view
                    .permissionStatus=${this.permissionStatus}
                ></permissions-view>
            `;
        }
        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .onStart=${() => this.handleStart()}
                        .onAPIKeyHelp=${() => this.handleAPIKeyHelp()}
                    ></main-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .advancedMode=${this.advancedMode}
                        .onProfileChange=${profile => this.handleProfileChange(profile)}
                        .onLanguageChange=${language => this.handleLanguageChange(language)}
                        .onTranscriptionModeChange=${mode => this.handleTranscriptionModeChange(mode)}
                        .onScreenshotIntervalChange=${interval => this.handleScreenshotIntervalChange(interval)}
                        .onImageQualityChange=${quality => this.handleImageQualityChange(quality)}
                        .onAdvancedModeChange=${advancedMode => this.handleAdvancedModeChange(advancedMode)}
                    ></customize-view>
                `;

            case 'help':
                return html` <help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view> `;

            case 'history':
                return html` <history-view></history-view> `;

            case 'advanced':
                return html` <advanced-view></advanced-view> `;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .questions=${this.questions}
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .statusText=${this.statusText}
                        .isStreaming=${this._isStreaming}
                        .streamDelta=${this._lastStreamDelta}
                        .streamSession=${this._streamSession}
                        .streamIsFinal=${this._streamIsFinal}
                        .activeTab=${this.activeAssistantTab}
                        .transcriptText=${this.transcriptText}
                        .onSendText=${(message, opts) => this.handleSendText(message, opts)}
                        .promptPanelOpen=${this.promptPanelOpen}
                        .onTabChange=${tab => this.handleAssistantTabChange(tab)}
                        @close-prompt-panel=${() => this.handleClosePromptPanel()}
                        @stream-finished=${() => this.handleStreamFinished()}
                        @response-index-changed=${this.handleResponseIndexChanged}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    render() {
        const baseClass = this.currentView === 'assistant' ? 'assistant-view' : (this.currentView === 'onboarding' || this.currentView === 'permissions') ? 'onboarding-view' : 'with-border';
        const collapseClass = this.currentView === 'main' ? (this.mainCollapsed ? 'collapsed' : 'expanded') : '';
        const mainContentClass = `main-content ${baseClass} ${collapseClass}`;

        return html`
            <div
                class="toast ${this.toastState} ${this.toastType}"
                style="position:fixed; top:14px; left:50%; transform:translateX(-50%); z-index:9999; padding:10px 14px; border-radius:12px; color:var(--text-color); background:var(--glass-bg); border:1px solid var(--glass-border); box-shadow: var(--glass-shadow); opacity:${this.toastState === 'show' ? '1' : '0'}; pointer-events:none; transition: opacity 220ms ease;"
                role="alert"
                aria-live="polite"
            >
                <span>${this.toastText}</span>
            </div>
            <div class="window-container">
                <div class="container">
                    <app-header
                        .currentView=${this.currentView}
                        .statusText=${this.statusText}
                        .startTime=${this.startTime}
                        .advancedMode=${this.advancedMode}
                        .onCustomizeClick=${() => this.handleCustomizeClick()}
                        .onHelpClick=${() => this.handleHelpClick()}
                        .onHistoryClick=${() => this.handleHistoryClick()}
                        .onAdvancedClick=${() => this.handleAdvancedClick()}
                        .onCloseClick=${() => this.handleClose()}
                        .onBackClick=${() => this.handleBackClick()}
                        .onHideToggleClick=${() => this.handleHideToggle()}
                        .onMainToggleClick=${() => this.handleMainToggle()}
                        .isMainCollapsed=${this.mainCollapsed}
                        .onDocumentClick=${() => this.handlePromptConfigOpen()}
                        ?isClickThrough=${this._isClickThrough}
                    ></app-header>
                    <div class="${mainContentClass}">
                        <div class="view-container">${this.renderCurrentView()}</div>
                    </div>
                </div>
            </div>
        `;
    }

    applyCompactLayout() {
        try { document.documentElement.classList.add('compact-layout'); } catch (_) {}
    }

    handleMainToggle() {
        if (this.currentView !== 'main') return;
        this.mainCollapsed = !this.mainCollapsed;
        this.requestUpdate();
    }

    // Layout mode switching removed: compact is always-on.

    // Prompt configuration panel controls (must be inside class)
    handlePromptConfigOpen() {
        this.promptPanelOpen = true;
        this.requestUpdate();
    }

    handleClosePromptPanel() {
        this.promptPanelOpen = false;
        this.requestUpdate();
    }

    handleAssistantTabChange(tab) {
        this.activeAssistantTab = tab === 'transcript' ? 'transcript' : 'chat';
        this.requestUpdate();
    }
}

customElements.define('ghostprep-app', GhostPrepApp);
