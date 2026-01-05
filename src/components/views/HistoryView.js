import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { scrollbarStyles } from '../styles/scrollbarStyles.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class HistoryView extends LitElement {
    static styles = [
        scrollbarStyles,
        css`
        * {
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            width: 100%;
        }

        .history-container {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .sessions-list {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 16px;
            padding-bottom: 20px;
        }

        .session-item {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .session-item:hover {
            background: var(--hover-background);
            border-color: var(--focus-border-color);
        }

        .session-item.selected {
            background: var(--focus-box-shadow);
            border-color: var(--focus-border-color);
        }

        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .session-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .session-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .checkbox {
            width: 14px;
            height: 14px;
            accent-color: var(--focus-border-color);
            cursor: pointer;
        }

        .icon-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.15s ease;
        }

        .icon-button:hover {
            background: var(--hover-background);
        }

        .controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }

        .controls-left {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--text-color);
        }

        .controls-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .overlay {
            position: fixed;
            inset: 0;
            background: var(--overlay-bg, rgba(0, 0, 0, 0.4));
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal {
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            width: 360px;
            max-width: 90vw;
            padding: 14px;
            color: var(--text-color);
        }

        .modal-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .modal-body {
            font-size: 12px;
            color: var(--description-color);
            margin-bottom: 12px;
        }

        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }

        .button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .button:hover {
            background: var(--hover-background);
        }

        .button.danger {
            border-color: var(--danger-border, var(--focus-border-color));
        }

        .session-date {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color);
        }

        .session-time {
            font-size: 11px;
            color: var(--description-color);
        }

        .session-preview {
            font-size: 11px;
            color: var(--description-color);
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .conversation-view {
            flex: 1;
            overflow-y: auto;
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 12px;
            padding-bottom: 20px;
        }

        .message {
            margin-bottom: 6px;
            padding: 6px 10px;
            border-left: 3px solid transparent;
            font-size: 12px;
            line-height: 1.4;
            background: var(--input-background);
            border-radius: 0 4px 4px 0;
        }

        .message.user {
            border-left-color: var(--focus-border-color);
        }

        .message.ai {
            border-left-color: var(--highlight-color);
        }

        .back-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .back-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }

        .back-button:hover {
            background: var(--hover-background);
        }

        .legend {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--description-color);
        }

        .legend-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
        }

        .legend-dot.user {
            background-color: var(--focus-border-color);
        }

        .legend-dot.ai {
            background-color: var(--highlight-color);
        }

        .empty-state {
            text-align: center;
            color: var(--description-color);
            font-size: 12px;
            margin-top: 32px;
        }

        .empty-state-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--text-color);
        }

        .loading {
            text-align: center;
            color: var(--description-color);
            font-size: 12px;
            margin-top: 32px;
        }

        /* Scrollbar styles for scrollable elements */
        .sessions-list::-webkit-scrollbar {
            width: 6px;
        }

        .sessions-list::-webkit-scrollbar-track {
            background: var(--scrollbar-track, rgba(0, 0, 0, 0.2));
            border-radius: 3px;
        }

        .sessions-list::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
            border-radius: 3px;
        }

        .sessions-list::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
        }

    `,
    ];

    static properties = {
        sessions: { type: Array },
        selectedSession: { type: Object },
        loading: { type: Boolean },
        selectedIds: { type: Object },
        confirmMode: { type: String },
        confirmSessionId: { type: String },
        deleting: { type: Boolean },
    };

    constructor() {
        super();
        this.sessions = [];
        this.selectedSession = null;
        this.loading = true;
        this.selectedIds = new Set();
        this.confirmMode = null;
        this.confirmSessionId = null;
        this.deleting = false;
        this.loadSessions();
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
    }

    async loadSessions() {
        try {
            this.loading = true;
            if (window.cheddar && window.cheddar.getAllConversationSessions) {
                this.sessions = await window.cheddar.getAllConversationSessions();
            }
        } catch (error) {
            console.error('Error loading conversation sessions:', error);
            this.sessions = [];
        } finally {
            this.loading = false;
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    getSessionPreview(session) {
        if (!session.conversationHistory || session.conversationHistory.length === 0) {
            return 'No conversation yet';
        }

        const firstTurn = session.conversationHistory[0];
        const preview = firstTurn.transcription || firstTurn.ai_response || 'Empty conversation';
        return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }

    handleSessionClick(session) {
        this.selectedSession = session;
    }

    handleBackClick() {
        this.selectedSession = null;
    }

    isAllSelected() {
        return this.sessions.length > 0 && this.selectedIds.size === this.sessions.length;
    }

    toggleSelect(sessionId) {
        const next = new Set(this.selectedIds);
        if (next.has(sessionId)) {
            next.delete(sessionId);
        } else {
            next.add(sessionId);
        }
        this.selectedIds = next;
    }

    toggleSelectAll() {
        if (this.isAllSelected()) {
            this.selectedIds = new Set();
        } else {
            const all = new Set(this.sessions.map(s => s.sessionId));
            this.selectedIds = all;
        }
    }

    async deleteSelected() {
        if (!this.selectedIds || this.selectedIds.size === 0) return;
        this.confirmMode = 'bulk';
    }

    async deleteSessionById(sessionId) {
        this.confirmMode = 'single';
        this.confirmSessionId = sessionId;
    }

    cancelConfirm() {
        this.confirmMode = null;
        this.confirmSessionId = null;
        this.deleting = false;
    }

    async confirmDelete() {
        if (this.deleting) return;
        const ids = this.confirmMode === 'single' ? [this.confirmSessionId] : Array.from(this.selectedIds);
        if (!ids || ids.length === 0) {
            this.cancelConfirm();
            return;
        }
        if (window.cheddar && window.cheddar.deleteConversationSessions) {
            this.deleting = true;
            await window.cheddar.deleteConversationSessions(ids);
            const remaining = this.sessions.filter(s => !ids.includes(s.sessionId));
            this.sessions = remaining;
            const next = new Set(this.selectedIds);
            ids.forEach(id => next.delete(id));
            this.selectedIds = next;
            if (this.selectedSession && ids.includes(this.selectedSession.sessionId)) {
                this.selectedSession = null;
            }
            this.cancelConfirm();
        }
    }

    renderSessionsList() {
        if (this.loading) {
            return html`<div class="loading">Loading conversation history...</div>`;
        }

        if (this.sessions.length === 0) {
            return html`
                <div class="empty-state">
                    <div class="empty-state-title">No conversations yet</div>
                    <div>Start a session to see your conversation history here</div>
                </div>
            `;
        }

        return html`
            <div class="controls">
                <div class="controls-left">
                    <input
                        class="checkbox"
                        type="checkbox"
                        .checked=${this.isAllSelected()}
                        @click=${e => {
                            e.stopPropagation();
                            this.toggleSelectAll();
                        }}
                    />
                    <span>Select all</span>
                </div>
                <div class="controls-right">
                    <button class="icon-button" @click=${() => this.deleteSelected()}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor">
                            <path d="M3 6h18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                            <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Delete selected
                    </button>
                </div>
            </div>
            <div class="sessions-list">
                ${this.sessions.map(
                    session => html`
                        <div class="session-item" @click=${() => this.handleSessionClick(session)}>
                            <div class="session-header">
                                <div class="session-header-left">
                                    <input
                                        class="checkbox"
                                        type="checkbox"
                                        .checked=${this.selectedIds.has(session.sessionId)}
                                        @click=${e => {
                                            e.stopPropagation();
                                            this.toggleSelect(session.sessionId);
                                        }}
                                    />
                                    <div class="session-date">${this.formatDate(session.timestamp)}</div>
                                </div>
                                <div class="session-actions">
                                    <div class="session-time">${this.formatTime(session.timestamp)}</div>
                                    <button
                                        class="icon-button"
                                        @click=${e => {
                                            e.stopPropagation();
                                            this.deleteSessionById(session.sessionId);
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="currentColor">
                                            <path d="M3 6h18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                                            <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                                            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="session-preview">${this.getSessionPreview(session)}</div>
                        </div>
                    `
                )}
            </div>
        `;
    }

    renderConfirmDialog() {
        if (!this.confirmMode) return html``;
        const isBulk = this.confirmMode === 'bulk';
        const count = isBulk ? this.selectedIds.size : 1;
        const title = isBulk ? 'Delete selected chats?' : 'Delete this chat?';
        const body = isBulk ? `This will delete ${count} ${count === 1 ? 'chat' : 'chats'}.` : 'This will delete the selected chat.';
        return html`
            <div class="overlay" @click=${() => this.cancelConfirm()}>
                <div class="modal" @click=${e => e.stopPropagation()}>
                    <div class="modal-title">${title}</div>
                    <div class="modal-body">${body}</div>
                    <div class="modal-actions">
                        <button class="button" ?disabled=${this.deleting} @click=${() => this.cancelConfirm()}>Cancel</button>
                        <button class="button danger" ?disabled=${this.deleting} @click=${() => this.confirmDelete()}>Delete</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderConversationView() {
        if (!this.selectedSession) return html``;

        const { conversationHistory } = this.selectedSession;

        // Flatten the conversation turns into individual messages
        const messages = [];
        if (conversationHistory) {
            conversationHistory.forEach(turn => {
                if (turn.transcription) {
                    messages.push({
                        type: 'user',
                        content: turn.transcription,
                        timestamp: turn.timestamp,
                    });
                }
                if (turn.ai_response) {
                    messages.push({
                        type: 'ai',
                        content: turn.ai_response,
                        timestamp: turn.timestamp,
                    });
                }
            });
        }

        return html`
            <div class="back-header">
                <button class="back-button" @click=${this.handleBackClick}>
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="currentColor"
                    >
                        <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    Back to Sessions
                </button>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-dot user"></div>
                        <span>Them</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot ai"></div>
                        <span>Suggestion</span>
                    </div>
                </div>
            </div>
            <div class="conversation-view">
                ${messages.length > 0
                    ? messages.map(message => html` <div class="message ${message.type}">${message.content}</div> `)
                    : html`<div class="empty-state">No conversation data available</div>`}
            </div>
        `;
    }

    render() {
        return html` <div class="history-container">${this.selectedSession ? this.renderConversationView() : this.renderSessionsList()}${this.renderConfirmDialog()}</div> `;
    }
}

customElements.define('history-view', HistoryView);
