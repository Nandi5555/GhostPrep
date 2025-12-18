import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import './PromptLibraryModal.js';
import {
    getActivePrompt,
    updatePrompt as updateLibraryPrompt,
    getActivePromptContentOrLegacy,
    migrateFromLegacyKey,
} from '../../utils/promptLibrary.js';
import { resizeLayout } from '../../utils/windowResize.js';
import { scrollbarStyles } from '../styles/scrollbarStyles.js';
import '../ui/GPSelect.js';

export class CustomizeView extends LitElement {
    static styles = [
        scrollbarStyles,
        css`
        :host,
        *,
        *::before,
        *::after {
            box-sizing: border-box;
        }

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
            display: block;
            height: 100%;
        }

        /* Compact is the ONLY supported layout mode */
        .page {
            height: 100%;
            padding: 10px;
            margin: 0 auto;
            max-width: 980px;
            min-height: 0;
            overflow: hidden; /* prevent host-level overflow; internal panels handle scrolling */
        }
        .shell {
            display: grid;
            grid-template-columns: 220px 1fr;
            grid-template-rows: none;
            gap: 10px;
            height: 100%;
            min-height: 0;
        }

        .sidebar {
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.04)),
                var(--glass-bg, rgba(255, 255, 255, 0.08));
            border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.22));
            border-radius: 16px;
            backdrop-filter: blur(10px);
            box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
            min-height: 0;
            /* Important: clip scrollbars to rounded corners */
            overflow: hidden;
            padding: 0;
        }

        .sidebar-scroll {
            height: 100%;
            padding: 10px;
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-gutter: stable;
            overscroll-behavior: contain;
        }

        /* Compact-only: sidebar/content tightening */
        .sidebar {
            max-height: none;
            height: 100%;
        }
        .sidebar-scroll { padding: 10px; }
        .nav { display: flex; flex-direction: column; gap: 4px; }
        .nav-item { min-width: 0; padding: 8px 10px; }
        .nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-title { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-subtitle { display: none; }
        .sidebar-header {
            grid-template-columns: auto 1fr;
            grid-template-rows: auto auto;
            row-gap: 8px;
        }
        .sidebar-headings { overflow: hidden; }
        .sidebar-header .content-pill { grid-column: 1 / -1; justify-self: start; max-width: 100%; }
        .content-header { padding: 8px 6px 10px; }
        .content-title { font-size: 16px; }

        .sidebar-header {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 10px;
            padding: 10px 10px 12px;
            border-bottom: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
            margin-bottom: 8px;
        }

        .sidebar-logo {
            width: 28px;
            height: 28px;
            opacity: 0.95;
            filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
            flex: 0 0 auto;
        }

        .sidebar-headings {
            display: flex;
            flex-direction: column;
            gap: 1px;
            min-width: 0;
            flex: 1;
        }

        .sidebar-title {
            font-size: 15px;
            font-weight: 750;
            color: var(--text-color);
            letter-spacing: 0.2px;
            line-height: 1.1;
        }

        .sidebar-subtitle {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            line-height: 1.2;
        }

        .nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 8px 2px 2px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 10px 10px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.02);
            color: var(--text-color);
            cursor: pointer;
            transition:
                background 0.14s ease,
                border-color 0.14s ease,
                transform 0.12s ease,
                filter 0.14s ease;
            text-align: left;
            position: relative;
        }

        .nav-item { padding: 9px 10px; border-radius: 12px; }

        .nav-item:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.12);
        }

        .nav-item:active {
            transform: translateY(1px);
        }

        .nav-item[aria-current='page'] {
            background: linear-gradient(180deg, rgba(0, 122, 255, 0.20), rgba(0, 122, 255, 0.08));
            border-color: rgba(0, 122, 255, 0.40);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .nav-item[aria-current='page']::before {
            content: '';
            position: absolute;
            left: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 16px;
            border-radius: 99px;
            background: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
        }

        .nav-icon {
            width: 18px;
            height: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.8);
            flex: 0 0 auto;
        }

        .nav-icon svg {
            width: 18px;
            height: 18px;
        }

        .nav-label {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.2px;
        }

        .content {
            min-height: 0;
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
            padding-right: 4px;
        }

        .content-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 6px 12px;
            position: sticky;
            top: 0;
            z-index: 2;
            background:
                linear-gradient(180deg, rgba(12, 14, 20, 0.72) 0%, rgba(12, 14, 20, 0.30) 60%, rgba(12, 14, 20, 0) 100%);
            backdrop-filter: blur(8px);
        }

        .content-title {
            font-size: 18px;
            font-weight: 760;
            color: var(--text-color);
            letter-spacing: 0.2px;
        }

        .content-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--label-color, rgba(255, 255, 255, 0.85));
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            padding: 4px 8px;
            border-radius: 999px;
        }

        /* Compact-only app: keep the sidebar + vertical nav even on narrower windows.
           (Do NOT switch the nav into a 2-column grid; it breaks the compact UX.) */

        .settings-section {
            background: rgba(255, 255, 255, 0.035);
            border: 1px solid rgba(255, 255, 255, 0.10);
            border-radius: 16px;
            padding: 16px;
        }

        /* Compact spacing: keep sections separated but tight */
        .settings-section + .settings-section {
            margin-top: 10px;
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 13px;
            font-weight: 750;
            color: var(--text-color);
            letter-spacing: 0.2px;
        }

        .section-title::before {
            content: '';
            width: 3px;
            height: 14px;
            background: var(--accent-color, #007aff);
            border-radius: 1.5px;
        }

        .form-grid {
            display: grid;
            gap: 12px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: start;
        }

        @media (max-width: 600px) {
            .form-row {
                grid-template-columns: 1fr;
            }
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .form-group.full-width {
            grid-column: 1 / -1;
        }

        .form-label {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .form-description {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            line-height: 1.3;
            margin-top: 2px;
        }

        .form-control {
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            color: var(--text-color);
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.15s ease;
            min-height: 16px;
            font-weight: 400;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
            background: var(--input-focus-background, rgba(0, 0, 0, 0.4));
        }

        .form-control:hover:not(:focus) {
            border-color: var(--input-hover-border, rgba(255, 255, 255, 0.2));
            background: var(--input-hover-background, rgba(0, 0, 0, 0.35));
        }

        select.form-control {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 8px center;
            background-repeat: no-repeat;
            background-size: 12px;
            padding-right: 28px;
        }

        textarea.form-control {
            resize: vertical;
            min-height: 60px;
            line-height: 1.4;
            font-family: inherit;
        }

        textarea.form-control::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
        }

        /* Scrollbars are standardized globally via scrollbarStyles (avoid per-component overrides). */

        .profile-option {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .current-selection {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: var(--success-color, #34d399);
            background: var(--success-background, rgba(52, 211, 153, 0.1));
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
            border: 1px solid var(--success-border, rgba(52, 211, 153, 0.2));
        }

        .current-selection::before {
            content: '✓';
            font-weight: 600;
        }

        .keybind-input {
            cursor: pointer;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            text-align: center;
            letter-spacing: 0.5px;
            font-weight: 500;
        }

        .keybind-input:focus {
            cursor: text;
            background: var(--input-focus-background, rgba(0, 122, 255, 0.1));
        }

        .keybind-input::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
        }

        .reset-keybinds-button {
            background: var(--button-background, rgba(255, 255, 255, 0.1));
            color: var(--text-color);
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.15));
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .reset-keybinds-button:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.25));
        }

        .reset-keybinds-button:active {
            transform: translateY(1px);
        }

        .keybinds-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border-radius: 4px;
            overflow: hidden;
        }

        .keybinds-table th,
        .keybinds-table td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .keybinds-table th {
            background: var(--table-header-background, rgba(255, 255, 255, 0.04));
            font-weight: 600;
            font-size: 11px;
            color: var(--label-color, rgba(255, 255, 255, 0.8));
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .keybinds-table td {
            vertical-align: middle;
        }

        .keybinds-table .action-name {
            font-weight: 500;
            color: var(--text-color);
            font-size: 12px;
        }

        .keybinds-table .action-description {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            margin-top: 1px;
        }

        .keybinds-table .keybind-input {
            min-width: 100px;
            padding: 4px 8px;
            margin: 0;
            font-size: 11px;
        }

        .keybinds-table tr:hover {
            background: var(--table-row-hover, rgba(255, 255, 255, 0.02));
        }

        .keybinds-table tr:last-child td {
            border-bottom: none;
        }

        .table-reset-row {
            border-top: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .table-reset-row td {
            padding-top: 10px;
            padding-bottom: 8px;
            border-bottom: none;
        }

        .settings-note {
            font-size: 10px;
            color: var(--note-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
            text-align: center;
            margin-top: 10px;
            padding: 8px;
            background: var(--note-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--note-border, rgba(255, 255, 255, 0.08));
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            padding: 8px;
            background: var(--checkbox-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--checkbox-border, rgba(255, 255, 255, 0.06));
        }

        .checkbox-input {
            width: 14px;
            height: 14px;
            accent-color: var(--focus-border-color, #007aff);
            cursor: pointer;
        }

        .checkbox-label {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            cursor: pointer;
            user-select: none;
        }

        /* Toggle switch styles */
        .toggle-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            padding: 8px;
            background: var(--checkbox-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--checkbox-border, rgba(255, 255, 255, 0.06));
        }

        .switch-input {
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
        }

        .switch-label {
            width: 42px;
            height: 24px;
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            border-radius: 12px;
            position: relative;
            cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease;
        }

        .switch-label::after {
            content: '';
            position: absolute;
            top: 3px;
            left: 3px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
            transition: transform 0.15s ease;
        }

        .switch-input:focus + .switch-label {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        .switch-input:checked + .switch-label {
            background: var(--focus-border-color, #007aff);
            border-color: var(--focus-border-color, #007aff);
        }

        .switch-input:checked + .switch-label::after {
            transform: translateX(18px);
        }

        .switch-text {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            cursor: pointer;
            user-select: none;
        }

        /* Better focus indicators */
        .form-control:focus-visible {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        /* Improved button states */
        .reset-keybinds-button:focus-visible {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        /* Slider styles */
        .slider-container {
            display: flex;
            flex-direction: column;
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
            cursor: pointer;
        }

        .slider-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: pointer;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: pointer;
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
    `,
    ];

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedAudioMode: { type: String },
        selectedTranscriptionMode: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        keybinds: { type: Object },
        googleSearchEnabled: { type: Boolean },
        undetectableEnabled: { type: Boolean },
        backgroundTransparency: { type: Number },
        fontSize: { type: Number },
        activeCategory: { type: String },
        // AI provider keys (stored in localStorage, same pattern as other settings)
        deepgramApiKey: { type: String },
        openaiApiKey: { type: String },
        openaiModel: { type: String },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onAudioModeChange: { type: Function },
        onTranscriptionModeChange: { type: Function },
        onScreenshotIntervalChange: { type: Function },
        onImageQualityChange: { type: Function },
        advancedMode: { type: Boolean },
        onAdvancedModeChange: { type: Function },
        // Prompt library modal state
        promptLibraryOpen: { type: Boolean },
        highlightColor: { type: String },
        pendingHighlightColor: { type: String },
    };

    constructor() {
        super();
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedAudioMode = localStorage.getItem('selectedAudioMode') || 'speaker';
        // Default to Manual for reliability (but respect any saved selection)
        this.selectedTranscriptionMode = localStorage.getItem('selectedTranscriptionMode') || 'manual';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.keybinds = this.getDefaultKeybinds();
        this.onProfileChange = () => {};
        this.onLanguageChange = () => {};
        this.onAudioModeChange = () => {};
        this.onTranscriptionModeChange = () => {};
        this.onScreenshotIntervalChange = () => {};
        this.onImageQualityChange = () => {};
        this.onAdvancedModeChange = () => {};

        // Google Search default
        this.googleSearchEnabled = true;

        // Undetectable default OFF; loadUndetectableSettings may override from saved value
        this.undetectableEnabled = false;

        // Advanced mode default
        this.advancedMode = false;

        // Background transparency default
        this.backgroundTransparency = 0.8;

        // Font size default (in pixels)
        this.fontSize = 20;

        this.activeCategory = 'profile';

        // AI providers (required to start a session)
        this.deepgramApiKey = localStorage.getItem('deepgramApiKey') || '';
        this.openaiApiKey = localStorage.getItem('openaiApiKey') || '';
        this.openaiModel = localStorage.getItem('openaiModel') || 'gpt-4.1-nano';

        this.loadKeybinds();
        this.loadGoogleSearchSettings();
        this.loadUndetectableSettings();
        this.loadAdvancedModeSettings();
        this.loadBackgroundTransparency();
        this.loadFontSize();
        this.promptLibraryOpen = false;

        const cs = getComputedStyle(document.documentElement);
        const defaultHighlight = cs.getPropertyValue('--highlight-color')?.trim() || '#fa6e4e';
        this.highlightColor = localStorage.getItem('highlightColor') || defaultHighlight;
        this.pendingHighlightColor = '';
        this.applyHighlightColor(this.highlightColor);
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
        // Initialize multi-prompt library from legacy key if present
        try {
            migrateFromLegacyKey();
        } catch (_) {}
    }

    getProfiles() {
        return [
            {
                value: 'interview',
                name: 'Job Interview',
                description: 'Get help with answering interview questions',
            },
            {
                value: 'sales',
                name: 'Sales Call',
                description: 'Assist with sales conversations and objection handling',
            },
            {
                value: 'meeting',
                name: 'Business Meeting',
                description: 'Support for professional meetings and discussions',
            },
            {
                value: 'presentation',
                name: 'Presentation',
                description: 'Help with presentations and public speaking',
            },
            {
                value: 'negotiation',
                name: 'Negotiation',
                description: 'Guidance for business negotiations and deals',
            },
        ];
    }

    getLanguages() {
        return [
            { value: 'en-US', name: 'English (US)' },
            { value: 'en-GB', name: 'English (UK)' },
            { value: 'en-AU', name: 'English (Australia)' },
            { value: 'en-IN', name: 'English (India)' },
            { value: 'de-DE', name: 'German (Germany)' },
            { value: 'es-US', name: 'Spanish (United States)' },
            { value: 'es-ES', name: 'Spanish (Spain)' },
            { value: 'fr-FR', name: 'French (France)' },
            { value: 'fr-CA', name: 'French (Canada)' },
            { value: 'hi-IN', name: 'Hindi (India)' },
            { value: 'pt-BR', name: 'Portuguese (Brazil)' },
            { value: 'ar-XA', name: 'Arabic (Generic)' },
            { value: 'id-ID', name: 'Indonesian (Indonesia)' },
            { value: 'it-IT', name: 'Italian (Italy)' },
            { value: 'ja-JP', name: 'Japanese (Japan)' },
            { value: 'tr-TR', name: 'Turkish (Turkey)' },
            { value: 'vi-VN', name: 'Vietnamese (Vietnam)' },
            { value: 'bn-IN', name: 'Bengali (India)' },
            { value: 'gu-IN', name: 'Gujarati (India)' },
            { value: 'kn-IN', name: 'Kannada (India)' },
            { value: 'ml-IN', name: 'Malayalam (India)' },
            { value: 'mr-IN', name: 'Marathi (India)' },
            { value: 'ta-IN', name: 'Tamil (India)' },
            { value: 'te-IN', name: 'Telugu (India)' },
            { value: 'nl-NL', name: 'Dutch (Netherlands)' },
            { value: 'ko-KR', name: 'Korean (South Korea)' },
            { value: 'cmn-CN', name: 'Mandarin Chinese (China)' },
            { value: 'pl-PL', name: 'Polish (Poland)' },
            { value: 'ru-RU', name: 'Russian (Russia)' },
            { value: 'th-TH', name: 'Thai (Thailand)' },
        ];
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

    handleProfileSelect(e) {
        this.selectedProfile = e.target.value;
        localStorage.setItem('selectedProfile', this.selectedProfile);
        this.onProfileChange(this.selectedProfile);
    }

    handleLanguageSelect(e) {
        this.selectedLanguage = e.target.value;
        localStorage.setItem('selectedLanguage', this.selectedLanguage);
        this.onLanguageChange(this.selectedLanguage);
    }

    handleAudioModeSelect(e) {
        this.selectedAudioMode = e.target.value;
        localStorage.setItem('selectedAudioMode', this.selectedAudioMode);
        this.onAudioModeChange(this.selectedAudioMode);
        this.requestUpdate();
    }

    async handleTranscriptionModeSelect(e) {
        this.selectedTranscriptionMode = e.target.value === 'auto' ? 'auto' : 'manual';
        try {
            localStorage.setItem('selectedTranscriptionMode', this.selectedTranscriptionMode);
        } catch (_) {}
        try {
            this.onTranscriptionModeChange(this.selectedTranscriptionMode);
        } catch (_) {}
        // Also notify main process immediately (so behavior updates mid-session)
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-transcription-mode', this.selectedTranscriptionMode);
            }
        } catch (_) {}
        this.requestUpdate();
    }

    handleScreenshotIntervalSelect(e) {
        this.selectedScreenshotInterval = e.target.value;
        localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        this.onScreenshotIntervalChange(this.selectedScreenshotInterval);
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(e.target.value);
    }

    // Layout mode removed: compact is always-on.

    handleCustomPromptInput(e) {
        const active = getActivePrompt();
        if (active) {
            updateLibraryPrompt(active.id, { content: e.target.value });
        } else {
            localStorage.setItem('customPrompt', e.target.value);
        }
    }

    openPromptLibrary() {
        this.promptLibraryOpen = true;
        // Mark modal open state for main process sizing logic
        try {
            if (!window.cheddar) window.cheddar = {};
            window.cheddar.isPromptLibraryOpen = true;
        } catch (_) {}

        // Enable window expansion similar to Assistant view while modal is open
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('view-changed', 'assistant');
            }
        } catch (_) {}

        // Trigger size update to apply resizable state
        try {
            resizeLayout();
        } catch (_) {}
    }

    closePromptLibrary() {
        this.promptLibraryOpen = false;
        // Clear modal open state
        try {
            if (!window.cheddar) window.cheddar = {};
            window.cheddar.isPromptLibraryOpen = false;
        } catch (_) {}

        // Restore default resizable behavior for Customize view
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('view-changed', 'customize');
            }
        } catch (_) {}

        // Update sizes back to view defaults
        try {
            resizeLayout();
        } catch (_) {}
        // Refresh textarea value after closing
        this.requestUpdate();
    }

    getActivePromptText() {
        try {
            return getActivePromptContentOrLegacy() || '';
        } catch (_) {
            return localStorage.getItem('customPrompt') || '';
        }
    }

    getDefaultKeybinds() {
        const isMac = window.cheddar?.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
            moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
            moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
            moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
            previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
            nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
            scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
            scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        };
    }

    loadKeybinds() {
        const savedKeybinds = localStorage.getItem('customKeybinds');
        if (savedKeybinds) {
            try {
                this.keybinds = { ...this.getDefaultKeybinds(), ...JSON.parse(savedKeybinds) };
            } catch (e) {
                console.error('Failed to parse saved keybinds:', e);
                this.keybinds = this.getDefaultKeybinds();
            }
        }
    }

    saveKeybinds() {
        localStorage.setItem('customKeybinds', JSON.stringify(this.keybinds));
        // Send to main process to update global shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    handleKeybindChange(action, value) {
        this.keybinds = { ...this.keybinds, [action]: value };
        this.saveKeybinds();
        this.requestUpdate();
    }

    resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        localStorage.removeItem('customKeybinds');
        this.requestUpdate();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    getKeybindActions() {
        return [
            {
                key: 'moveUp',
                name: 'Move Window Up',
                description: 'Move the application window up',
            },
            {
                key: 'moveDown',
                name: 'Move Window Down',
                description: 'Move the application window down',
            },
            {
                key: 'moveLeft',
                name: 'Move Window Left',
                description: 'Move the application window left',
            },
            {
                key: 'moveRight',
                name: 'Move Window Right',
                description: 'Move the application window right',
            },
            {
                key: 'toggleVisibility',
                name: 'Toggle Window Visibility',
                description: 'Show/hide the application window',
            },
            {
                key: 'toggleClickThrough',
                name: 'Toggle Click-through Mode',
                description: 'Enable/disable click-through functionality',
            },
            {
                key: 'nextStep',
                name: 'Send / Submit',
                description: 'Submit the current buffered transcript (and screenshot if enabled)',
            },
            {
                key: 'previousResponse',
                name: 'Previous Response',
                description: 'Navigate to the previous AI response',
            },
            {
                key: 'nextResponse',
                name: 'Next Response',
                description: 'Navigate to the next AI response',
            },
            {
                key: 'scrollUp',
                name: 'Scroll Response Up',
                description: 'Scroll the AI response content up',
            },
            {
                key: 'scrollDown',
                name: 'Scroll Response Down',
                description: 'Scroll the AI response content down',
            },
        ];
    }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    handleKeybindInput(e) {
        e.preventDefault();

        const modifiers = [];
        const keys = [];

        // Check modifiers
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        // Get the main key
        let mainKey = e.key;

        // Handle special keys
        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            case 'KeyS':
                if (e.shiftKey) mainKey = 'S';
                break;
            case 'KeyM':
                mainKey = 'M';
                break;
            default:
                if (e.key.length === 1) {
                    mainKey = e.key.toUpperCase();
                }
                break;
        }

        // Skip if only modifier keys are pressed
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            return;
        }

        // Construct keybind string
        const keybind = [...modifiers, mainKey].join('+');

        // Get the action from the input's data attribute
        const action = e.target.dataset.action;

        // Update the keybind
        this.handleKeybindChange(action, keybind);

        // Update the input value
        e.target.value = keybind;
        e.target.blur();
    }

    loadGoogleSearchSettings() {
        const googleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        if (googleSearchEnabled !== null) {
            this.googleSearchEnabled = googleSearchEnabled === 'true';
        }
    }

    loadUndetectableSettings() {
        const undetectableEnabled = localStorage.getItem('undetectableEnabled');
        if (undetectableEnabled !== null) {
            this.undetectableEnabled = undetectableEnabled === 'true';
            return;
        }
        // Migration: legacy contentProtection
        const legacyCP = localStorage.getItem('contentProtection');
        if (legacyCP !== null) {
            this.undetectableEnabled = legacyCP === 'true';
            try {
                localStorage.setItem('undetectableEnabled', this.undetectableEnabled.toString());
            } catch (_) {}
            return;
        }
        // Migration: read legacy toggle key if present
        const legacy = localStorage.getItem('undetectableTEnabled');
        if (legacy !== null) {
            this.undetectableEnabled = legacy === 'true';
            try {
                localStorage.setItem('undetectableEnabled', this.undetectableEnabled.toString());
            } catch (_) {}
            return;
        }
        // Default OFF if nothing saved
        this.undetectableEnabled = false;
        try {
            localStorage.setItem('undetectableEnabled', 'false');
        } catch (_) {}
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        localStorage.setItem('googleSearchEnabled', this.googleSearchEnabled.toString());

        // Notify main process if available
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }

        this.requestUpdate();
    }

    async handleUndetectableChange(e) {
        this.undetectableEnabled = e.target.checked;
        try {
            localStorage.setItem('undetectableEnabled', this.undetectableEnabled.toString());
        } catch (_) {}
        // Notify main process to apply content protection immediately
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('set-undetectable-mode', this.undetectableEnabled);
            } catch (error) {
                console.error('Failed to set undetectable mode via IPC:', error);
            }
        }
        this.requestUpdate();
    }

    // Layout mode removed: compact is always-on.

    loadAdvancedModeSettings() {
        const advancedMode = localStorage.getItem('advancedMode');
        if (advancedMode !== null) {
            this.advancedMode = advancedMode === 'true';
        }
    }

    async handleAdvancedModeChange(e) {
        this.advancedMode = e.target.checked;
        localStorage.setItem('advancedMode', this.advancedMode.toString());
        this.onAdvancedModeChange(this.advancedMode);
        this.requestUpdate();
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
        root.style.setProperty('--header-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
        root.style.setProperty('--main-content-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
        root.style.setProperty('--card-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.05})`);
        root.style.setProperty('--input-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.375})`);
        root.style.setProperty('--input-focus-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
        root.style.setProperty('--button-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
        root.style.setProperty('--preview-video-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 1.125})`);
        root.style.setProperty('--screen-option-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
        root.style.setProperty('--screen-option-hover-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.75})`);
        root.style.setProperty('--scrollbar-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            this.fontSize = parseInt(fontSize, 10) || 20;
        }
        this.updateFontSize();
    }

    handleFontSizeChange(e) {
        this.fontSize = parseInt(e.target.value, 10);
        localStorage.setItem('fontSize', this.fontSize.toString());
        this.updateFontSize();
        this.requestUpdate();
    }

    updateFontSize() {
        const root = document.documentElement;
        root.style.setProperty('--response-font-size', `${this.fontSize}px`);
    }

    hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    applyHighlightColor(color) {
        const root = document.documentElement;
        root.style.setProperty('--highlight-color', color);
        root.style.setProperty('--highlight-bg-color', this.hexToRgba(color, 0.16));
    }

    handleHighlightColorChange(e) {
        this.pendingHighlightColor = e.target.value;
        this.requestUpdate();
    }

    saveHighlightColor() {
        if (!this.pendingHighlightColor) return;
        this.highlightColor = this.pendingHighlightColor;
        localStorage.setItem('highlightColor', this.highlightColor);
        this.applyHighlightColor(this.highlightColor);
        this.pendingHighlightColor = '';
        this.requestUpdate();
    }

    render() {
        const profiles = this.getProfiles();
        const languages = this.getLanguages();
        const profileNames = this.getProfileNames();
        const currentProfile = profiles.find(p => p.value === this.selectedProfile);
        const currentLanguage = languages.find(l => l.value === this.selectedLanguage);

        const navItems = [
            { id: 'profile', label: 'Profile' },
            { id: 'providers', label: 'AI Providers' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'audio', label: 'Audio' },
            { id: 'language', label: 'Language' },
            { id: 'capture', label: 'Capture' },
            { id: 'keyboard', label: 'Keyboard' },
            { id: 'search', label: 'Search' },
            { id: 'advanced', label: 'Advanced' },
        ];
        const activeNavLabel = navItems.find(n => n.id === this.activeCategory)?.label || 'Customize';

        return html`
            <div class="page">
            <div class="shell">
                <aside class="sidebar">
                    <div class="sidebar-scroll">
                        <div class="sidebar-header">
                            <img class="sidebar-logo" src="assets/onboarding/customize.svg" alt="" />
                            <div class="sidebar-headings">
                                <div class="sidebar-title">Customize</div>
                                <div class="sidebar-subtitle">UI & behavior settings</div>
                            </div>
                            <div class="content-pill" title="Active profile">
                                <span>Profile</span>
                                <span style="opacity:0.8;">${currentProfile?.name || 'Unknown'}</span>
                            </div>
                        </div>

                        <nav class="nav" aria-label="Customize navigation">
                            ${navItems.map(
                                item => html`
                                    <button
                                        class="nav-item"
                                        aria-current=${this.activeCategory === item.id ? 'page' : 'false'}
                                        @click=${() => {
                                            this.activeCategory = item.id;
                                        }}
                                    >
                                        <span class="nav-icon" aria-hidden="true">
                                            ${this.renderNavIcon(item.id)}
                                        </span>
                                        <span class="nav-label">${item.label}</span>
                                    </button>
                                `
                            )}
                        </nav>
                    </div>
                </aside>

                <main class="content">
                    <div class="content-header">
                        <div class="content-title">${activeNavLabel}</div>
                        <div class="content-pill" title="Settings auto-save">
                            <span style="opacity:0.9;">Auto-saved</span>
                            <span style="opacity:0.65;">No action needed</span>
                        </div>
                    </div>

                    ${this.renderCategoryContent({ profiles, languages, profileNames, currentProfile, currentLanguage })}
                </main>
            </div>
            </div>

            ${this.promptLibraryOpen
                ? html`<prompt-library-modal
                        open
                        @close=${() => this.closePromptLibrary()}
                        @prompt-saved=${() => this.requestUpdate()}
                    ></prompt-library-modal>`
                : ''}
        `;
    }

    renderNavIcon(id) {
        // Lightweight inline icons (no external deps)
        switch (id) {
            case 'profile':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 21c0-4-3.6-7-8-7s-8 3-8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
            case 'appearance':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 16.5V7.8c0-.44.36-.8.8-.8h14.4c.44 0 .8.36.8.8v8.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M8 20h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M12 7v9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`;
            case 'audio':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 5 7 9H4v6h3l4 4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M18.8 6.2a8 8 0 0 1 0 11.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
                </svg>`;
            case 'providers':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3 4 7v6c0 5 3 8 8 8s8-3 8-8V7l-8-4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M9.5 12l1.7 1.7L14.8 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
            case 'language':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 5h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M7 5c0 7-4 9-4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M5 10c2 2 4 3 8 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M14 19l3-9 3 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M15.2 16h3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`;
            case 'capture':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 7h10a3 3 0 0 1 3 3v7H4v-7a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M9 7l1-2h4l1 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.8"/>
                </svg>`;
            case 'keyboard':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 13h.01M10 13h.01M13 13h.01M16 13h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
                    <path d="M8 16h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`;
            case 'search':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>`;
            case 'advanced':
                return html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3l10 18H2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M12 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M12 17h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
                </svg>`;
            default:
                return html``;
        }
    }

    renderCategoryContent({ profiles, languages, profileNames, currentProfile, currentLanguage }) {
        switch (this.activeCategory) {
            case 'profile':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Undetectable</span></div>
                        <div class="form-grid">
                            <div class="toggle-group">
                                <input
                                    type="checkbox"
                                    class="switch-input"
                                    id="undetectable-enabled"
                                    .checked=${this.undetectableEnabled}
                                    @change=${this.handleUndetectableChange}
                                />
                                <label for="undetectable-enabled" class="switch-label" aria-label="Enable Undetectable"></label>
                                <span class="switch-text">Enable Undetectable</span>
                            </div>
                            <div class="form-description" style="margin-left: 52px; margin-top: -8px;">
                                Toggle the main Undetectable feature. Detailed behavior configuration will follow.
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="section-title"><span>AI Profile & Behavior</span></div>
                        <div class="form-grid">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">
                                        Profile Type
                                        <span class="current-selection">${currentProfile?.name || 'Unknown'}</span>
                                    </label>
                                    <gp-select
                                        .value=${this.selectedProfile}
                                        .options=${profiles.map(p => ({ value: p.value, label: p.name }))}
                                        @gp-change=${e => this.handleProfileSelect({ target: { value: e.detail.value } })}
                                    ></gp-select>
                                </div>
                            </div>

                            <div class="form-group full-width">
                                <label class="form-label"
                                    >Custom AI Instructions
                                    <button class="reset-keybinds-button" style="margin-left:8px" @click=${() => this.openPromptLibrary()}>
                                        Manage Prompts
                                    </button>
                                </label>
                                <textarea
                                    class="form-control"
                                    placeholder="Add specific instructions for how you want the AI to behave during ${
                                        profileNames[this.selectedProfile] || 'this interaction'
                                    }..."
                                    .value=${this.getActivePromptText()}
                                    rows="4"
                                    readonly
                                    title="Read-only. Use Manage Prompts to edit."
                                ></textarea>
                                <div class="form-description">
                                    Personalize the AI's behavior with specific instructions that will be added to the
                                    ${profileNames[this.selectedProfile] || 'selected profile'} base prompts. This field is read-only — use
                                    "Manage Prompts" to edit.
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            case 'providers':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>AI Providers</span></div>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label class="form-label">Deepgram Streaming ASR API Key</label>
                                <input
                                    class="form-control"
                                    type="password"
                                    autocomplete="off"
                                    placeholder="dg_..."
                                    .value=${this.deepgramApiKey || ''}
                                    @input=${e => this.handleDeepgramKeyInput(e)}
                                />
                                <div class="form-description">
                                    Used only for streaming speech-to-text. Required to start a session.
                                </div>
                            </div>

                            <div class="form-group full-width">
                                <label class="form-label">OpenAI Answer LLM API Key</label>
                                <input
                                    class="form-control"
                                    type="password"
                                    autocomplete="off"
                                    placeholder="sk-..."
                                    .value=${this.openaiApiKey || ''}
                                    @input=${e => this.handleOpenAiKeyInput(e)}
                                />
                                <div class="form-description">
                                    Used only for answer generation (text + optional screenshots). Required to start a session.
                                </div>
                            </div>

                            <div class="form-group full-width">
                                <label class="form-label">OpenAI Model (Answer Generation)</label>
                                <gp-select
                                    .value=${this.openaiModel || 'gpt-4.1-nano'}
                                    .options=${[
                                        { value: 'gpt-4.1-nano', label: 'GPT-4.1 nano (fastest / low latency)' },
                                        { value: 'gpt-4o-mini', label: 'GPT-4o mini (fast + strong)' },
                                        { value: 'gpt-5-mini', label: 'GPT-5 mini (if available)' },
                                    ]}
                                    @gp-change=${e => this.handleOpenAiModelSelect({ target: { value: e.detail.value } })}
                                ></gp-select>
                                <div class="form-description">
                                    Default is GPT-4.1 nano for lowest latency. If unavailable on your account, the app will fall back automatically.
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            case 'appearance':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Interface Layout</span></div>
                        <div class="form-grid">
                           

                            <div class="form-group full-width">
                                <div class="slider-container">
                                    <div class="slider-header">
                                        <label class="form-label">Background Transparency</label>
                                        <span class="slider-value">${Math.round(this.backgroundTransparency * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        class="slider-input"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        .value=${this.backgroundTransparency}
                                        @input=${this.handleBackgroundTransparencyChange}
                                    />
                                    <div class="slider-labels">
                                        <span>Transparent</span>
                                        <span>Opaque</span>
                                    </div>
                                    <div class="form-description">Adjust the transparency of the interface background elements</div>
                                </div>
                            </div>

                            <div class="form-group full-width">
                                <div class="slider-container">
                                    <div class="slider-header">
                                        <label class="form-label">Response Font Size</label>
                                        <span class="slider-value">${this.fontSize}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        class="slider-input"
                                        min="12"
                                        max="32"
                                        step="1"
                                        .value=${this.fontSize}
                                        @input=${this.handleFontSizeChange}
                                    />
                                    <div class="slider-labels">
                                        <span>12px</span>
                                        <span>32px</span>
                                    </div>
                                    <div class="form-description">Adjust the font size of AI response text in the assistant view</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="section-title"><span>Highlight Color</span></div>
                        <div class="form-grid">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Main Points Highlight</label>
                                    <input
                                        type="color"
                                        class="form-control"
                                        .value=${this.pendingHighlightColor || this.highlightColor}
                                        @input=${this.handleHighlightColorChange}
                                    />
                                    <div class="form-description">Select the color used to highlight important points.</div>
                                    ${this.pendingHighlightColor && this.pendingHighlightColor !== this.highlightColor
                                        ? html`<button
                                                class="reset-keybinds-button"
                                                style="border-color: ${this.pendingHighlightColor};"
                                                @click=${this.saveHighlightColor}
                                            >
                                                Save
                                            </button>`
                                        : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            case 'audio':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Audio</span></div>
                        <div class="form-grid">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">
                                        Audio Mode
                                        <span class="current-selection">${this.selectedAudioMode === 'mic' ? 'Mic' : 'Speaker'}</span>
                                    </label>
                                    <gp-select
                                        .value=${this.selectedAudioMode}
                                        .options=${[
                                            { value: 'speaker', label: 'Speaker (Interviewer voice only)' },
                                            { value: 'mic', label: 'Mic (Your voice only)' },
                                        ]}
                                        @gp-change=${e => this.handleAudioModeSelect({ target: { value: e.detail.value } })}
                                    ></gp-select>
                                    <div class="form-description">Choose whether to listen to interviewer (speaker) or your mic</div>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">
                                        Transcription Mode
                                        <span class="current-selection">${this.selectedTranscriptionMode === 'auto' ? 'Auto' : 'Manual'}</span>
                                    </label>
                                    <gp-select
                                        .value=${this.selectedTranscriptionMode}
                                        .options=${[
                                            { value: 'manual', label: 'Manual (listen silently, answer only on Ctrl/Cmd+Enter or action buttons)' },
                                            { value: 'auto', label: 'Auto (answer automatically after each detected question)' },
                                        ]}
                                        @gp-change=${e => this.handleTranscriptionModeSelect({ target: { value: e.detail.value } })}
                                    ></gp-select>
                                    <div class="form-description">
                                        Manual mode is recommended for interview-style conversations where you decide exactly when the AI should answer.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            case 'language':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Language</span></div>
                        <div class="form-grid">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">
                                        Speech Language
                                        <span class="current-selection">${currentLanguage?.name || 'Unknown'}</span>
                                    </label>
                                    <gp-select
                                        .value=${this.selectedLanguage}
                                        .options=${languages.map(l => ({ value: l.value, label: l.name }))}
                                        @gp-change=${e => this.handleLanguageSelect({ target: { value: e.detail.value } })}
                                    ></gp-select>
                                    <div class="form-description">Language for speech recognition and AI responses</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            case 'capture':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Screen Capture Settings</span></div>
                        <div class="form-grid">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">
                                        Capture Interval
                                        <span class="current-selection">
                                            ${this.selectedScreenshotInterval === 'manual' ? 'Manual' : this.selectedScreenshotInterval + 's'}
                                        </span>
                                    </label>
                                    <gp-select
                                        .value=${this.selectedScreenshotInterval}
                                        .options=${[
                                            { value: 'manual', label: 'Manual (On demand)' },
                                            { value: '1', label: 'Every 1 second' },
                                            { value: '2', label: 'Every 2 seconds' },
                                            { value: '5', label: 'Every 5 seconds' },
                                            { value: '10', label: 'Every 10 seconds' },
                                        ]}
                                        @gp-change=${e => this.handleScreenshotIntervalSelect({ target: { value: e.detail.value } })}
                                    ></gp-select>
                                    <div class="form-description">
                                        ${this.selectedScreenshotInterval === 'manual'
                                            ? 'Screenshots will only be taken when you use the "Ask Next Step" shortcut'
                                            : 'Automatic screenshots will be taken at the specified interval'}
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">
                                        Image Quality
                                        <span class="current-selection">
                                            ${this.selectedImageQuality.charAt(0).toUpperCase() + this.selectedImageQuality.slice(1)}
                                        </span>
                                    </label>
                                    <gp-select
                                        .value=${this.selectedImageQuality}
                                        .options=${[
                                            { value: 'high', label: 'High Quality' },
                                            { value: 'medium', label: 'Medium Quality' },
                                            { value: 'low', label: 'Low Quality' },
                                        ]}
                                        @gp-change=${e => this.handleImageQualitySelect({ target: { value: e.detail.value } })}
                                    ></gp-select>
                                    <div class="form-description">
                                        ${this.selectedImageQuality === 'high'
                                            ? 'Best quality, uses more tokens'
                                            : this.selectedImageQuality === 'medium'
                                              ? 'Balanced quality and token usage'
                                              : 'Lower quality, uses fewer tokens'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            case 'keyboard':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Keyboard Shortcuts</span></div>
                        <table class="keybinds-table">
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Shortcut</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.getKeybindActions().map(
                                    action => html`
                                        <tr>
                                            <td>
                                                <div class="action-name">${action.name}</div>
                                                <div class="action-description">${action.description}</div>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    class="form-control keybind-input"
                                                    .value=${this.keybinds[action.key]}
                                                    placeholder="Press keys..."
                                                    data-action=${action.key}
                                                    @keydown=${this.handleKeybindInput}
                                                    @focus=${this.handleKeybindFocus}
                                                    readonly
                                                />
                                            </td>
                                        </tr>
                                    `
                                )}
                                <tr class="table-reset-row">
                                    <td colspan="2">
                                        <button class="reset-keybinds-button" @click=${this.resetKeybinds}>Reset to Defaults</button>
                                        <div class="form-description" style="margin-top: 8px;">
                                            Restore all keyboard shortcuts to their default values
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;

            case 'search':
                return html`
                    <div class="settings-section">
                        <div class="section-title"><span>Google Search</span></div>
                        <div class="form-grid">
                            <div class="checkbox-group">
                                <input
                                    type="checkbox"
                                    class="checkbox-input"
                                    id="google-search-enabled"
                                    .checked=${this.googleSearchEnabled}
                                    @change=${this.handleGoogleSearchChange}
                                />
                                <label for="google-search-enabled" class="checkbox-label"> Enable Google Search </label>
                            </div>
                            <div class="form-description" style="margin-left: 24px; margin-top: -8px;">
                                Allow the AI to search Google for up-to-date information and facts during conversations
                                <br /><strong>Note:</strong> Changes take effect when starting a new AI session
                            </div>
                        </div>
                    </div>
                `;

            case 'advanced':
                return html`
                    <div
                        class="settings-section"
                        style="border-color: var(--danger-border, rgba(239, 68, 68, 0.3)); background: var(--danger-background, rgba(239, 68, 68, 0.05));"
                    >
                        <div class="section-title" style="color: var(--danger-color, #ef4444);">
                            <span>⚠️ Advanced Mode</span>
                        </div>

                        <div class="form-grid">
                            <div class="checkbox-group">
                                <input
                                    type="checkbox"
                                    class="checkbox-input"
                                    id="advanced-mode"
                                    .checked=${this.advancedMode}
                                    @change=${this.handleAdvancedModeChange}
                                />
                                <label for="advanced-mode" class="checkbox-label"> Enable Advanced Mode </label>
                            </div>
                            <div class="form-description" style="margin-left: 24px; margin-top: -8px;">
                                Unlock experimental features, developer tools, and advanced configuration options
                                <br /><strong>Note:</strong> Advanced mode adds a new icon to the main navigation bar
                            </div>
                        </div>
                    </div>

                    <div class="settings-note">
                        💡 Settings are automatically saved as you change them. Changes will take effect immediately or on the next session start.
                    </div>
                `;

            default:
                return html``;
        }
    }

    handleDeepgramKeyInput(e) {
        const v = String(e?.target?.value || '');
        this.deepgramApiKey = v;
        try { localStorage.setItem('deepgramApiKey', v); } catch (_) {}
    }

    handleOpenAiKeyInput(e) {
        const v = String(e?.target?.value || '');
        this.openaiApiKey = v;
        try { localStorage.setItem('openaiApiKey', v); } catch (_) {}
    }

    handleOpenAiModelSelect(e) {
        const v = String(e?.target?.value || '').trim() || 'gpt-4.1-nano';
        this.openaiModel = v;
        try { localStorage.setItem('openaiModel', v); } catch (_) {}
        this.requestUpdate();
    }
}

customElements.define('customize-view', CustomizeView);
