import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { scrollbarStyles } from '../styles/scrollbarStyles.js';
import { buttonStyles } from '../styles/uiStyles.js';
import {
  getPrompts,
  addPrompt,
  updatePrompt,
  deletePrompt,
  getActivePrompt,
  setActivePrompt,
  migrateFromLegacyKey,
} from '../../utils/promptLibrary.js';

export class PromptLibraryModal extends LitElement {
  static styles = [
    scrollbarStyles,
    buttonStyles,
    css`
    :host {
      position: fixed;
      inset: 0;
      display: none;
      z-index: 1000;
    }
    :host([open]) {
      display: block;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: var(--overlay-bg, rgba(0, 0, 0, 0.52));
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal {
      width: 860px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 40px);
      background: var(--menu-bg);
      border: 1px solid var(--menu-border);
      border-radius: 18px;
      box-shadow: var(--menu-shadow);
      backdrop-filter: blur(10px);
      display: grid;
      grid-template-columns: 280px 1fr;
      overflow: hidden;
      position: relative;
    }
    .left {
      border-right: 1px solid var(--table-border, rgba(255, 255, 255, 0.10));
      padding: 14px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      background: var(--bubble-neutral-bg, rgba(255, 255, 255, 0.03));
    }
    .right {
      padding: 14px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 12px;
    }
    .titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-title {
      font-size: 14px;
      font-weight: 750;
      color: var(--text-color, #fff);
    }
    .list {
      overflow: auto;
      border-radius: 14px;
      padding: 4px;
      background: var(--input-background, rgba(0, 0, 0, 0.18));
      border: 1px solid var(--input-border, rgba(255, 255, 255, 0.08));
    }
    .list-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      cursor: pointer;
      color: var(--text-color);
      border: 1px solid transparent;
    }
    .list-item:hover {
      background: var(--menu-item-hover-bg, rgba(255, 255, 255, 0.06));
    }
    .list-item.selected {
      background: var(--menu-item-selected-bg, linear-gradient(180deg, rgba(0, 122, 255, 0.18), rgba(0, 122, 255, 0.08)));
      border-color: var(--menu-item-selected-border, rgba(0, 122, 255, 0.28));
    }
    .tick {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.25));
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-color);
      background: var(--button-background, rgba(255, 255, 255, 0.04));
    }
    .tick.active {
      border-color: var(--success-border, rgba(52, 211, 153, 0.5));
      color: var(--success-color, #34d399);
      background: var(--success-background, rgba(52, 211, 153, 0.15));
    }
    .form-label {
      font-weight: 500;
      font-size: 12px;
      color: var(--label-color, rgba(255, 255, 255, 0.9));
    }
    .form-control {
      background: var(--input-background, rgba(0, 0, 0, 0.3));
      color: var(--text-color);
      border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
      padding: 8px 10px;
      border-radius: 12px;
      font-size: 12px;
    }
    .form-control:focus {
      outline: none;
      border-color: var(--focus-border-color, #007aff);
      box-shadow: 0 0 0 3px var(--focus-box-shadow, rgba(0, 122, 255, 0.2));
    }
    .actions {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .left-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .right-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    /* Confirmation overlay inside modal (content-protection friendly) */
    .confirm-overlay {
      position: absolute;
      inset: 0;
      background: var(--overlay-inner-bg, rgba(0, 0, 0, 0.45));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .confirm-card {
      width: 420px;
      max-width: calc(100% - 40px);
      background: var(--popover-bg, rgba(25, 25, 25, 0.98));
      border: 1px solid var(--popover-border, rgba(255, 255, 255, 0.15));
      border-radius: 10px;
      box-shadow: var(--popover-shadow, 0 8px 30px rgba(0, 0, 0, 0.45));
      padding: 14px;
      display: grid;
      gap: 10px;
    }
    .confirm-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #fff);
    }
    .confirm-text {
      font-size: 12px;
      color: var(--description-color, rgba(255,255,255,0.75));
    }
    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
  ];

  static properties = {
    open: { type: Boolean, reflect: true },
    prompts: { type: Array },
    selectedId: { type: String },
    draftName: { type: String },
    draftContent: { type: String },
    _dirty: { type: Boolean },
    deleteConfirmOpen: { type: Boolean },
    unsavedConfirmOpen: { type: Boolean },
    unsavedTargetId: { type: String },
    searchQuery: { type: String },
  };

  constructor() {
    super();
    this.open = false;
    this.prompts = [];
    this.selectedId = '';
    this.draftName = '';
    this.draftContent = '';
    this._dirty = false;
    this.deleteConfirmOpen = false;
    this.unsavedConfirmOpen = false;
    this.unsavedTargetId = '';
    this.searchQuery = '';
  }

  connectedCallback() {
    super.connectedCallback();
    try { migrateFromLegacyKey(); } catch (_) {}
    this.reload();
    const active = getActivePrompt();
    if (active) {
      this.select(active.id);
    } else {
      // Fresh install UX: open editor even if no prompts exist, without creating one until Save.
      this.startDraft();
    }
  }

  reload() {
    this.prompts = getPrompts();
    this.requestUpdate();
  }

  getFilteredPrompts() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) return this.prompts;
    return (this.prompts || []).filter(p => String(p.name || '').toLowerCase().includes(q));
  }

  select(id) {
    if (this._dirty) {
      this.unsavedTargetId = id;
      this.unsavedConfirmOpen = true;
      return;
    }

    this.selectedId = id;
    if (id === '__draft__') {
      this.draftName = '';
      this.draftContent = '';
      this._dirty = false;
      return;
    }
    const p = this.prompts.find(x => x.id === id);
    if (p) {
      this.draftName = p.name || '';
      this.draftContent = p.content || '';
      this._dirty = false;
    }
  }

  startDraft() {
    this.selectedId = '__draft__';
    this.draftName = '';
    this.draftContent = '';
    this._dirty = false;
  }

  addNew() {
    // UI-only: create a draft editor without persisting until Save
    if (this._dirty) {
      this.unsavedTargetId = '__draft__';
      this.unsavedConfirmOpen = true;
      return;
    }
    this.startDraft();
  }

  saveCurrent() {
    if (!this.selectedId) return;
    const name = (this.draftName || '').trim() || 'New Prompt';
    const content = this.draftContent || '';

    if (this.selectedId === '__draft__') {
      const created = addPrompt({ name, content });
      this.reload();
      this._dirty = false;
      this.select(created.id);
      this.dispatchEvent(new CustomEvent('prompt-saved', { detail: { id: created.id }, bubbles: true, composed: true }));
      return;
    }

    updatePrompt(this.selectedId, { name, content });
    this.reload();
    this._dirty = false;
    this.dispatchEvent(new CustomEvent('prompt-saved', { detail: { id: this.selectedId }, bubbles: true, composed: true }));
  }

  deleteCurrent() {
    if (!this.selectedId) return;
    this.deleteConfirmOpen = true;
  }

  performDelete() {
    if (!this.selectedId) return;
    const deletingId = this.selectedId;
    if (deletingId === '__draft__') {
      this.deleteConfirmOpen = false;
      this.startDraft();
      return;
    }
    deletePrompt(deletingId);
    this.deleteConfirmOpen = false;
    this.reload();
    if (this.prompts.length > 0) {
      this._dirty = false;
      this.select(this.prompts[0].id);
    } else {
      this.startDraft();
    }
    this.dispatchEvent(new CustomEvent('prompt-deleted', { bubbles: true, composed: true }));
  }

  confirmSaveAndSwitch() {
    if (!this.unsavedConfirmOpen) return;
    const target = this.unsavedTargetId;
    this.saveCurrent();
    this.unsavedConfirmOpen = false;
    this.unsavedTargetId = '';
    this.select(target);
  }

  confirmSwitchWithoutSaving() {
    if (!this.unsavedConfirmOpen) return;
    const target = this.unsavedTargetId;
    this._dirty = false;
    this.unsavedConfirmOpen = false;
    this.unsavedTargetId = '';
    this.select(target);
  }

  setActive() {
    if (!this.selectedId) return;
    // Ensure the current draft is saved before setting active
    if (this._dirty) this.saveCurrent();
    if (this.selectedId === '__draft__') {
      // saveCurrent() will convert draft into a real prompt and select it
      if (this.selectedId === '__draft__') return;
    }
    setActivePrompt(this.selectedId);
    this.reload();
  }

  close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render() {
    const active = getActivePrompt();
    const activeId = active?.id || '';
    const isDraft = this.selectedId === '__draft__';
    const filtered = this.getFilteredPrompts();
    return html`
      <div class="overlay" @click=${e => { if (e.target.classList.contains('overlay')) this.close(); }}>
        <div class="modal" @click=${e => e.stopPropagation()}>
          <div class="left">
            <div class="titlebar">
              <span class="modal-title">Prompts</span>
              <button class="btn ghost" @click=${() => this.close()} title="Close">
                <span class="icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.8 6.8 12 12m5.2 5.2L12 12m0 0 5.2-5.2M12 12 6.8 17.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
              </button>
            </div>

            <button class="btn primary" @click=${() => this.addNew()}>
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </span>
              New Prompt
            </button>

            <input
              class="form-control"
              type="text"
              placeholder="Search prompts…"
              .value=${this.searchQuery}
              @input=${e => { this.searchQuery = e.target.value; }}
            />
            <div class="list">
              ${this.prompts.length === 0
                ? html`
                    <div class="list-item ${isDraft ? 'selected' : ''}" @click=${() => this.select('__draft__')}>
                      <span class="tick">+</span>
                      <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">New Prompt</span>
                    </div>
                    <div class="list-item" style="opacity:0.65">Save to create your first prompt</div>
                  `
                : filtered.map(p => html`
                    <div class="list-item ${p.id === this.selectedId ? 'selected' : ''}" @click=${() => this.select(p.id)}>
                      <span class="tick ${p.id === activeId ? 'active' : ''}">${p.id === activeId ? '✓' : ''}</span>
                      <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${p.name}</span>
                    </div>
                  `)}
            </div>
          </div>
          <div class="right">
            <div class="titlebar">
              <span class="modal-title">Prompt Editor</span>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn danger" ?disabled=${!this.selectedId || isDraft} @click=${() => this.deleteCurrent()} title="Delete prompt">
                  <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3h6m-9 4h12m-11 0 1 14h8l1-14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 11v7M14 11v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  </span>
                  Delete
                </button>
                <button class="btn ghost" @click=${() => this.close()}>
                  Close
                </button>
              </div>
            </div>

            <div style="display:grid; gap:8px;">
              <label class="form-label">Name</label>
              <input class="form-control" type="text" .value=${this.draftName} @input=${e => { this.draftName = e.target.value; this._dirty = true; }} />

              <label class="form-label">Prompt</label>
              <textarea class="form-control" rows="12" .value=${this.draftContent} @input=${e => { this.draftContent = e.target.value; this._dirty = true; }}></textarea>
            </div>

            <div class="actions">
              <div class="left-actions">
                <button class="btn" ?disabled=${!this.selectedId || isDraft} @click=${() => this.setActive()} title=${isDraft ? 'Save the prompt first' : ''}>
                  Set Active
                </button>
              </div>
              <div class="right-actions">
                <button class="btn primary" @click=${() => this.saveCurrent()}>
                  Save
                </button>
              </div>
            </div>
          </div>
          ${this.deleteConfirmOpen ? html`
            <div class="confirm-overlay" @click=${e => { if (e.target.classList.contains('confirm-overlay')) this.deleteConfirmOpen = false; }}>
              <div class="confirm-card" @click=${e => e.stopPropagation()}>
                <div class="confirm-title">Delete Prompt</div>
                <div class="confirm-text">
                  Delete "${(this.prompts.find(x => x.id === this.selectedId)?.name) || 'this prompt'}" permanently? This cannot be undone.
                </div>
                <div class="confirm-actions">
                  <button class="btn ghost" @click=${() => { this.deleteConfirmOpen = false; }}>Cancel</button>
                  <button class="btn danger" @click=${() => this.performDelete()}>Delete</button>
                </div>
              </div>
            </div>
          ` : ''}

          ${this.unsavedConfirmOpen ? html`
            <div class="confirm-overlay" @click=${e => { if (e.target.classList.contains('confirm-overlay')) { this.unsavedConfirmOpen = false; this.unsavedTargetId = ''; } }}>
              <div class="confirm-card" @click=${e => e.stopPropagation()}>
                <div class="confirm-title">Unsaved Changes</div>
                <div class="confirm-text">You have unsaved changes. Save before switching?</div>
                <div class="confirm-actions">
                  <button class="btn ghost" @click=${() => this.confirmSwitchWithoutSaving()}>Switch without saving</button>
                  <button class="btn primary" @click=${() => this.confirmSaveAndSwitch()}>Save and switch</button>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('prompt-library-modal', PromptLibraryModal);
