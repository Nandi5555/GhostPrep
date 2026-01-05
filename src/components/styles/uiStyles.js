import { css } from '../../assets/lit-core-2.7.4.min.js';

/**
 * Lightweight shared UI primitives for Shadow DOM components.
 * Keep it minimal: buttons + small chips.
 */
export const buttonStyles = css`
    .btn {
        -webkit-app-region: no-drag;
        appearance: none;
        border: 1px solid var(--button-border, rgba(255, 255, 255, 0.14));
        background: var(--button-background, rgba(255, 255, 255, 0.06));
        color: var(--text-color);
        border-radius: 12px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0.15px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: transform 120ms ease, filter 160ms ease, background 160ms ease, border-color 160ms ease;
        user-select: none;
        white-space: nowrap;
    }

    .btn:hover {
        filter: brightness(1.06);
        background: var(--glass-hover-bg, rgba(255, 255, 255, 0.09));
        border-color: var(--input-hover-border, rgba(255, 255, 255, 0.22));
    }

    .btn:active {
        transform: translateY(1px);
    }

    .btn:disabled {
        opacity: 0.45;
        cursor: default;
        transform: none;
        filter: none;
    }

    .btn.primary {
        background: var(--menu-item-selected-bg, rgba(0, 122, 255, 0.18));
        border-color: var(--focus-border-color, rgba(0, 122, 255, 0.55));
        box-shadow: inset 0 0 0 1px var(--glass-highlight, rgba(255, 255, 255, 0.10));
    }

    .btn.primary:hover {
        filter: brightness(1.10);
    }

    .btn.danger {
        background: var(--danger-background, rgba(220, 38, 38, 0.14));
        border-color: var(--danger-border, rgba(220, 38, 38, 0.55));
        color: var(--danger-text, var(--text-color));
    }

    .btn.ghost {
        background: transparent;
        border-color: var(--button-border, rgba(255, 255, 255, 0.12));
    }

    .btn .icon {
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.95;
    }

    .btn .icon svg {
        width: 16px;
        height: 16px;
    }
`;
