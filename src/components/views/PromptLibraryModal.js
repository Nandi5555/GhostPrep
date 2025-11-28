import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
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
  static styles = css`
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
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal {
      width: 860px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 40px);
      background: var(--card-background, rgba(25, 25, 25, 0.95));
      border: 1px solid var(--card-border, rgba(255, 255, 255, 0.12));
      border-radius: 8px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
      display: grid;
      grid-template-columns: 240px 1fr;
      overflow: hidden;
      position: relative;
    }
    .left {
      border-right: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
      padding: 12px;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 8px;
      background: rgba(255, 255, 255, 0.02);
    }
    .right {
      padding: 12px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
    }
    .titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color, #fff);
    }
    .close-btn {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-color);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      font-size: 12px;
      padding: 6px 10px;
      cursor: pointer;
    }
    .delete-btn {
      background: rgba(255, 0, 0, 0.12);
      color: var(--text-color);
      border: 1px solid rgba(255, 0, 0, 0.35);
      border-radius: 6px;
      font-size: 12px;
      padding: 6px 10px;
      cursor: pointer;
    }
    .add-btn {
      width: 100%;
      background: var(--button-background, rgba(255, 255, 255, 0.08));
      color: var(--text-color);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      font-size: 12px;
      padding: 6px 10px;
      cursor: pointer;
    }
    .list {
      overflow: auto;
      border-radius: 6px;
    }
    .list-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-color);
    }
    .list-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .tick {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 4px;
      font-size: 12px;
      color: var(--text-color);
      background: rgba(255, 255, 255, 0.04);
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
      border-radius: 6px;
      font-size: 12px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .button {
      background: var(--button-background, rgba(255, 255, 255, 0.08));
      color: var(--text-color);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      font-size: 12px;
      padding: 6px 10px;
      cursor: pointer;
    }
    .button.primary {
      background: var(--focus-border-color, #007aff);
      border-color: var(--focus-border-color, #007aff);
      color: #fff;
    }

    /* Confirmation overlay inside modal (content-protection friendly) */
    .confirm-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .confirm-card {
      width: 420px;
      max-width: calc(100% - 40px);
      background: var(--card-background, rgba(25, 25, 25, 0.98));
      border: 1px solid var(--card-border, rgba(255, 255, 255, 0.15));
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45);
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
    .button.danger {
      background: #dc2626;
      border-color: #dc2626;
      color: #fff;
    }

    /* Custom thin, modern light-gray scrollbars inside the modal */
    .left .list,
    .right textarea.form-control {
      /* Firefox */
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.35))
        var(--scrollbar-track, transparent);
    }

    /* WebKit-based browsers (Chromium/Electron/Edge) */
    .left .list::-webkit-scrollbar,
    .right textarea.form-control::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .left .list::-webkit-scrollbar-track,
    .right textarea.form-control::-webkit-scrollbar-track {
      background: var(--scrollbar-track, transparent);
      border-radius: 8px;
    }
    .left .list::-webkit-scrollbar-thumb,
    .right textarea.form-control::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.35));
      border-radius: 8px;
    }
    .left .list::-webkit-scrollbar-thumb:hover,
    .right textarea.form-control::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.5));
    }
    .left .list::-webkit-scrollbar-thumb:active,
    .right textarea.form-control::-webkit-scrollbar-thumb:active {
      background: var(--scrollbar-thumb-active, rgba(255, 255, 255, 0.6));
    }
  `;

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
  };

  constructor() {
    super();
    this.open = false;
    this.prompts = [];
    this.selectedId = '';
    this.draftName = 'New Cluely';
    this.draftContent = '';
    this._dirty = false;
    this.deleteConfirmOpen = false;
    this.unsavedConfirmOpen = false;
    this.unsavedTargetId = '';
  }

  connectedCallback() {
    super.connectedCallback();
    try { migrateFromLegacyKey(); } catch (_) {}
    this.reload();
    const active = getActivePrompt();
    if (active) {
      this.select(active.id);
    } else if (this.prompts.length > 0) {
      this.select(this.prompts[0].id);
    }
  }

  reload() {
    this.prompts = getPrompts();
    this.requestUpdate();
  }

  select(id) {
    if (this._dirty) {
      this.unsavedTargetId = id;
      this.unsavedConfirmOpen = true;
      return;
    }

    this.selectedId = id;
    const p = this.prompts.find(x => x.id === id);
    if (p) {
      this.draftName = p.name || 'New Cluely';
      this.draftContent = p.content || '';
      this._dirty = false;
    }
  }

  addNew() {
    const created = addPrompt({ name: 'New Cluely', content: '' });
    this.reload();
    this.select(created.id);
  }

  saveCurrent() {
    if (!this.selectedId) return;
    updatePrompt(this.selectedId, { name: this.draftName, content: this.draftContent });
    this.reload();
    this._dirty = false;
    // Fire toast-like event
    this.dispatchEvent(new CustomEvent('prompt-saved', { detail: { id: this.selectedId }, bubbles: true, composed: true }));
  }

  deleteCurrent() {
    if (!this.selectedId) return;
    this.deleteConfirmOpen = true;
  }

  performDelete() {
    if (!this.selectedId) return;
    const deletingId = this.selectedId;
    deletePrompt(deletingId);
    this.deleteConfirmOpen = false;
    this.reload();
    if (this.prompts.length > 0) {
      this._dirty = false;
      this.select(this.prompts[0].id);
    } else {
      this.selectedId = '';
      this.draftName = 'New Cluely';
      this.draftContent = '';
      this._dirty = false;
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
    setActivePrompt(this.selectedId);
    this.reload();
  }

  close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render() {
    const active = getActivePrompt();
    const activeId = active?.id || '';
    return html`
      <div class="overlay" @click=${e => { if (e.target.classList.contains('overlay')) this.close(); }}>
        <div class="modal" @click=${e => e.stopPropagation()}>
          <div class="left">
            <button class="add-btn" @click=${() => this.addNew()}>+ Add Prompt</button>
            <div class="list">
              ${this.prompts.length === 0
                ? html`<div class="list-item" style="opacity:0.7">No prompts yet</div>`
                : this.prompts.map(p => html`
                    <div class="list-item" @click=${() => this.select(p.id)}>
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
                <button class="delete-btn" ?disabled=${!this.selectedId} @click=${() => this.deleteCurrent()}>🗑 Delete</button>
                <button class="close-btn" @click=${() => this.close()}>Close</button>
              </div>
            </div>

            <div style="display:grid; gap:8px;">
              <label class="form-label">Name</label>
              <input class="form-control" type="text" .value=${this.draftName} @input=${e => { this.draftName = e.target.value; this._dirty = true; }} />

              <label class="form-label">Prompt</label>
              <textarea class="form-control" rows="12" .value=${this.draftContent} @input=${e => { this.draftContent = e.target.value; this._dirty = true; }}></textarea>
            </div>

            <div class="actions">
              <button class="button" @click=${() => this.setActive()}>Set Active</button>
              <button class="button primary" @click=${() => this.saveCurrent()}>Save</button>
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
                  <button class="button" @click=${() => { this.deleteConfirmOpen = false; }}>Cancel</button>
                  <button class="button danger" @click=${() => this.performDelete()}>Delete</button>
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
                  <button class="button" @click=${() => this.confirmSwitchWithoutSaving()}>Switch without saving</button>
                  <button class="button primary" @click=${() => this.confirmSaveAndSwitch()}>Save and switch</button>
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