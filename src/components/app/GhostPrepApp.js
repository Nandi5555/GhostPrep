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
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        // New: prompt configuration panel open state
        promptPanelOpen: { type: Boolean },
        transcriptText: { type: String },
        activeAssistantTab: { type: String },
        mainCollapsed: { type: Boolean },
    };

    constructor() {
        super();
        // Compact mode is the ONLY supported layout mode.
        try { localStorage.setItem('layoutMode', 'compact'); } catch (_) {}
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
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this.promptPanelOpen = false;
        this.transcriptText = '';
        this.activeAssistantTab = 'chat';
        this.mainCollapsed = this.currentView === 'main';

        // Apply compact layout to document root
        this.applyCompactLayout();
    }

    connectedCallback() {
        super.connectedCallback();

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
            ipcRenderer.on('update-transcript-stream', (_, delta) => {
                if (typeof delta === 'string' && delta.length) {
                    this.transcriptText += delta;
                    this.requestUpdate();
                }
            });
            ipcRenderer.on('transcript-turn-complete', () => {
                this.transcriptText += '\n';
                this.requestUpdate();
            });
            // When the user explicitly submits the buffered transcript, record it as a user turn in the chat thread.
            ipcRenderer.on('transcription-submitted', (_, payload) => {
                try {
                    // UI rule: show only the action label for transcript-triggered actions.
                    const display = (payload && (payload.displayText || payload.actionName || payload.text)) ? String(payload.displayText || payload.actionName || payload.text) : '';
                    if (!display.trim()) return;

                    // IMPORTANT: immutable updates so Lit propagates changes to AssistantView
                    const nextQuestions = [...(this.questions || []), display.trim()];
                    let nextResponses = Array.isArray(this.responses) ? [...this.responses] : [];

                    // Keep arrays aligned: create a placeholder answer slot for this user turn.
                    if (nextResponses.length < nextQuestions.length) {
                        nextResponses.push('');
                    }

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
            ipcRenderer.removeAllListeners('update-transcript-stream');
            ipcRenderer.removeAllListeners('transcript-turn-complete');
            ipcRenderer.removeAllListeners('transcription-submitted');
        }
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

        if (typeof window.cheddar.initializeGemini !== 'function') {
            window.cheddar.initializeGemini = async () => true;
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

            // Start streaming on first chunk. We keep showing the dots loader until the FINAL
            // answer arrives, so we do NOT render partial tokens into `responses[]`.
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
                await ipcRenderer.invoke('close-session');
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
        // check if api key is empty do nothing
        const apiKey = localStorage.getItem('apiKey')?.trim();
        if (!apiKey || apiKey === '') {
            // Trigger the red blink animation on the API key input
            const mainView = this.shadowRoot.querySelector('main-view');
            if (mainView && mainView.triggerApiKeyError) {
                mainView.triggerApiKeyError();
            }
            return;
        }

        if (window.cheddar) {
            const success = await window.cheddar.initializeGemini(this.selectedProfile, this.selectedLanguage);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && typeof mainView.showToast === 'function') {
                    mainView.showToast('Invalid API key', 'error');
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
            // Optional renderer cache
            if (window.cheddar && typeof window.cheddar.setTranscriptionModeCached === 'function') {
                window.cheddar.setTranscriptionModeCached(mode);
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
    async handleSendText(message) {
        if (window.cheddar) {
            try {
                const nextQuestions = [...(this.questions || []), message];
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
        // Compact mode is always enforced (even if storage was modified externally).
        try { localStorage.setItem('layoutMode', 'compact'); } catch (_) {}
        this.applyCompactLayout();

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
        // Only re-render the view if it hasn't been cached or if critical properties changed
        const viewKey = `${this.currentView}-${this.selectedProfile}-${this.selectedLanguage}`;

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
                        .onSendText=${message => this.handleSendText(message)}
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
        const baseClass = this.currentView === 'assistant' ? 'assistant-view' : this.currentView === 'onboarding' ? 'onboarding-view' : 'with-border';
        const collapseClass = this.currentView === 'main' ? (this.mainCollapsed ? 'collapsed' : 'expanded') : '';
        const mainContentClass = `main-content ${baseClass} ${collapseClass}`;

        return html`
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
