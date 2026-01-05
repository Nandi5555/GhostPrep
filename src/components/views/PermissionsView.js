import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class PermissionsView extends LitElement {
    static styles = css`
        * {
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                'Segoe UI',
                Roboto,
                sans-serif;
            cursor: default;
            user-select: none;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :host {
            display: block;
            height: 100%;
            width: 100%;
            position: fixed;
            top: 0;
            left: 0;
            overflow: hidden;
        }

        .wrap {
            position: relative;
            width: 100%;
            height: 100%;
            background: rgb(var(--theme-surface-rgb, 0 0 0));
            overflow: hidden;
        }

        .gradient {
            position: absolute;
            inset: 0;
            background: radial-gradient(1200px 600px at 25% 10%, rgba(60, 140, 255, 0.18), transparent 55%),
                radial-gradient(900px 500px at 80% 30%, rgba(250, 110, 78, 0.16), transparent 55%),
                radial-gradient(700px 500px at 50% 95%, rgba(140, 255, 200, 0.1), transparent 55%);
            filter: blur(0px);
            z-index: 0;
        }

        .card {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: min(560px, calc(100% - 32px));
            border-radius: 16px;
            background: var(--menu-bg);
            border: 1px solid var(--menu-border);
            box-shadow: var(--menu-shadow);
            padding: 22px;
            z-index: 1;
            color: var(--text-color);
        }

        .title {
            font-size: 22px;
            font-weight: 650;
            line-height: 1.2;
            margin-bottom: 8px;
            color: var(--text-color);
        }

        .sub {
            font-size: 13px;
            line-height: 1.45;
            color: var(--description-color);
            margin-bottom: 16px;
        }

        .rows {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 14px;
        }

        .row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 12px;
            border-radius: 12px;
            border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
            background: var(--glass-bg, rgba(255, 255, 255, 0.03));
        }

        .left {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
        }

        .label {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
        }

        .desc {
            font-size: 12px;
            color: var(--description-color);
            line-height: 1.35;
        }

        .right {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }

        .pill {
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 650;
            border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
            color: var(--text-color);
            background: var(--glass-bg, rgba(255, 255, 255, 0.06));
        }

        .pill.ok {
            border-color: var(--success-border, rgba(52, 211, 153, 0.25));
            background: var(--success-background, rgba(52, 211, 153, 0.12));
            color: var(--success-color, #34d399);
        }

        .pill.bad {
            border-color: var(--warning-border, rgba(251, 191, 36, 0.22));
            background: var(--warning-background, rgba(251, 191, 36, 0.10));
            color: var(--warning-color, #fbbf24);
        }

        .btn {
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
            background: var(--glass-bg, rgba(255, 255, 255, 0.06));
            color: var(--text-color);
            font-size: 12px;
            font-weight: 650;
            cursor: pointer;
            transition: all 120ms ease;
        }

        .btn:hover {
            background: var(--glass-hover-bg, rgba(255, 255, 255, 0.10));
            border-color: var(--input-hover-border, rgba(255, 255, 255, 0.20));
        }

        .btn.primary {
            background: var(--highlight-bg-color, rgba(250, 110, 78, 0.16));
            border-color: var(--highlight-color, #fa6e4e);
        }

        .btn.primary:hover {
            background: var(--highlight-bg-color, rgba(250, 110, 78, 0.22));
            border-color: var(--highlight-color, #fa6e4e);
        }

        .btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }

        .steps {
            margin-top: 10px;
            border-top: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
            padding-top: 12px;
            color: var(--description-color);
            font-size: 12px;
            line-height: 1.5;
        }

        .steps .h {
            color: var(--text-color);
            font-weight: 650;
            margin-bottom: 6px;
        }

        .footer {
            margin-top: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .hint {
            font-size: 12px;
            color: var(--description-color);
            line-height: 1.4;
        }
    `;

    static properties = {
        permissionStatus: { type: Object },
        onAllGranted: { type: Function },
        showContinue: { type: Boolean },
        onContinue: { type: Function },
        showBack: { type: Boolean },
        onBack: { type: Function },
    };

    constructor() {
        super();
        this.permissionStatus = null;
        this.onAllGranted = () => {};
        this.showContinue = false;
        this.onContinue = () => {};
        this.showBack = false;
        this.onBack = () => {};
        this._pollTimer = null;
        this._busyMic = false;
        this._busyScreen = false;
        this._winAutoAttempted = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._startPoll();
        try {
            const isMac = navigator.platform.includes('Mac');
            const isWin = navigator.platform.toLowerCase().includes('win');
            const windowsPermissionFlowEnabled = isWin && (localStorage.getItem('windowsPermissionFlowEnabled') === 'true');
            if (!isMac && windowsPermissionFlowEnabled && !this._winAutoAttempted) {
                this._winAutoAttempted = true;
                setTimeout(async () => {
                    try {
                        if (localStorage.getItem('windowsMicGranted') !== 'true') await this._requestMicrophone();
                    } catch (_) {}
                    try {
                        if (localStorage.getItem('windowsScreenGranted') !== 'true') await this._requestScreen();
                    } catch (_) {}
                }, 250);
            }
        } catch (_) {}
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopPoll();
    }

    _startPoll() {
        this._stopPoll();
        this._refresh();
        this._pollTimer = setInterval(() => this._refresh(), 900);
    }

    _stopPoll() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    }

    async _refresh() {
        try {
            const isMac = navigator.platform.includes('Mac');
            const isWin = navigator.platform.toLowerCase().includes('win');
            const windowsPermissionFlowEnabled = isWin && (localStorage.getItem('windowsPermissionFlowEnabled') === 'true');

            let res = null;
            if (isMac) {
                if (!window.require) return;
                const { ipcRenderer } = window.require('electron');
                res = await ipcRenderer.invoke('get-permission-status');
            } else if (windowsPermissionFlowEnabled) {
                const mic = localStorage.getItem('windowsMicGranted') === 'true';
                const scr = localStorage.getItem('windowsScreenGranted') === 'true';
                res = {
                    success: true,
                    platform: 'win32',
                    supported: true,
                    permissions: {
                        microphone: mic ? 'granted' : 'denied',
                        screenRecording: scr ? 'granted' : 'denied',
                    },
                    allGranted: mic && scr,
                };
            } else {
                return;
            }

            this.permissionStatus = res;
            if (res && res.success && res.allGranted) {
                try {
                    this.onAllGranted?.();
                } catch (_) {}
            }
            this.requestUpdate();
        } catch (_) {}
    }

    _statusText(v) {
        const s = String(v || 'unknown');
        if (s === 'granted') return 'Granted';
        if (s === 'denied') return 'Denied';
        if (s === 'not-determined') return 'Not set';
        if (s === 'restricted') return 'Restricted';
        return 'Unknown';
    }

    _statusClass(v) {
        const s = String(v || '');
        if (s === 'granted') return 'ok';
        if (s === 'denied' || s === 'restricted') return 'bad';
        if (s === 'not-determined') return 'bad';
        return 'bad';
    }

    async _openMacPrivacyAnchor(anchor) {
        try {
            if (!window.require) return;
            const { ipcRenderer } = window.require('electron');
            const url = `x-apple.systempreferences:com.apple.preference.security?${anchor}`;
            await ipcRenderer.invoke('open-external', url);
        } catch (_) {}
    }

    async _requestMicrophone() {
        if (this._busyMic) return;
        this._busyMic = true;
        try {
            const isMac = navigator.platform.includes('Mac');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                try {
                    stream.getTracks().forEach(t => {
                        try { t.stop(); } catch (_) {}
                    });
                } catch (_) {}
                if (!isMac) {
                    try { localStorage.setItem('windowsMicGranted', 'true'); } catch (_) {}
                }
            } catch (_) {
                if (isMac && window.require) {
                    try {
                        const { ipcRenderer } = window.require('electron');
                        await ipcRenderer.invoke('request-microphone-permission');
                    } catch (_) {}
                }
            }
        } catch (_) {}
        this._busyMic = false;
        await this._refresh();
    }

    async _requestScreen() {
        if (this._busyScreen) return;
        this._busyScreen = true;
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            try {
                stream.getTracks().forEach(t => {
                    try { t.stop(); } catch (_) {}
                });
            } catch (_) {}
            try { localStorage.setItem('windowsScreenGranted', 'true'); } catch (_) {}
        } catch (_) {}
        this._busyScreen = false;
        await this._refresh();
    }

    render() {
        const p = this.permissionStatus && this.permissionStatus.permissions ? this.permissionStatus.permissions : {};
        const isMac = navigator.platform.includes('Mac');

        const mic = p.microphone || 'unknown';
        const scr = p.screenRecording || 'unknown';

        const needsMic = mic !== 'granted';
        const needsScr = scr !== 'granted';
        const allGranted = !needsMic && !needsScr;

        // Windows permission gating is opt-in so macOS behavior stays isolated by default.
        const windowsPermissionFlowEnabled = !isMac && (localStorage.getItem('windowsPermissionFlowEnabled') === 'true');
        const showUi = isMac || windowsPermissionFlowEnabled;

        if (!showUi) {
            return html`
                <div class="wrap">
                    <div class="gradient"></div>
                    <div class="card">
                        <div class="title">Permissions</div>
                        <div class="sub">
                            Permission gating is only enforced on macOS. To enable Windows permission gating, set
                            windowsPermissionFlowEnabled=true in localStorage.
                        </div>
                        <div class="footer">
                            <div class="hint">You can continue without permission gating on this platform.</div>
                            <div class="right">
                                ${this.showBack ? html`<button class="btn" @click=${() => this.onBack?.()}>Back</button>` : ''}
                                ${this.showContinue ? html`<button class="btn primary" @click=${() => this.onContinue?.()}>Continue</button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        return html`
            <div class="wrap">
                <div class="gradient"></div>
                <div class="card">
                    <div class="title">Let’s get you set up</div>
                    <div class="sub">
                        CueFlow needs access to your microphone and screen recording to function correctly. You can’t proceed until both are enabled.
                    </div>

                    <div class="rows">
                        <div class="row">
                            <div class="left">
                                <div class="label">Microphone</div>
                                <div class="desc">Allow CueFlow to access your microphone.</div>
                            </div>
                            <div class="right">
                                <div class="pill ${this._statusClass(mic)}">${this._statusText(mic)}</div>
                                <button class="btn primary" ?disabled=${!needsMic || this._busyMic} @click=${() => this._requestMicrophone()}>
                                    Grant Access
                                </button>
                                ${isMac
                                    ? html`<button class="btn" @click=${() => this._openMacPrivacyAnchor('Privacy_Microphone')}>Open Settings</button>`
                                    : ''}
                            </div>
                        </div>

                        <div class="row">
                            <div class="left">
                                <div class="label">Screen Recording</div>
                                <div class="desc">Allow CueFlow to capture your screen for AI context (CueFlow UI is excluded).</div>
                            </div>
                            <div class="right">
                                <div class="pill ${this._statusClass(scr)}">${this._statusText(scr)}</div>
                                <button class="btn primary" ?disabled=${!needsScr || this._busyScreen} @click=${() => this._requestScreen()}>
                                    Grant Access
                                </button>
                                ${isMac
                                    ? html`<button class="btn" @click=${() => this._openMacPrivacyAnchor('Privacy_ScreenCapture')}>Open Settings</button>`
                                    : ''}
                            </div>
                        </div>
                    </div>

                    <div class="steps">
                        <div class="h">How to enable on macOS</div>
                        <div>1) Click Open Settings next to the missing permission.</div>
                        <div>2) Enable CueFlow under Privacy & Security.</div>
                        <div>3) If prompted, quit and re-open the app after changing Screen Recording.</div>
                    </div>

                    <div class="footer">
                        <div class="hint">
                            Current status: ${allGranted ? 'All required permissions granted.' : 'Waiting for required permissions.'}
                        </div>
                        <div class="right">
                            ${this.showBack ? html`<button class="btn" @click=${() => this.onBack?.()}>Back</button>` : ''}
                            <button class="btn" @click=${() => this._refresh()}>Refresh</button>
                            ${this.showContinue
                                ? html`<button class="btn primary" ?disabled=${!allGranted} @click=${() => this.onContinue?.()}>Continue</button>`
                                : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('permissions-view', PermissionsView);
