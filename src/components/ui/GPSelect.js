import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { scrollbarStyles } from '../styles/scrollbarStyles.js';

/**
 * gp-select
 * Lightweight in-app dropdown to avoid native <select> menus (which can bypass Electron contentProtection).
 *
 * Props:
 * - value: string
 * - options: Array<{ value: string, label: string }>
 * - placeholder?: string
 *
 * Events:
 * - gp-change: { detail: { value } } (bubbles+composed)
 */
export class GPSelect extends LitElement {
    static styles = [
        scrollbarStyles,
        css`
            :host {
                display: block;
                position: relative;
                color: var(--text-color);
            }

            .trigger {
                width: 100%;
                background: var(--input-background, rgba(0, 0, 0, 0.3));
                color: var(--text-color);
                border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
                padding: 8px 10px;
                border-radius: 10px;
                font-size: 12px;
                line-height: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                cursor: pointer;
                user-select: none;
                transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
            }

            .trigger:hover {
                border-color: var(--input-hover-border, rgba(255, 255, 255, 0.22));
                background: var(--input-hover-background, var(--input-background, rgba(0, 0, 0, 0.35)));
            }

            .trigger:focus-visible {
                outline: none;
                border-color: var(--focus-border-color, #007aff);
                box-shadow: 0 0 0 3px var(--focus-box-shadow, rgba(0, 122, 255, 0.2));
            }

            .label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .chev {
                width: 14px;
                height: 14px;
                opacity: 0.85;
                pointer-events: none;
                flex: 0 0 auto;
            }

            .menu {
                position: fixed;
                z-index: 999999;
                min-width: 220px;
                max-width: 420px;
                max-height: 260px;
                overflow: auto;
                padding: 6px;
                border-radius: 14px;
                background: var(--menu-bg, rgba(12, 14, 20, 0.92));
                border: 1px solid var(--menu-border, rgba(255, 255, 255, 0.14));
                box-shadow: var(--menu-shadow, 0 18px 50px rgba(0, 0, 0, 0.55));
                backdrop-filter: blur(10px);
            }

            .item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 9px 10px;
                border-radius: 12px;
                cursor: pointer;
                border: 1px solid transparent;
                color: var(--text-color);
                font-size: 12px;
                font-weight: 600;
            }

            .item:hover {
                background: var(--menu-item-hover-bg, rgba(255, 255, 255, 0.06));
            }

            .item[aria-selected='true'] {
                background: var(--menu-item-selected-bg, linear-gradient(180deg, rgba(0, 122, 255, 0.18), rgba(0, 122, 255, 0.08)));
                border-color: var(--menu-item-selected-border, rgba(0, 122, 255, 0.30));
            }

            .check {
                width: 16px;
                height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                opacity: 0.95;
            }

            .check svg {
                width: 16px;
                height: 16px;
            }

            .scrim {
                position: fixed;
                inset: 0;
                z-index: 999998;
                background: transparent;
            }
        `,
    ];

    static properties = {
        value: { type: String },
        options: { type: Array },
        placeholder: { type: String },
        open: { type: Boolean, state: true },
        _menuRect: { type: Object, state: true },
    };

