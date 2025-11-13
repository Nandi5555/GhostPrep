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
            width: 8px;
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
            width: 0;
            height: 0;
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
        autoFocusEnabled: { type: Boolean },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => {};
        this.isStreaming = false;
        // Syntax highlighting library instance (loaded in connectedCallback)
        this.hljs = null;
        // Load toggles from localStorage
        this.autoScrollEnabled = localStorage.getItem('assistantAutoScroll') !== 'false';
        this.autoFocusEnabled = localStorage.getItem('autoFocusOnCtrlEnter') === 'true';
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
                console.log('Markdown rendered successfully');
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.log('Marked not available, using plain text');
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
                console.log('Received navigate-previous-response message');
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                console.log('Received navigate-next-response message');
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                console.log('Received scroll-response-up message');
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
                console.log('Received scroll-response-down message');
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
        this.focusTextInput();
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
    }

    updateResponseContent() {
        console.log('updateResponseContent called');
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            console.log('Current response:', currentResponse);
            const renderedResponse = this.renderMarkdown(currentResponse, this.isStreaming);
            console.log('Rendered response:', renderedResponse);
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
            console.log('Response container not found');
        }
    }



    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();

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
                <label class="assistant-toggle-label">
                    <input type="checkbox" class="assistant-toggle-input" .checked=${this.autoFocusEnabled} @change=${this.handleAutoFocusChange} />
                    <span>Auto-focus</span>
                </label>
            </div>

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

    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();

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
}

customElements.define('assistant-view', AssistantView);
