import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { subscribeTheme } from '../../utils/theme.js';

const APP_HEADER_LOGO_SVG = new URL('../../assets/AppHeader.svg', import.meta.url).toString();
const APP_HEADER_LOGO_PNG = new URL('../../assets/AppHeader.png', import.meta.url).toString();

export class AppHeader extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
        }

        .header {
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            position: relative;
            padding: var(--header-padding);
            border: 1px solid var(--border-color);
            background: var(--header-background);
            border-radius: 999px;
            backdrop-filter: blur(8px);
            box-shadow: none;
            width: 450px;
            max-width: calc(100% - 16px);
            margin: 0 auto;
            transition: padding 0.2s ease, background-color var(--theme-transition) ease, border-color var(--theme-transition) ease, color var(--theme-transition) ease;
        }

        .header.jiggle { animation: header-jiggle 480ms ease; }
        @keyframes header-jiggle {
            0% { transform: translateY(0) rotate(0deg); }
            15% { transform: translateY(-1px) rotate(-0.4deg); }
            30% { transform: translateY(1px) rotate(0.4deg); }
            45% { transform: translateY(-1px) rotate(-0.3deg); }
            60% { transform: translateY(1px) rotate(0.3deg); }
            100% { transform: translateY(0) rotate(0deg); }
        }

        .header-title {
            flex: 1;
            font-size: var(--header-font-size);
            font-weight: 600;
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
        }

        .brand-logo {
            position: relative;
            display: inline-flex;
            align-items: center;
            height: 26px;
            width: clamp(110px, 16vw, 170px);
            flex: 0 0 auto;
        }

        .brand-logo img {
            height: 100%;
            width: 100%;
            display: block;
            object-fit: contain;
            object-position: left center;
        }

        .brand-logo .logo-base {
            opacity: 1;
        }

        .brand-logo .logo-layer {
            position: absolute;
            top: 0;
            left: 0;
            display: none;
            height: 100%;
            width: 100%;
        }

        .brand-logo .logo-left {
            clip-path: inset(0 46% 0 0);
        }

        :host-context(html[data-theme='dark']) .brand-logo .logo-layer,
        :host-context(html[data-theme='midnight']) .brand-logo .logo-layer {
            display: block;
        }

        :host-context(html[data-theme='dark']) .brand-logo .logo-left,
        :host-context(html[data-theme='midnight']) .brand-logo .logo-left {
            filter: brightness(0) invert(1);
        }

        .header-actions {
            display: flex;
            gap: var(--header-gap);
            align-items: center;
            -webkit-app-region: no-drag;
        }

        .assistant-slider {
            width: 190px;
            display: flex;
            align-items: center;
        }

        .center-actions {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            -webkit-app-region: no-drag;
            display: flex;
            align-items: center;
        }

        .primary-toggle {
            color: var(--primary-button-text, #ffffff);
            padding: 6px 16px;
            border-radius: var(--primary-button-radius, 16px);
            font-size: 15px;
            font-weight: 600;
            border: 1px solid var(--primary-border, rgba(255, 255, 255, 0.28));
            border-radius: 999px;
            background:
                linear-gradient(to bottom, var(--primary-glass-top, rgba(255, 255, 255, 0.45)) 0%, var(--primary-glass-mid, rgba(255, 255, 255, 0.24)) 38%, var(--primary-glass-bot, rgba(255, 255, 255, 0.08)) 60%, rgba(255, 255, 255, 0) 100%),
                linear-gradient(to bottom, var(--primary-gradient-top, #4b82d6) 0%, var(--primary-gradient-mid, #3a6fc1) 52%, var(--primary-gradient-bot, #2f5aa6) 100%);
            box-shadow: inset 0 1px rgba(255, 255, 255, 0.5), inset 0 -2px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.28);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.12s ease, filter 0.2s ease, background-color var(--theme-transition) ease, border-color var(--theme-transition) ease;
            font-family: 'Inter', sans-serif;
            letter-spacing: 0.2px;
            backdrop-filter: blur(8px);
        }

        .primary-toggle:hover { filter: brightness(1.06); }
        .primary-toggle:active { transform: translateY(1px); }
        .primary-toggle:disabled { opacity: 0.55; filter: none; transform: none; }

        .primary-toggle .label { font-weight: 600; }
        .primary-toggle .icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-left: 6px; }
        .primary-toggle .icon svg { width: 16px; height: 16px; }
        .primary-toggle .shortcut-icons { display: inline-flex; align-items: center; gap: 2px; margin-left: 6px; }
        .primary-toggle .shortcut-icons svg { width: 14px; height: 14px; }
        .primary-toggle .shortcut-icons svg path { stroke: currentColor; }

        .header-actions span {
            font-size: var(--header-font-size-small);
            color: var(--header-actions-color);
        }

        .button { background: var(--glass-bg); color: var(--text-color); border: 1px solid var(--glass-border); padding: var(--header-button-padding); border-radius: 10px; font-size: var(--header-font-size-small); font-weight: 500; backdrop-filter: blur(10px); box-shadow: var(--glass-shadow); transition: background-color var(--theme-transition) ease, color var(--theme-transition) ease, border-color var(--theme-transition) ease, box-shadow var(--theme-transition) ease, transform 0.12s ease; }

        .icon-button { background: var(--glass-bg); color: var(--icon-button-color); border: 1px solid var(--glass-border); padding: var(--header-icon-padding); border-radius: 10px; font-size: var(--header-font-size-small); font-weight: 500; display: flex; opacity: 0.85; backdrop-filter: blur(10px); box-shadow: var(--glass-shadow); transition: background-color var(--theme-transition) ease, color var(--theme-transition) ease, border-color var(--theme-transition) ease, box-shadow var(--theme-transition) ease, opacity 0.2s ease, transform 0.12s ease; }

        .icon-button svg {
            width: var(--icon-size);
            height: var(--icon-size);
        }

        .icon-button:hover { background: var(--glass-hover-bg); opacity: 1; }
        .icon-button:active { transform: translateY(1px); }

        .floating-close {
            position: absolute;
            right: -50px;
            top: 50%;
            transform: translateY(-50%);
            border-radius: 999px;
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            padding: var(--header-icon-padding);
            box-shadow: var(--glass-shadow);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            z-index: 2;
            transition: right 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
        }

        .button:hover {
            background: var(--hover-background);
        }

        :host([isclickthrough]) .button:hover,
        :host([isclickthrough]) .icon-button:hover {
            background: transparent;
        }

        .key {
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            margin: 0px;
        }
 /* Slider styles */
        .slider-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
        }

        .slider-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .slider-value {
            font-size: 11px;
            color: var(--success-color, #34d399);
            background: var(--success-background, rgba(52, 211, 153, 0.1));
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
            border: 1px solid var(--success-border, rgba(52, 211, 153, 0.2));
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
        }

        .slider-input {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 4px;
            border-radius: 2px;
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            outline: none;
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            cursor: default;
        }

        .slider-container .slider-input {
            flex: 1;
            width: auto;
        }

        .slider-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: default !important;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: default !important;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input:hover::-webkit-slider-thumb {
            background: var(--text-input-button-hover, #0056b3);
        }

        .slider-input:hover::-moz-range-thumb {
            background: var(--text-input-button-hover, #0056b3);
        }

        .slider-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
        }
          .slider-input {
            cursor: default !important;
        }

        .slider-input::-webkit-slider-thumb,
        .slider-input::-moz-range-thumb {
            cursor: default !important;
        }

        .connect-indicator {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            -webkit-app-region: no-drag;
        }

        .spinner {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.22);
            border-top-color: rgba(255, 255, 255, 0.92);
            animation: spin 800ms linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isInitializing: { type: Boolean },
        isConnecting: { type: Boolean },
        onStartSession: { type: Function },
        onCustomizeClick: { type: Function },
        onHelpClick: { type: Function },
        onHistoryClick: { type: Function },
        onCloseClick: { type: Function },
        onBackClick: { type: Function },
        onHideToggleClick: { type: Function },
        onCancelConnect: { type: Function },
        isClickThrough: { type: Boolean, reflect: true },
        advancedMode: { type: Boolean },
        onAdvancedClick: { type: Function },
        backgroundTransparency: { type: Number },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.isInitializing = false;
        this.isConnecting = false;
        this.onStartSession = () => {};
        this.onCustomizeClick = () => {};
        this.onHelpClick = () => {};
        this.onHistoryClick = () => {};
        this.onCloseClick = () => {};
        this.onBackClick = () => {};
        this.onHideToggleClick = () => {};
        this.onCancelConnect = () => {};
        this.isClickThrough = false;
        this.advancedMode = false;
        this.onAdvancedClick = () => {};
        this._timerInterval = null;
        this.backgroundTransparency = 0.8;
        this._jiggleActive = false;
        this._logoSrc = APP_HEADER_LOGO_SVG;
        this._unsubscribeTheme = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._startTimer();
        this.loadBackgroundTransparency();
        try {
            if (!this._unsubscribeTheme) {
                this._unsubscribeTheme = subscribeTheme(() => {
                    try { this.updateBackgroundTransparency(); } catch (_) {}
                });
            }
        } catch (_) {}
    }

    disconnectedCallback() {
        try {
            if (typeof this._unsubscribeTheme === 'function') this._unsubscribeTheme();
        } catch (_) {}
        this._unsubscribeTheme = null;
        super.disconnectedCallback();
        this._stopTimer();
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Start/stop timer based on view change
        if (changedProperties.has('currentView')) {
            if (this.currentView === 'assistant' && this.startTime) {
                this._startTimer();
            } else {
                this._stopTimer();
            }
        }

        // Start timer when startTime is set
        if (changedProperties.has('startTime')) {
            if (this.startTime && this.currentView === 'assistant') {
                this._startTimer();
            } else if (!this.startTime) {
                this._stopTimer();
            }
        }
    }

    _startTimer() {
        // Clear any existing timer
        this._stopTimer();

        // Only start timer if we're in assistant view and have a start time
        if (this.currentView === 'assistant' && this.startTime) {
            this._timerInterval = setInterval(() => {
                // Trigger a re-render by requesting an update
                this.requestUpdate();
            }, 1000); // Update every second
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
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

        return isMac
            ? html`Start Session <span class="shortcut-icons">${cmdIcon}${enterIcon}</span>`
            : html`Start Session <span class="shortcut-icons">Ctrl${enterIcon}</span>`;
    }

    getViewTitle() {
        const titles = {
            onboarding: 'Welcome to CueFlow',
            permissions: 'Permissions',
            main: 'CueFlow',
            customize: 'Customize',
            help: 'Help & Shortcuts',
            history: 'Conversation History',
            advanced: 'Advanced Tools',
            assistant: 'CueFlow',
        };
        return titles[this.currentView] || 'CueFlow';
    }

    getElapsedTime() {
        if (this.currentView === 'assistant' && this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            return `${elapsed}s`;
        }
        return '';
    }

    isNavigationView() {
        const navigationViews = ['customize', 'help', 'history', 'advanced'];
        return navigationViews.includes(this.currentView);
    }

    loadBackgroundTransparency() {
        const backgroundTransparency = localStorage.getItem('backgroundTransparency');
        if (backgroundTransparency !== null) {
            this.backgroundTransparency = parseFloat(backgroundTransparency) || 0.8;
        }
        this.updateBackgroundTransparency();
    }

    handleBackgroundTransparencyChange(e) {
        this.backgroundTransparency = parseFloat(e.target.value);
        localStorage.setItem('backgroundTransparency', this.backgroundTransparency.toString());
        this.updateBackgroundTransparency();
        this.requestUpdate();
    }

    updateBackgroundTransparency() {
        const root = document.documentElement;
        const t = Number.isFinite(this.backgroundTransparency) ? this.backgroundTransparency : 0.8;
        const clamp01 = v => Math.min(1, Math.max(0, v));
        const parseRgbTriplet = raw => {
            const s = String(raw || '').trim();
            if (!s) return null;
            const parts = s.split(/\s+/).map(n => Number.parseFloat(n)).filter(n => Number.isFinite(n));
            if (parts.length < 3) return null;
            return [parts[0], parts[1], parts[2]];
        };
        const cs = getComputedStyle(root);
        const surfaceRgb = parseRgbTriplet(cs.getPropertyValue('--theme-surface-rgb')) || [0, 0, 0];
        const panelRgb = parseRgbTriplet(cs.getPropertyValue('--theme-panel-rgb')) || surfaceRgb;
        const isLight = (surfaceRgb[0] + surfaceRgb[1] + surfaceRgb[2]) / 3 > 128;
        const rgba = (rgb, a) => `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${clamp01(a)})`;

        root.style.setProperty('--header-background', rgba(surfaceRgb, t));
        root.style.setProperty('--main-content-background', rgba(panelRgb, t));

        if (isLight) {
            root.style.setProperty('--card-background', rgba(surfaceRgb, 0.58 + 0.34 * clamp01(t)));
            root.style.setProperty('--input-background', rgba(surfaceRgb, 0.40 + 0.30 * clamp01(t)));
            root.style.setProperty('--input-focus-background', rgba(surfaceRgb, 0.54 + 0.36 * clamp01(t)));
            root.style.setProperty('--button-background', rgba(surfaceRgb, 0.18 + 0.20 * clamp01(t)));
            root.style.setProperty('--preview-video-background', `rgba(0, 0, 0, ${clamp01(0.75 + 0.25 * clamp01(t))})`);
            root.style.setProperty('--screen-option-background', rgba(surfaceRgb, 0.46 + 0.28 * clamp01(t)));
            root.style.setProperty('--screen-option-hover-background', rgba(surfaceRgb, 0.56 + 0.30 * clamp01(t)));
            root.style.setProperty('--scrollbar-background', rgba(surfaceRgb, 0.10 + 0.12 * clamp01(t)));
        } else {
            root.style.setProperty('--card-background', `rgba(255, 255, 255, ${clamp01(t * 0.05)})`);
            root.style.setProperty('--input-background', rgba(surfaceRgb, t * 0.375));
            root.style.setProperty('--input-focus-background', rgba(surfaceRgb, t * 0.625));
            root.style.setProperty('--button-background', rgba(surfaceRgb, t * 0.625));
            root.style.setProperty('--preview-video-background', `rgba(0, 0, 0, ${clamp01(t * 1.05)})`);
            root.style.setProperty('--screen-option-background', rgba(surfaceRgb, t * 0.5));
            root.style.setProperty('--screen-option-hover-background', rgba(surfaceRgb, t * 0.75));
            root.style.setProperty('--scrollbar-background', rgba(surfaceRgb, t * 0.5));
        }
    }

    _handleLogoError() {
        if (this._logoSrc === APP_HEADER_LOGO_PNG) return;
        this._logoSrc = APP_HEADER_LOGO_PNG;
        this.requestUpdate();
    }

    render() {
        const elapsedTime = this.getElapsedTime();
        const viewTitle = this.getViewTitle();
        const showBrandLogo = viewTitle === 'CueFlow';
        const logoSrc = this._logoSrc || APP_HEADER_LOGO_SVG;
        const showConnecting = !!this.isConnecting || !!this.isInitializing;

        return html`
            <div class="header ${this._jiggleActive ? 'jiggle' : ''}">
                <div class="header-title">
                    ${showBrandLogo
                        ? (showConnecting
                            ? html`
                                  <span class="connect-indicator">
                                      <span class="spinner" aria-label="Connecting"></span>
                                      <button class="icon-button" @click=${() => this.onCancelConnect()} title="Stop connecting">
                                          <?xml version="1.0" encoding="UTF-8"?><svg
                                              width="24px"
                                              height="24px"
                                              stroke-width="1.7"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              xmlns="http://www.w3.org/2000/svg"
                                              color="currentColor"
                                          >
                                              <path d="M8 8H16V16H8V8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>
                                          </svg>
                                      </button>
                                  </span>
                              `
                            : html`
                                  <span class="brand-logo">
                                      <img class="logo-base" src=${logoSrc} width="170" height="26" alt="CueFlow" draggable="false" @error=${() => this._handleLogoError()} />
                                      <img class="logo-layer logo-left" src=${logoSrc} width="170" height="26" alt="" aria-hidden="true" draggable="false" />
                                  </span>
                              `)
                        : viewTitle}
                </div>
                ${this.currentView === 'main'
                    ? html`
                          <div class="center-actions">
                              <button
                                  class="primary-toggle"
                                  type="button"
                                  ?disabled=${this.isInitializing || this.isConnecting}
                                  @click=${() => this.onStartSession()}
                                  title="Start Session"
                              >
                                  ${this.getStartButtonText()}
                              </button>
                          </div>
                      `
                    : ''}
                <div class="header-actions">
                    ${this.currentView === 'assistant'
                        ? html`
                              <div class="assistant-slider">
                                  <div class="slider-container">
                                      <input
                                          type="range"
                                          class="slider-input"
                                          min="0"
                                          max="1"
                                          step="0.01"
                                      .value=${this.backgroundTransparency}
                                      @input=${this.handleBackgroundTransparencyChange}
                                  />
                                      <span class="slider-value">${Math.round((Number.isFinite(this.backgroundTransparency) ? this.backgroundTransparency : 0.8) * 100)}%</span>
                                  </div>
                              </div>
                              <button @click=${this.onCloseClick} class="icon-button window-close">
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `
                        : ''}
                    ${this.currentView === 'main'
                        ? html`
                              <button class="icon-button" @click=${this.onHistoryClick}>
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M12 21V7C12 5.89543 12.8954 5 14 5H21.4C21.7314 5 22 5.26863 22 5.6V18.7143"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                      ></path>
                                      <path
                                          d="M12 21V7C12 5.89543 11.1046 5 10 5H2.6C2.26863 5 2 5.26863 2 5.6V18.7143"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                      ></path>
                                      <path d="M14 19L22 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
                                      <path d="M10 19L2 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
                                      <path
                                          d="M12 21C12 19.8954 12.8954 19 14 19"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M12 21C12 19.8954 11.1046 19 10 19"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                              ${this.advancedMode
                                  ? html`
                                        <button class="icon-button" @click=${this.onAdvancedClick} title="Advanced Tools">
                                            <?xml version="1.0" encoding="UTF-8"?><svg
                                                width="24px"
                                                stroke-width="1.7"
                                                height="24px"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                color="currentColor"
                                            >
                                                <path d="M18.5 15L5.5 15" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>
                                                <path
                                                    d="M16 4L8 4"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M9 4.5L9 10.2602C9 10.7376 8.82922 11.1992 8.51851 11.5617L3.48149 17.4383C3.17078 17.8008 3 18.2624 3 18.7398V19C3 20.1046 3.89543 21 5 21L19 21C20.1046 21 21 20.1046 21 19V18.7398C21 18.2624 20.8292 17.8008 20.5185 17.4383L15.4815 11.5617C15.1708 11.1992 15 10.7376 15 10.2602L15 4.5"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M12 9.01L12.01 8.99889"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M11 2.01L11.01 1.99889"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                            </svg>
                                        </button>
                                    `
                                  : ''}
                              <button class="icon-button" @click=${this.onCustomizeClick}>
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                              <button class="icon-button" @click=${this.onHelpClick}>
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M9 9C9 5.49997 14.5 5.5 14.5 9C14.5 11.5 12 10.9999 12 13.9999"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M12 18.01L12.01 17.9989"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `
                        : ''}
                    ${this.currentView !== 'assistant'
                        ? html`
                              <button
                                  @click=${this.currentView === 'main' ? this.onHideToggleClick : this.isNavigationView() ? this.onBackClick : this.onCloseClick}
                                  class="icon-button window-close"
                                  title=${this.currentView === 'main' ? `Hide (${window.cheddar?.isMacOS ? 'Cmd' : 'Ctrl'}+\\)` : 'Close'}
                              >
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `
                        : ''}
                </div>
            </div>
        `;
    }
}

customElements.define('app-header', AppHeader);
