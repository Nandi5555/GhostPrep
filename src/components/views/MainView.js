import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class MainView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        .welcome {
            font-size: 24px;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .center-wrap {
            width: 100%;
            max-width: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .brand {
            font-weight: 750;
        }

        .input-group {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            justify-content: center;
        }

        .input-group input {
            flex: 1;
        }

        input {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 10px 14px;
            width: 100%;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s ease;
        }

        input:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        input::placeholder {
            color: var(--placeholder-color);
        }

        /* Red blink animation for empty API key */
        input.api-key-error {
            animation: blink-red 1s ease-in-out;
            border-color: var(--danger-color, #ff4444);
        }

        @keyframes blink-red {
            0%,
            100% {
                border-color: var(--button-border);
                background: var(--input-background);
            }
            25%,
            75% {
                border-color: var(--danger-color, #ff4444);
                background: var(--danger-background, rgba(255, 68, 68, 0.1));
            }
            50% {
                border-color: var(--danger-border, #ff6666);
                background: var(--danger-background, rgba(255, 68, 68, 0.15));
            }
        }

        .start-button {
            color: var(--primary-button-text, #ffffff);
            padding: 9px 20px;
            border-radius: 999px;
            font-size: 15px;
            font-weight: 600;
            border: 1px solid var(--primary-border, rgba(255, 255, 255, 0.28));
            background:
                linear-gradient(
                    to bottom,
                    var(--primary-glass-top, rgba(255, 255, 255, 0.45)) 0%,
                    var(--primary-glass-mid, rgba(255, 255, 255, 0.24)) 38%,
                    var(--primary-glass-bot, rgba(255, 255, 255, 0.08)) 60%,
                    rgba(255, 255, 255, 0) 100%
                ),
                linear-gradient(
                    to bottom,
                    var(--primary-gradient-top, #4b82d6) 0%,
                    var(--primary-gradient-mid, #3a6fc1) 52%,
                    var(--primary-gradient-bot, #2f5aa6) 100%
                );
            box-shadow: inset 0 1px rgba(255, 255, 255, 0.5), inset 0 -2px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.28);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.12s ease, filter 0.2s ease;
            letter-spacing: 0.2px;
            white-space: nowrap;
            backdrop-filter: blur(8px);
        }

        .start-button:hover { filter: brightness(1.06); }
        .start-button:active { transform: translateY(1px); }

        .start-button.initializing {
            opacity: 0.5;
        }

        .start-button.initializing:hover { filter: brightness(1.0); }

        .shortcut-icons {
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 4px;
        }

        .shortcut-icons svg {
            width: 14px;
            height: 14px;
        }

        .shortcut-icons svg path {
            stroke: currentColor;
        }

        .description {
            color: var(--description-color);
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.5;
        }

        .link {
            color: var(--link-color);
            text-decoration: underline;
            cursor: pointer;
        }

        .shortcut-hint {
            color: var(--description-color);
            font-size: 11px;
            opacity: 0.8;
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            width: 100%;
            max-width: none;
        }

        .toast {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 18px;
            border-radius: 12px;
            color: var(--text-color);
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
            backdrop-filter: blur(12px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 300ms ease, transform 300ms ease;
        }
        .toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .toast.hide {
            opacity: 0;
            transform: translateX(-50%) translateY(-6px);
        }

        .toast.error {
            background: var(--danger-background);
            border-color: var(--danger-border);
            color: var(--danger-text);
        }
        .toast-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .toast-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            color: var(--danger-color);
        }
        
    `;

    static properties = {
        onStart: { type: Function },
        isInitializing: { type: Boolean },
        showApiKeyError: { type: Boolean },
        toastText: { type: String },
        toastState: { type: String },
        toastType: { type: String },
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.isInitializing = false;
        this.showApiKeyError = false;
        this.boundKeydownHandler = this.handleKeydown.bind(this);
        this.toastText = '';
        this.toastState = 'hide';
        this.toastType = 'info';
        this._toastTimer = null;
    }

    connectedCallback() {
        super.connectedCallback();
        window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
            this.isInitializing = isInitializing;
        });

        // Add keyboard event listener for Ctrl+Enter (or Cmd+Enter on Mac)
        document.addEventListener('keydown', this.boundKeydownHandler);

        // Resize window for this view
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.electron?.ipcRenderer?.removeAllListeners('session-initializing');
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }

    handleKeydown(e) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isStartShortcut = isMac ? e.metaKey && e.key === 'Enter' : e.ctrlKey && e.key === 'Enter';

        if (isStartShortcut) {
            e.preventDefault();
            this.handleStartClick();
        }
    }

    handleInput(e) {
        // Keys are configured in Customize → AI Providers (Deepgram + OpenAI).
        // Keep this handler as a no-op to preserve layout without storing legacy keys.
        if (this.showApiKeyError) this.showApiKeyError = false;
    }

    handleStartClick() {
        if (this.isInitializing) {
            return;
        }
        this.onStart();
    }


    handleResetOnboarding() {
        localStorage.removeItem('onboardingCompleted');
        // Refresh the page to trigger onboarding
        window.location.reload();
    }

    // Layout mode removed: compact is always-on.

    // Method to trigger the red blink animation
    triggerApiKeyError() {
        this.showApiKeyError = true;
        // Remove the error class after 1 second
        setTimeout(() => {
            this.showApiKeyError = false;
        }, 1000);
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
        }, 3000);
        this.requestUpdate();
    }

    dismissToast() {
        this.toastState = 'hide';
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
            this._toastTimer = null;
        }
        this.requestUpdate();
    }

    getStartButtonText() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        const cmdIcon = html`<svg width="14px" height="14px" viewBox="0 0 24 24" stroke-width="2" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M15 6V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path
                d="M9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9H18C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
            <path
                d="M9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.3431 4.34315 15 6 15H18C19.6569 15 21 16.3431 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
        </svg>`;

        const enterIcon = html`<svg width="14px" height="14px" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M10.25 19.25L6.75 15.75L10.25 12.25"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
            <path
                d="M6.75 15.75H12.75C14.9591 15.75 16.75 13.9591 16.75 11.75V4.75"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
        </svg>`;

        if (isMac) {
            return html`Start Session <span class="shortcut-icons">${cmdIcon}${enterIcon}</span>`;
        } else {
            return html`Start Session <span class="shortcut-icons">Ctrl${enterIcon}</span>`;
        }
    }

    render() {
        return html`
            <div class="toast ${this.toastState} ${this.toastType}">
                <div class="toast-content" role="alert" aria-live="polite">
                    <span class="toast-icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 292.146 292.146" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fill="currentColor" d="M265.818,26.328c-35.103-35.104-92.017-35.104-127.12,0c-23.7,23.7-31.374,57.337-23.073,87.496L7.057,222.391
    c-2.456,2.456-3.933,5.725-4.152,9.19l-2.876,45.386c-0.259,4.093,1.253,8.098,4.152,10.997c2.899,2.899,6.905,4.412,10.997,4.152
    l45.386-2.876c3.466-0.22,6.734-1.696,9.19-4.153l7.651-7.65c3.987-3.987,5.672-9.727,4.473-15.237l-3.859-17.735
    c-0.259-1.191,0.105-2.432,0.967-3.294c0.862-0.862,2.103-1.227,3.294-0.967l17.735,3.86c5.509,1.199,11.249-0.486,15.236-4.473
    c3.987-3.987,5.672-9.727,4.473-15.236l-3.859-17.734c-0.259-1.191,0.105-2.432,0.967-3.294c0.862-0.862,2.103-1.227,3.294-0.967
    l17.735,3.86c5.509,1.199,11.249-0.486,15.236-4.473l25.224-25.224c30.16,8.303,63.797,0.628,87.497-23.072
    C300.922,118.346,300.922,61.431,265.818,26.328z M119.566,166.925l-71.771,71.771c-1.953,1.952-4.512,2.929-7.071,2.929
    s-5.118-0.977-7.071-2.929c-3.905-3.905-3.905-10.237,0-14.142l71.771-71.771c3.906-3.904,10.236-3.904,14.143,0
    C123.471,156.687,123.471,163.019,119.566,166.925z M228.122,115.752c-14.284,14.284-37.445,14.284-51.729,0
    c-14.283-14.282-14.283-37.443,0.002-51.728c14.282-14.283,37.443-14.283,51.726,0C242.405,78.308,242.405,101.47,228.122,115.752z"/>
                        </svg>
                    </span>
                    <span>${this.toastText}</span>
                </div>
            </div>
            <div class="center-wrap">
                <div class="welcome">Welcome to <span class="brand">CueFlow</span></div>

                <div class="input-group">
                    <button @click=${this.handleStartClick} class="start-button ${this.isInitializing ? 'initializing' : ''}">
                        ${this.getStartButtonText()}
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);
