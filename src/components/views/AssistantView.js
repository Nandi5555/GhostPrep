import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
        }

        .response-container {
            height: calc(100% - 60px);
            overflow-y: auto;
            border-radius: 10px;
            font-size: var(--response-font-size, 18px);
            line-height: 1.6;
            background: var(--main-content-background);
            padding: 16px;
            scroll-behavior: smooth;
        }

        /* Markdown styling */
        .response-container h1,
        .response-container h2,
        .response-container h3,
        .response-container h4,
        .response-container h5,
        .response-container h6 {
            margin: 1.2em 0 0.6em 0;
            color: var(--text-color);
            font-weight: 600;
        }

        .response-container h1 {
            font-size: 1.8em;
        }
        .response-container h2 {
            font-size: 1.5em;
        }
        .response-container h3 {
            font-size: 1.3em;
        }
        .response-container h4 {
            font-size: 1.1em;
        }
        .response-container h5 {
            font-size: 1em;
        }
        .response-container h6 {
            font-size: 0.9em;
        }

        .response-container p {
            margin: 0.8em 0;
            color: var(--text-color);
        }

        .response-container ul,
        .response-container ol {
            margin: 0.8em 0;
            padding-left: 2em;
            color: var(--text-color);
        }

        .response-container li {
            margin: 0.4em 0;
        }

        .response-container blockquote {
            margin: 1em 0;
            padding: 0.5em 1em;
            border-left: 4px solid var(--focus-border-color);
            background: rgba(0, 122, 255, 0.1);
            font-style: italic;
        }

        .response-container code {
            background: rgba(255, 255, 255, 0.18); /* higher contrast for translucency */
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.85em;
        }

        .response-container pre {
            background: rgba(20, 22, 30, 0.88); /* solid dark for readability */
            border: 1px solid #2a2f3a;
            border-radius: 10px;
            padding: 1em;
            overflow-x: auto;
            margin: 1em 0;
        }

        .response-container pre code {
            background: none;
            padding: 0;
            border-radius: 0;
        }

        /* Match horizontal/vertical scrollbar styling inside code blocks */
        .response-container pre {
            /* Firefox */
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
        }
        .response-container pre::-webkit-scrollbar {
            width: 3px;   /* vertical scrollbar width */
            height: 3px;  /* horizontal scrollbar height */
        }
        .response-container pre::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 999px;
        }
        .response-container pre::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 999px;
            border: 1px solid transparent;
            background-clip: padding-box;
        }
        .response-container pre::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Ensure inner <code> element scrollbars (horizontal) are equally thin */
        .response-container pre code {
            /* Firefox */
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
        }
        .response-container pre code::-webkit-scrollbar {
            width: 3px;   /* vertical */
            height: 3px;  /* horizontal */
        }
        .response-container pre code::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 999px;
        }
        .response-container pre code::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 999px;
            border: 1px solid transparent;
            background-clip: padding-box;
        }
        .response-container pre code::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .response-container a {
            color: var(--link-color);
            text-decoration: none;
        }

        .response-container a:hover {
            text-decoration: underline;
        }

        .response-container strong,
        .response-container b {
            font-weight: 700;
            color: #fa6e4eff; /* warm accent for high visibility */
            background: rgba(255, 209, 102, 0.16);
            padding: 0 2px;
            border-radius: 4px;
        }

        .response-container em,
        .response-container i {
            font-style: italic;
        }

        .response-container hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 2em 0;
        }

        .response-container table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }

        .response-container th,
        .response-container td {
            border: 1px solid var(--border-color);
            padding: 0.5em;
            text-align: left;
        }

        .response-container th {
            background: var(--input-background);
            font-weight: 600;
        }

        .response-container::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }

        .response-container::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Streaming caret indicator */
        .stream-caret {
            display: inline-block;
            width: 8px;
            height: 1em;
            background: var(--text-color);
            margin-left: 2px;
            animation: blink 1s steps(1, end) infinite;
            vertical-align: bottom;
        }

        @keyframes blink {
            50% { opacity: 0; }
        }

        .text-input-container {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            align-items: center;
        }

        .text-input-container input {
            flex: 1;
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 14px;
        }

        .text-input-container input:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        .text-input-container input::placeholder {
            color: var(--placeholder-color);
        }

        /* Textarea styling for multiline input with hidden scrollbars */
        .text-input-container textarea {
            flex: 1;
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 10px; /* tighter for a smaller initial footprint */
            border-radius: 15px; /* more rounded corners */
            font-size: 14px;
            line-height: 1.2;
            height: 36px; /* initial single-line size */
            min-height: 36px;
            max-height: 80px; /* keep growth modest */
            overflow-y: auto;
            resize: none;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE/Edge legacy */
            scroll-behavior: smooth;
            transition: height 0.12s ease;
        }

        .text-input-container textarea:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        .text-input-container textarea::placeholder {
            color: var(--placeholder-color);
        }

        /* Hide scrollbars in WebKit browsers while keeping scroll functional */
        .text-input-container textarea::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        .text-input-container textarea::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 6px;
        }
        .text-input-container textarea::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 6px;
            border: 1px solid transparent;
            background-clip: padding-box;
            transition: background-color 0.2s ease;
        }
        .text-input-container textarea::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .text-input-container button {
            background: transparent;
            color: var(--start-button-background);
            border: none;
            padding: 0;
            border-radius: 100px;
        }

        .text-input-container button:hover {
            background: var(--text-input-button-hover);
        }

        .nav-button {
            background: transparent;
            color: white;
            border: none;
            padding: 4px;
            border-radius: 50%;
            font-size: 12px;
            display: flex;
            align-items: center;
            width: 36px;
            height: 36px;
            justify-content: center;
        }

        .nav-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .nav-button:disabled {
            opacity: 0.3;
        }

        .nav-button svg {
            stroke: white !important;
        }

        .response-counter {
            font-size: 12px;
            color: var(--description-color);
            white-space: nowrap;
            min-width: 60px;
            text-align: center;
        }

        /* Syntax highlighting (highlight.js inspired) */
        pre code.hljs {
            display: block;
            overflow-x: auto;
            padding: 0;
            background: transparent;
            color: var(--text-color);
        }
        .hljs-comment,
        .hljs-quote { color: #9aa6b2; font-style: italic; }
        .hljs-keyword,
        .hljs-selector-tag,
        .hljs-type,
        .hljs-built_in,
        .hljs-literal { color: #ff79c6; }
        .hljs-string,
        .hljs-regexp { color: #50fa7b; }
        .hljs-number { color: #bd93f9; }
        .hljs-function .hljs-title,
        .hljs-title { color: #8be9fd; }
        .hljs-attr,
        .hljs-attribute,
        .hljs-variable,
        .hljs-property { color: #f1fa8c; }

        /* Distinct styling for output blocks */
        .response-container pre.output-block {
            background: rgba(0, 0, 0, 0.25);
            border-left: 4px solid var(--focus-border-color);
        }
        .response-container pre.output-block code {
            color: var(--text-color);
        }
        
        .assistant-toggles {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 6px;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
        }
        .assistant-toggle-label {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .assistant-toggle-input {
            width: 14px;
            height: 14px;
            accent-color: var(--focus-border-color, #007aff);
            cursor: default;
        }

        /* Prompt buttons next to Auto-scroll */
        .prompt-buttons {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-left: 10px;
            flex-wrap: wrap;
        }
        .prompt-button {
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--button-border);
            box-shadow: 0 0 0 2px white; /* white outline */
            border-radius: 999px; /* max round */
            padding: 6px 10px;
            font-size: 12px;
            line-height: 1;
            cursor: default;
            transition: box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .prompt-button:hover {
            background: rgba(255, 255, 255, 0.06);
        }
        .prompt-button.pulse {
            box-shadow: 0 0 0 2px var(--focus-border-color, #007aff); /* blue outline on click */
        }

        /* Right-side sliding modal for prompt configuration */
        .prompt-panel-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(2px);
            display: flex;
            justify-content: flex-end;
            align-items: stretch;
            z-index: 9998;
        }
        .prompt-panel {
            width: 340px;
            max-width: 92vw;
            height: 100%;
            background: var(--main-content-background);
            border-left: 1px solid var(--border-color);
            border-radius: 8px 0 0 8px;
            transform: translateX(100%);
            transition: transform 0.2s ease-out;
            display: flex;
            flex-direction: column;
        }
        .prompt-panel.open {
            transform: translateX(0);
        }
        .prompt-panel-header {
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .prompt-panel-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--text-color);
        }
        .prompt-panel-body {
            flex: 1;
            overflow: auto;
            padding: 10px;
        }
        .prompt-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background: var(--card-background);
            margin-bottom: 10px;
        }
        .prompt-row input,
        .prompt-row textarea {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 12px;
        }
        .prompt-row textarea {
            min-height: 64px;
            resize: vertical;
        }
        .prompt-panel-actions {
            padding: 10px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .prompt-action-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: default;
        }
        .prompt-action-button:hover {
            background: var(--hover-background);
        }
        .add-prompt-button:disabled {
            opacity: 0.4;
            cursor: default;
        }
        /* Modal scrollbar styling */
        .prompt-panel-body::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        .prompt-panel-body::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 6px;
        }
        .prompt-panel-body::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 6px;
            border: 1px solid transparent;
            background-clip: padding-box;
            transition: background-color 0.2s ease;
        }
        .prompt-panel-body::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Resize handles overlay */
        .resize-overlay {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
        }
        .resize-handle {
            position: fixed;
            background: transparent;
            pointer-events: auto;
            touch-action: none;
        }
        .resize-handle.top { top: 0; left: 0; right: 0; height: 8px; cursor: n-resize; }
        .resize-handle.bottom { bottom: 0; left: 0; right: 0; height: 8px; cursor: s-resize; }
        .resize-handle.left { left: 0; top: 0; bottom: 0; width: 8px; cursor: w-resize; }
        .resize-handle.right { right: 0; top: 0; bottom: 0; width: 8px; cursor: e-resize; }
        .resize-handle.tl { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
        .resize-handle.tr { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
        .resize-handle.bl { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
        .resize-handle.br { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        onSendText: { type: Function },
        isStreaming: { type: Boolean },
        autoScrollEnabled: { type: Boolean },
        promptPanelOpen: { type: Boolean },
        // Streaming inputs from parent component
        streamDelta: { type: String },
        streamSession: { type: Number },
        streamIsFinal: { type: Boolean },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => {};
        this.isStreaming = false;
        this.streamDelta = '';
        this.streamSession = 0;
        this.streamIsFinal = false;
        // Syntax highlighting library instance (loaded in connectedCallback)
        this.hljs = null;
        // Load toggles from localStorage
        this.autoScrollEnabled = localStorage.getItem('assistantAutoScroll') !== 'false';
        // Prompt panel and buttons state
        this.promptPanelOpen = false;
        this.promptButtons = [];
        this.editablePrompts = [];
        this._lastPromptClickTs = 0;

        // Internal streaming state (typewriter engine)
        this._streamTypedText = '';
        this._streamTargetText = '';
        this._currentStreamSession = 0;
        this._typingInterval = null;
        this._typingCharsPerTick = 2; // slightly faster typing cadence
        this._typingMs = 10; // ~80 chars/sec, comfortable pace
        this._finalEventEmitted = false;
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
        };
    }

    getCurrentResponse() {
        const profileNames = this.getProfileNames();
        return this.responses.length > 0 && this.currentResponseIndex >= 0
            ? this.responses[this.currentResponseIndex]
            : `Hey, Im listening to your ${profileNames[this.selectedProfile] || 'session'}?`;
    }

    renderMarkdown(content, light = false) {
        // Check if marked is available
        if (typeof window !== 'undefined' && window.marked) {
            try {
                const escapeHtml = (str) =>
                    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                // Custom renderer to distinguish code vs output blocks
                const renderer = new window.marked.Renderer();
                renderer.code = (code, infostring) => {
                    const lang = (infostring || '').trim().toLowerCase();
                    const isOutput = ['output', 'text', 'plaintext', 'console'].includes(lang);

                    let highlighted = code;
                    if (this.hljs && !isOutput && !light) {
                        try {
                            if (lang && this.hljs.getLanguage(lang)) {
                                highlighted = this.hljs.highlight(code, { language: lang }).value;
                            } else {
                                highlighted = this.hljs.highlightAuto(code).value;
                            }
                        } catch (e) {
                            highlighted = escapeHtml(code);
                        }
                    } else {
                        highlighted = escapeHtml(code);
                    }

                    const langClass = lang ? `language-${lang}` : '';
                    const blockClass = isOutput ? 'output-block' : '';
                    const codeClass = isOutput || light ? '' : 'hljs';

                    return `<pre class="${blockClass}"><code class="${langClass} ${codeClass}">${highlighted}</code></pre>`;
                };

                // Configure marked for better security and formatting
                window.marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false, // We trust the AI responses
                });

                window.marked.use({ renderer });

                const rendered = window.marked.parse(content);
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.warn('Marked not available, using plain text');
        return content; // Fallback if marked is not available
    }

    getResponseCounter() {
        return this.responses.length > 0 ? `${this.currentResponseIndex + 1}/${this.responses.length}` : '';
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
        }
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
        }
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            const fontSizeValue = parseInt(fontSize, 10) || 20;
            const root = document.documentElement;
            root.style.setProperty('--response-font-size', `${fontSizeValue}px`);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Load and apply font size
        this.loadFontSize();

        // Load highlight.js if available
        if (window.require) {
            try {
                this.hljs = window.require('highlight.js');
            } catch (e) {
                console.warn('highlight.js could not be loaded:', e);
            }
        }

        // Set up IPC listeners for keyboard shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            this.handlePreviousResponse = () => {
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
                this.scrollResponseDown();
            };

            // New: prefill text input from transcripts (On Demand mode)
            this.handlePrefillTextInput = (_event, text) => {
                try {
                    this.prefillTextInput(text);
                } catch (_) {}
            };

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);
            ipcRenderer.on('prefill-text-input', this.handlePrefillTextInput);
        }

        // Ensure window resizable when AssistantView is active (main process reacts to view-changed)
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('view-changed', 'assistant');
            }
        } catch (_) {}
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Clean up IPC listeners
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this.handlePreviousResponse) {
                ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            }
            if (this.handleNextResponse) {
                ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            }
            if (this.handleScrollUp) {
                ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            }
            if (this.handleScrollDown) {
                ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);
            }
            // New: cleanup prefill listener
            if (this.handlePrefillTextInput) {
                ipcRenderer.removeListener('prefill-text-input', this.handlePrefillTextInput);
            }
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (textInput && textInput.value.trim()) {
            const message = textInput.value.trim();
            textInput.value = ''; // Clear input
            this.adjustTextareaHeight(textInput); // Reset height to min after sending
            await this.onSendText(message);
        }
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const textInput = this.shadowRoot?.querySelector('#textInput');
            const hasText = !!textInput && textInput.value.trim().length > 0;
            if (hasText) {
                this.handleSendText();
            } else {
                // No text: trigger screen + audio analysis using existing manual screenshot flow
                try {
                    if (window.captureManualScreenshot) {
                        window.captureManualScreenshot();
                    } else {
                        console.warn('captureManualScreenshot not available');
                    }
                } catch (err) {
                    console.warn('Failed to trigger manual screenshot analysis:', err);
                }
            }
        }
    }

    // Programmatically focus the text input
    focusTextInput() {
        const el = this.shadowRoot?.querySelector('#textInput');
        if (el) {
            el.focus();
            const len = el.value?.length || 0;
            try {
                el.setSelectionRange(len, len);
            } catch (_) {}
            // ensure height adapts when focusing
            this.adjustTextareaHeight(el);
        }
    }

    // New: prefill text area with provided content and focus
    prefillTextInput(text) {
        const el = this.shadowRoot?.querySelector('#textInput');
        if (!el) return;
        el.value = (text || '').trim();
        this.adjustTextareaHeight(el);
        // Intentionally no auto-focus
    }

    handleTextInput(e) {
        // Auto-adjust height with a capped expansion for large pastes
        const el = e?.target || this.shadowRoot.querySelector('#textInput');
        if (!el) return;
        requestAnimationFrame(() => this.adjustTextareaHeight(el));
    }

    adjustTextareaHeight(el = this.shadowRoot.querySelector('#textInput')) {
        if (!el) return;
        const styles = getComputedStyle(el);
        const minHeight = parseFloat(styles.minHeight) || 36;
        const maxHeight = parseFloat(styles.maxHeight) || 120;
        const initialHeight = parseFloat(styles.height) || minHeight;
        if (!el.dataset.initialHeight) {
            el.dataset.initialHeight = String(initialHeight);
        }
        // If content is cleared, snap back to the initial compact height
        if (!el.value || el.value.trim() === '') {
            el.style.height = `${el.dataset.initialHeight || initialHeight}px`;
            return;
        }
        el.style.height = 'auto';
        const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
        el.style.height = `${newHeight}px`;
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
        // Do not auto-resize on first render; keep compact initial height.
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (
            changedProperties.has('responses') ||
            changedProperties.has('currentResponseIndex') ||
            changedProperties.has('isStreaming')
        ) {
            this.updateResponseContent();
        }
        // Streaming coordination
        if (changedProperties.has('streamSession')) {
            this._handleStreamSessionChange();
        }
        if (changedProperties.has('streamDelta')) {
            this._handleStreamDeltaChange();
        }
        if (changedProperties.has('isStreaming')) {
            this._handleStreamingStateChange();
        }
        if (changedProperties.has('promptPanelOpen') && this.promptPanelOpen) {
            this.openPromptPanel();
        }
    }

    updateResponseContent() {
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            const contentToRender = this.isStreaming ? this._streamTypedText : currentResponse;
            const renderedResponse = this.renderMarkdown(contentToRender, this.isStreaming);
            container.innerHTML = renderedResponse + (this.isStreaming ? '<span class="stream-caret"></span>' : '');

            // Highlight code blocks only after stream completes (skip during streaming)
            if (this.hljs && !this.isStreaming) {
                container.querySelectorAll('pre:not(.output-block) code').forEach((el) => {
                    try {
                        this.hljs.highlightElement(el);
                    } catch (e) {
                        console.warn('highlightElement error:', e);
                    }
                });
            }

            // Keep the latest content visible during streaming
            if (this.autoScrollEnabled) this.scrollToBottom();
        } else {
        console.warn('Response container not found');
        }
    }

    // --- Streaming engine (typewriter) ---
    _beginStream() {
        // Interrupt any previous stream
        if (this._typingInterval) {
            clearInterval(this._typingInterval);
            this._typingInterval = null;
        }
        this._streamTypedText = '';
        this._streamTargetText = '';
        this._finalEventEmitted = false;
        // Start typing loop
        this._typingInterval = setInterval(() => this._applyTyping(), this._typingMs);
    }

    _endStream() {
        if (this._typingInterval) {
            clearInterval(this._typingInterval);
            this._typingInterval = null;
        }
        // After stream ends, the final response will be rendered from responses[]
        this._streamTypedText = '';
        this._streamTargetText = '';
    }

    _handleStreamSessionChange() {
        if (typeof this.streamSession === 'number' && this.streamSession !== this._currentStreamSession) {
            this._currentStreamSession = this.streamSession;
            // New stream session begins
            this._beginStream();
        }
    }

    _handleStreamDeltaChange() {
        const delta = this.streamDelta || '';
        if (this.isStreaming && delta) {
            this._streamTargetText += delta;
            // Trigger fast update to keep flow smooth
            this.updateResponseContent();
        }
    }

    _handleStreamingStateChange() {
        if (!this.isStreaming) {
            // Stream finished or interrupted
            this._endStream();
            this.updateResponseContent();
        }
    }

    _applyTyping() {
        try {
            if (!this.isStreaming) return;
            const currentLen = this._streamTypedText.length;
            const targetLen = this._streamTargetText.length;
            if (currentLen >= targetLen) return; // wait for more deltas
            const nextLen = Math.min(currentLen + this._typingCharsPerTick, targetLen);
            this._streamTypedText = this._streamTargetText.slice(0, nextLen);
            this.updateResponseContent();

            // If final response is expected and we've caught up, signal completion once
            if (this.streamIsFinal && this._streamTypedText.length === this._streamTargetText.length && !this._finalEventEmitted) {
                this._finalEventEmitted = true;
                this.dispatchEvent(new CustomEvent('stream-finished')); // parent will end streaming state
            }
        } catch (e) {
            console.warn('AssistantView _applyTyping error:', e);
        }
    }

    // Toggle handlers
    handleAutoScrollChange(e) {
        const checked = !!(e?.target?.checked);
        this.autoScrollEnabled = checked;
        try {
            localStorage.setItem('assistantAutoScroll', checked ? 'true' : 'false');
        } catch (_) {}
        if (checked) {
            this.scrollToBottom();
        }
    }

    // --- Prompt buttons logic ---
    loadPromptButtons() {
        try {
            const raw = localStorage.getItem('assistantPromptButtons');
            const arr = raw ? JSON.parse(raw) : [];
            if (Array.isArray(arr)) {
                return arr.filter(p => p && typeof p.name === 'string' && typeof p.text === 'string');
            }
        } catch (_) {}
        return [];
    }

    savePromptButtons(list) {
        try {
            localStorage.setItem('assistantPromptButtons', JSON.stringify(list || []));
        } catch (_) {}
    }

    openPromptPanel() {
        this.editablePrompts = [...this.loadPromptButtons()];
        this.requestUpdate();
    }

    closePromptPanel() {
        this.dispatchEvent(new CustomEvent('close-prompt-panel', { bubbles: true, composed: true }));
    }

    addPromptRow() {
        if ((this.editablePrompts || []).length >= 5) return;
        this.editablePrompts = [...(this.editablePrompts || []), { name: '', text: '' }];
        this.requestUpdate();
    }

    updatePromptName(idx, e) {
        const val = (e?.target?.value || '').slice(0, 60);
        const list = [...(this.editablePrompts || [])];
        if (list[idx]) list[idx].name = val;
        this.editablePrompts = list;
        this.requestUpdate();
    }

    updatePromptText(idx, e) {
        const val = (e?.target?.value || '');
        const list = [...(this.editablePrompts || [])];
        if (list[idx]) list[idx].text = val;
        this.editablePrompts = list;
        this.requestUpdate();
    }

    saveEditablePrompts() {
        const cleaned = (this.editablePrompts || [])
            .map(p => ({ name: (p.name || '').trim(), text: (p.text || '').trim() }))
            .filter(p => p.name && p.text)
            .slice(0, 5);
        this.savePromptButtons(cleaned);
        this.promptButtons = cleaned;
        this.closePromptPanel();
    }

    handlePromptButtonClick(e, idx) {
        const now = Date.now();
        if (now - (this._lastPromptClickTs || 0) < 1000) return; // debounce 1s
        this._lastPromptClickTs = now;

        const btn = e.currentTarget;
        try {
            btn.classList.add('pulse');
            setTimeout(() => btn.classList.remove('pulse'), 250);
        } catch (_) {}

        const prompt = (this.promptButtons || [])[idx];
        const text = prompt?.text || '';
        const el = this.shadowRoot?.querySelector('#textInput');
        if (!el) return;
        el.value = text.trim();
        this.adjustTextareaHeight(el);
        // Send using the same logic as typing then pressing Enter
        this.handleSendText();
    }





    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();
        // Keep prompt buttons in sync
        if (!this.promptButtons || this.promptButtons.length === 0) {
            this.promptButtons = this.loadPromptButtons();
        }

        return html`
            <div class="response-container" id="responseContainer"></div>

            <div class="text-input-container">
                <button class="nav-button" @click=${this.navigateToPreviousResponse} ?disabled=${this.currentResponseIndex <= 0}>
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                    >
                        <path d="M15 6L9 12L15 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                ${this.responses.length > 0 ? html` <span class="response-counter">${responseCounter}</span> ` : ''}

                <textarea id="textInput" rows="1" placeholder="Type a message to the AI..." @keydown=${this.handleTextKeydown} @input=${this.handleTextInput} @paste=${this.handleTextInput}></textarea>

                <button class="nav-button" @click=${this.navigateToNextResponse} ?disabled=${this.currentResponseIndex >= this.responses.length - 1}>
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                    >
                        <path d="M9 6L15 12L9 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
            </div>
            <div class="assistant-toggles">
                <label class="assistant-toggle-label">
                    <input type="checkbox" class="assistant-toggle-input" .checked=${this.autoScrollEnabled} @change=${this.handleAutoScrollChange} />
                    <span>Auto-scroll</span>
                </label>
                ${this.promptButtons && this.promptButtons.length > 0
                    ? html`<div class="prompt-buttons">
                          ${this.promptButtons.map(
                              (p, i) => html`<button class="prompt-button" @click=${e => this.handlePromptButtonClick(e, i)}>${p.name}</button>`
                          )}
                      </div>`
                    : ''}
            </div>

            ${this.promptPanelOpen
                ? html`
                      <div class="prompt-panel-overlay" @click=${e => {
                          if (e.target.classList.contains('prompt-panel-overlay')) this.closePromptPanel();
                      }}>
                          <div class="prompt-panel open" @click=${e => e.stopPropagation()}>
                              <div class="prompt-panel-header">
                                  <span class="prompt-panel-title">Configurable Prompt Buttons</span>
                                  <button class="prompt-action-button" @click=${() => this.closePromptPanel()}>Close</button>
                              </div>
                              <div class="prompt-panel-body">
                                  ${(this.editablePrompts || []).map(
                                      (p, idx) => html`
                                          <div class="prompt-row">
                                              <input type="text" placeholder="Name" .value=${p.name} @input=${e => this.updatePromptName(idx, e)} />
                                              <textarea placeholder="Prompt text" .value=${p.text} @input=${e => this.updatePromptText(idx, e)}></textarea>
                                          </div>
                                      `
                                  )}
                                  <button class="prompt-action-button add-prompt-button" @click=${() => this.addPromptRow()} ?disabled=${(this.editablePrompts || []).length >= 5}>
                                      Add prompt
                                  </button>
                              </div>
                              <div class="prompt-panel-actions">
                                  <button class="prompt-action-button" @click=${() => this.saveEditablePrompts()}>Save</button>
                              </div>
                          </div>
                      </div>
                  `
                : ''}

            <!-- Resize overlay on all edges and corners -->
            <div class="resize-overlay">
                <div class="resize-handle top" @pointerdown=${e => this._startResize(e, 'top')}></div>
                <div class="resize-handle right" @pointerdown=${e => this._startResize(e, 'right')}></div>
                <div class="resize-handle bottom" @pointerdown=${e => this._startResize(e, 'bottom')}></div>
                <div class="resize-handle left" @pointerdown=${e => this._startResize(e, 'left')}></div>
                <div class="resize-handle tl" @pointerdown=${e => this._startResize(e, 'top-left')}></div>
                <div class="resize-handle tr" @pointerdown=${e => this._startResize(e, 'top-right')}></div>
                <div class="resize-handle bl" @pointerdown=${e => this._startResize(e, 'bottom-left')}></div>
                <div class="resize-handle br" @pointerdown=${e => this._startResize(e, 'bottom-right')}></div>
            </div>
        `;
    }

    // Resize handling logic
    _startResize(e, edge) {
        if (!window.require) return;
        const { ipcRenderer } = window.require('electron');
        e.preventDefault();
        this._resizeActive = true;
        this._resizeEdge = edge;
        this._rafScheduled = false;
        this._onPointerMoveRef = ev => this._onPointerMove(ev);
        this._onPointerUpRef = ev => this._onPointerUp(ev);

        ipcRenderer
            .invoke('get-window-bounds')
            .then(bounds => {
                this._resizeStartBounds = bounds;
                this._resizeStartX = e.clientX;
                this._resizeStartY = e.clientY;
                // Capture pointer across window
                window.addEventListener('pointermove', this._onPointerMoveRef, { passive: false });
                window.addEventListener('pointerup', this._onPointerUpRef, { passive: false, once: true });
            })
            .catch(async () => {
                const size = await ipcRenderer.invoke('get-window-size');
                this._resizeStartBounds = { x: 0, y: 0, width: size.width, height: size.height };
                this._resizeStartX = e.clientX;
                this._resizeStartY = e.clientY;
                window.addEventListener('pointermove', this._onPointerMoveRef, { passive: false });
                window.addEventListener('pointerup', this._onPointerUpRef, { passive: false, once: true });
            });
    }

    _onPointerMove(ev) {
        if (!this._resizeActive || !window.require) return;
        const { ipcRenderer } = window.require('electron');
        ev.preventDefault();
        const dx = ev.clientX - (this._resizeStartX || 0);
        const dy = ev.clientY - (this._resizeStartY || 0);
        const b = this._resizeStartBounds || { x: 0, y: 0, width: 600, height: 400 };
        let x = b.x;
        let y = b.y;
        let width = b.width;
        let height = b.height;

        switch (this._resizeEdge) {
            case 'right':
                width = b.width + dx;
                break;
            case 'bottom':
                height = b.height + dy;
                break;
            case 'left':
                width = b.width - dx;
                x = b.x + dx;
                break;
            case 'top':
                height = b.height - dy;
                y = b.y + dy;
                break;
            case 'top-left':
                width = b.width - dx;
                x = b.x + dx;
                height = b.height - dy;
                y = b.y + dy;
                break;
            case 'top-right':
                width = b.width + dx;
                height = b.height - dy;
                y = b.y + dy;
                break;
            case 'bottom-left':
                width = b.width - dx;
                x = b.x + dx;
                height = b.height + dy;
                break;
            case 'bottom-right':
                width = b.width + dx;
                height = b.height + dy;
                break;
        }

        // Throttle updates using rAF
        if (!this._rafScheduled) {
            this._rafScheduled = true;
            requestAnimationFrame(() => {
                this._rafScheduled = false;
                ipcRenderer.invoke('set-window-bounds', { x, y, width, height }).catch(() => {});
            });
        }
    }

    _onPointerUp(ev) {
        ev.preventDefault();
        this._resizeActive = false;
        try {
            window.removeEventListener('pointermove', this._onPointerMoveRef);
        } catch (_) {}
    }

    // Duplicate render() removed; primary render is defined earlier in the class.
}

customElements.define('assistant-view', AssistantView);