    constructor() {
        super();
        this.value = '';
        this.options = [];
        this.placeholder = 'Select…';
        this.open = false;
        this._menuRect = null;
        this._boundReposition = null;
        this._boundKeydown = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._boundReposition = () => this._reposition();
        this._boundKeydown = e => this._onKeydown(e);
        window.addEventListener('resize', this._boundReposition);
        window.addEventListener('scroll', this._boundReposition, true);
        window.addEventListener('keydown', this._boundKeydown, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('resize', this._boundReposition);
        window.removeEventListener('scroll', this._boundReposition, true);
        window.removeEventListener('keydown', this._boundKeydown, true);
    }

    _onKeydown(e) {
        if (!this.open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this._close();
        }
    }

    _toggle() {
        this.open ? this._close() : this._open();
    }

    _getFixedBase() {
        // Ancestors with `transform`/`filter`/`perspective` create a containing block for position:fixed.
        // Compute coordinates relative to the nearest such ancestor to avoid offset menus.
        let el = /** @type {any} */ (this);
        while (el) {
            const parent = el.parentElement;
            if (parent) {
                el = parent;
            } else {
                const rn = el.getRootNode?.();
                if (rn && rn.host) el = rn.host;
                else el = null;
            }
            if (el && el.nodeType === 1) {
                const cs = getComputedStyle(el);
                const transformed = cs.transform && cs.transform !== 'none';
                const filtered = cs.filter && cs.filter !== 'none';
                const perspective = cs.perspective && cs.perspective !== 'none';
                if (transformed || filtered || perspective) {
                    const rect = el.getBoundingClientRect();
                    return { rect, width: rect.width, height: rect.height };
                }
            }
        }
        return {
            rect: { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
            width: window.innerWidth,
            height: window.innerHeight,
        };
    }

    _open() {
        // Compute rect BEFORE first open render to avoid one-frame "wrong place" menu.
        const trigger = this.shadowRoot?.querySelector('.trigger');
        if (trigger) {
            const base = this._getFixedBase();
            const baseRect = base?.rect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const r = trigger.getBoundingClientRect();
            const vw = base?.width ?? (window.innerWidth || document.documentElement.clientWidth);
            const vh = base?.height ?? (window.innerHeight || document.documentElement.clientHeight);
            const width = Math.min(Math.max(r.width, 180), 420);
            const left = Math.min(Math.max(8, r.left - baseRect.left), vw - width - 8);
            const maxMenuH = 260;
            const GAP = 6;
            const EDGE = 6;
            const belowSpace = vh - (r.bottom - baseRect.top) - GAP - EDGE;
            const aboveSpace = (r.top - baseRect.top) - GAP - EDGE;
            const openDown = belowSpace >= 140 || belowSpace >= aboveSpace;
            const desiredH = this._estimateMenuHeight(maxMenuH);
            const maxHeight = Math.min(maxMenuH, openDown ? belowSpace : aboveSpace);
            const finalH = Math.min(desiredH, Math.max(80, maxHeight));

            const top = openDown
                ? (r.bottom - baseRect.top) + GAP
                : (r.top - baseRect.top) - GAP - finalH;

            this._menuRect = { top, left, width, maxHeight, openDown };
        }
        this.open = true;
        this.updateComplete.then(() => this._reposition());
    }

    _close() {
        this.open = false;
        this._menuRect = null;
    }

    _reposition() {
        if (!this.open) return;
        const trigger = this.shadowRoot?.querySelector('.trigger');
        if (!trigger) return;
        const base = this._getFixedBase();
        const baseRect = base?.rect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const r = trigger.getBoundingClientRect();
        const vw = base?.width ?? (window.innerWidth || document.documentElement.clientWidth);
        const vh = base?.height ?? (window.innerHeight || document.documentElement.clientHeight);

        const width = Math.min(Math.max(r.width, 180), 420);
        const left = Math.min(Math.max(8, r.left - baseRect.left), vw - width - 8);

        // prefer opening downward, fallback upward
        const maxMenuH = 260;
        const GAP = 6;
        const EDGE = 6;
        const belowSpace = vh - (r.bottom - baseRect.top) - GAP - EDGE;
        const aboveSpace = (r.top - baseRect.top) - GAP - EDGE;
        const openDown = belowSpace >= 160 || belowSpace >= aboveSpace;
        const maxHeight = Math.min(maxMenuH, openDown ? belowSpace : aboveSpace);

        // When opening upward we must anchor to the trigger using the ACTUAL menu height (if rendered),
        // otherwise a good estimate. This avoids "floating away" on scroll.
        const menuEl = this.shadowRoot?.querySelector('.menu');
        const actualH = menuEl ? menuEl.getBoundingClientRect().height : 0;
        const desiredH = actualH || this._estimateMenuHeight(maxMenuH);
        const finalH = Math.min(desiredH, Math.max(80, maxHeight));

        const top = openDown
            ? (r.bottom - baseRect.top) + GAP
            : (r.top - baseRect.top) - GAP - finalH;

        this._menuRect = { top, left, width, maxHeight, openDown };
    }

    _estimateMenuHeight(maxMenuH) {
        // Approximate: each item ~38px + padding (~12px)
        const count = Array.isArray(this.options) ? this.options.length : 0;
        const approx = Math.min(maxMenuH, Math.max(80, count * 38 + 12));
        return approx;
    }

    _select(v) {
        this.value = v;
        this.dispatchEvent(
            new CustomEvent('gp-change', {
                detail: { value: v },
                bubbles: true,
                composed: true,
            })
        );
        this._close();
    }

    get _selectedLabel() {
        const opt = (this.options || []).find(o => String(o.value) === String(this.value));
        return opt?.label || '';
    }

    render() {
        const label = this._selectedLabel || this.placeholder;
        const rect = this._menuRect;

        return html`
            <div
                class="trigger"
                tabindex="0"
                role="combobox"
                aria-expanded=${this.open ? 'true' : 'false'}
                aria-haspopup="listbox"
                @click=${() => this._toggle()}
                @keydown=${e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this._toggle();
                    }
                }}
            >
                <span class="label">${label}</span>
                <span class="chev" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </span>
            </div>

            ${this.open
                ? html`
                      <div class="scrim" @click=${() => this._close()}></div>
                      <div
                          class="menu"
                          role="listbox"
                          style=${rect
                              ? `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;max-height:${rect.maxHeight}px;`
                              : 'visibility:hidden;'}
                      >
                          ${(this.options || []).map(
                              o => html`
                                  <div
                                      class="item"
                                      role="option"
                                      aria-selected=${String(o.value) === String(this.value) ? 'true' : 'false'}
                                      @click=${() => this._select(o.value)}
                                  >
                                      <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${o.label}</span>
                                      <span class="check" aria-hidden="true">
                                          ${String(o.value) === String(this.value)
                                              ? html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                                  </svg>`
                                              : ''}
                                      </span>
                                  </div>
                              `
                          )}
                      </div>
                  `
                : ''}
        `;
    }
}

customElements.define('gp-select', GPSelect);
