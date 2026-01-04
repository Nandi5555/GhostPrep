import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { formatAnswer } from '../../utils/answerFormatter.js';

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
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
            border: 1px solid var(--border-color);
        }

        .response-container.chat {
            background: transparent;
            border: none;
            box-shadow: none;
            padding: 0;
        }

        .response-container.transcript {
            /* Keep the transcript area clean (no dark container panel) */
            background: transparent;
            border: none;
            box-shadow: none;
            padding: 0;
        }

        .transcript-row {
            display: flex;
            width: 100%;
            margin: 8px 0;
            align-items: flex-end;
        }
        .transcript-row.right { justify-content: flex-end; }
        .transcript-row.left { justify-content: flex-start; }

        .transcript-bubble {
            max-width: 88%;
            font-size: var(--response-font-size, 18px);
            line-height: 1.6;
            display: inline-block;
            padding: 10px 12px;
            border-radius: 14px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            word-break: break-word;
            background: transparent;
            border: 1px solid transparent;
        }
        .transcript-bubble.user {
            /* Match the "selected" highlight from gp-select menu items */
            color: var(--primary-button-text, #ffffff);
            background: linear-gradient(180deg, rgba(0, 122, 255, 0.22), rgba(0, 122, 255, 0.10));
            border-color: rgba(0, 122, 255, 0.38);
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.06),
                0 10px 24px rgba(0, 0, 0, 0.32);
        }
        .transcript-bubble.interviewer {
            /* Neutral (no blue) */
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.14);
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
            color: var(--text-color);
        }

        .chat-row {
            display: flex;
            width: 100%;
            margin: 8px 0;
        }
        .chat-row.right { justify-content: flex-end; }
        .chat-row.left { justify-content: flex-start; }
        .chat-row.actions { margin-top: 2px; margin-bottom: 0; }
        .bubble {
            max-width: 78%;
            padding: 10px 12px;
            border-radius: 14px;
            border: 1px solid var(--border-color);
            box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }
        .bubble.user {
            /* Match Transcript tab "user speaking" bubble for consistency */
            max-width: 88%;
            font-size: var(--response-font-size, 18px);
            line-height: 1.6;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            word-break: break-word;
            color: var(--primary-button-text, #ffffff);
            background: linear-gradient(180deg, rgba(0, 122, 255, 0.22), rgba(0, 122, 255, 0.10));
            border-color: rgba(0, 122, 255, 0.38);
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.06),
                0 10px 24px rgba(0, 0, 0, 0.32);
            border-radius: 14px;
            overflow: hidden;
        }
        .bubble.user.multiline {
            border-radius: 14px;
        }
        .bubble.ai {
            /* Neutral "glass/gray" like interviewer transcript (avoid solid black panel) */
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
                rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.14);
            backdrop-filter: blur(10px);
        }

        .copy-btn {
            background: transparent;
            color: var(--description-color, #9aa6b2);
            border: none;
            padding: 6px;
            border-radius: 10px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            margin: 0 6px 0 0;
            box-shadow: none;
            backdrop-filter: none;
        }
        .copy-btn:hover { background: transparent; }
        .copy-btn:active { transform: translateY(1px); }

        .answer-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 0;
        }

        .answer-block {
            max-width: 100%;
            margin: 8px 0 0 0;
        }
        .answer-block > *:last-child { margin-bottom: 0 !important; }
        .message-block .chat-row.right { margin-bottom: 0; }
        .chat-row.actions { margin-top: 0; margin-bottom: 0; }

        /* Cluely-style: "Sent with screenshot" + hover preview */
        .screenshot-meta-row {
            display: flex;
            justify-content: flex-end;
            margin: 4px 6px 0 0;
        }
        .screenshot-meta {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.55);
        }
        .screenshot-meta .icon {
            width: 14px;
            height: 14px;
            opacity: 0.7;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .screenshot-meta:hover { color: rgba(255, 255, 255, 0.75); }
        .screenshot-popover {
            display: none;
            position: absolute;
            right: 0;
            top: calc(100% + 8px);
            transform: none;
            width: min(320px, 72vw);
            max-height: min(240px, calc(100vh - 140px));
            padding: 8px;
            border-radius: 12px;
            background: rgba(20, 22, 28, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.14);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(10px);
            z-index: 50;
            overflow: auto;
        }
        .screenshot-meta[data-popover-pos="up"] .screenshot-popover {
            top: auto;
            bottom: calc(100% + 8px);
        }
        .screenshot-meta:hover .screenshot-popover { display: block; }
        .screenshot-popover img {
            width: 100%;
            height: auto;
            border-radius: 10px;
            display: block;
        }

        .answer-block.placeholder {
            min-height: var(--answer-placeholder-height, 120px);
        }

        /* Loader: Cluely-style 3 dots (no container, no spinner) */
        .dots-loader {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            user-select: none;
            /* Keep it visually consistent with the app's subtle UI text */
            opacity: 0.95;
        }
        .dots-loader .dot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: var(--description-color, #9aa6b2);
            opacity: 0.35;
            transform: translateY(0) scale(0.95);
            animation: gp-dotPulse 1.05s ease-in-out infinite;
        }
        .dots-loader .dot:nth-child(2) { animation-delay: 0.15s; }
        .dots-loader .dot:nth-child(3) { animation-delay: 0.30s; }

        @keyframes gp-dotPulse {
            0%, 80%, 100% {
                opacity: 0.28;
                transform: translateY(0) scale(0.95);
            }
            35% {
                opacity: 0.92;
                transform: translateY(-2px) scale(1.0);
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .dots-loader .dot {
                animation: none;
                opacity: 0.6;
                transform: none;
            }
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
            /* Neutral (no black panel) — match the glassy gray look */
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03)),
                rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 10px;
            padding: 1em;
            overflow-x: auto;
            margin: 1em 0;
            backdrop-filter: blur(10px);
        }

        .response-container pre code {
            background: none;
            padding: 0;
            border-radius: 0;
        }

        /* Match horizontal/vertical scrollbar styling inside code blocks */
        .response-container pre {
            /* Firefox */
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
        }
        .response-container pre::-webkit-scrollbar {
            width: 3px;   /* vertical scrollbar width */
            height: 3px;  /* horizontal scrollbar height */
        }
        .response-container pre::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 999px;
        }
        .response-container pre::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 999px;
            border: 1px solid transparent;
            background-clip: padding-box;
        }
        .response-container pre::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Ensure inner <code> element scrollbars (horizontal) are equally thin */
        .response-container pre code {
            /* Firefox */
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
        }
        .response-container pre code::-webkit-scrollbar {
            width: 3px;   /* vertical */
            height: 3px;  /* horizontal */
        }
        .response-container pre code::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 999px;
        }
        .response-container pre code::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 999px;
            border: 1px solid transparent;
            background-clip: padding-box;
        }
        .response-container pre code::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
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
            color: var(--highlight-color);
            background: var(--highlight-bg-color);
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
            width: 5px;
            height: 5px;
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

        

        .text-input-container {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 10px;
            background: transparent;
            border: none;
            border-radius: 12px;
            padding: 0;
        }

        .input-row {
            display: flex;
            gap: 10px;
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
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--glass-border);
            padding: 8px 12px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.2;
            height: 36px;
            min-height: 36px;
            max-height: 80px;
            overflow-y: auto;
            resize: none;
            scrollbar-width: none;
            -ms-overflow-style: none;
            scroll-behavior: smooth;
            transition: height 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
            box-shadow: 0 0 0 1px var(--glass-border), inset 0 1px var(--glass-highlight);
        }

        .text-input-container textarea:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        .text-input-container:focus-within textarea {
            height: 60px;
            max-height: 120px;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 2px var(--focus-box-shadow), inset 0 1px var(--glass-highlight);
        }

        .text-input-container textarea::placeholder {
            color: var(--placeholder-color);
        }

        /* Hide scrollbars in WebKit browsers while keeping scroll functional */
        .text-input-container textarea::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        .text-input-container textarea::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 6px;
        }
        .text-input-container textarea::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 6px;
            border: 1px solid transparent;
            background-clip: padding-box;
            transition: background-color 0.2s ease;
        }
        .text-input-container textarea::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Limit generic button styling to non-send buttons */
        .text-input-container .nav-button {
            background: transparent;
            color: var(--start-button-background);
            border: none;
            padding: 0;
            border-radius: 100px;
        }

        .text-input-container .nav-button:hover {
            background: var(--text-input-button-hover);
        }

        .input-actions {
            display: none;
            padding: 8px;
            border-top: 1px solid var(--button-border);
            background: var(--screen-option-background, rgba(0,0,0,0.4));
            border-radius: 10px;
            align-items: center;
            gap: 8px;
        }
        .text-input-container:focus-within .input-actions { display: flex; }

        .use-screen-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            font-size: 12px;
        }
        .use-screen-btn.active {
            color: var(--primary-button-text, #ffffff);
            border: 1px solid rgba(255, 255, 255, 0.28);
            background:
                linear-gradient(to bottom, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.24) 38%, rgba(255, 255, 255, 0.08) 60%, rgba(255, 255, 255, 0) 100%),
                linear-gradient(to bottom, #4b82d6 0%, #3a6fc1 52%, #2f5aa6 100%);
            box-shadow: inset 0 1px rgba(255, 255, 255, 0.5), inset 0 -2px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.28);
        }

        .input-actions .send-button { margin-left: auto; }

        .nav-button {
            background: rgba(255, 255, 255, 0.06);
            color: white;
            border: 1px solid var(--button-border);
            padding: 4px;
            border-radius: 10px;
            font-size: 12px;
            display: flex;
            align-items: center;
            width: 36px;
            height: 36px;
            justify-content: center;
        }

        .nav-button:hover { background: var(--glass-hover-bg); }
        .nav-button { backdrop-filter: blur(10px); box-shadow: var(--glass-shadow); transition: background-color 0.2s ease, transform 0.12s ease; }
        .nav-button:active { transform: translateY(1px); }

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

        .tabbar { display: flex; gap: 8px; align-items: center; margin: 0 0 8px 0; }
        .tab-btn {
            background: var(--glass-bg);
            color: var(--text-color);
            border: 1px solid var(--glass-border);
            border-radius: 999px;
            padding: 8px 12px;
            font-size: 12px;
            backdrop-filter: blur(10px);
            box-shadow: var(--glass-shadow);
            transition: background-color 0.2s ease, transform 0.12s ease;
        }
        .tab-btn:hover { background: var(--glass-hover-bg); }
        .tab-btn:active { transform: translateY(1px); }
        .tab-btn.active { box-shadow: 0 0 0 2px var(--focus-border-color, #007aff); }
        
        .send-primary { background: var(--text-input-button-hover); color: #fff; border: 1px solid var(--button-border); border-radius: 10px; padding: 8px 12px; font-size: 12px; }
        .send-button {
            color: var(--primary-button-text, #ffffff);
            width: 36px;
            height: 36px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.28);
            background:
                linear-gradient(to bottom, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.24) 38%, rgba(255, 255, 255, 0.08) 60%, rgba(255, 255, 255, 0) 100%),
                linear-gradient(to bottom, #4b82d6 0%, #3a6fc1 52%, #2f5aa6 100%);
            box-shadow: inset 0 1px rgba(255, 255, 255, 0.5), inset 0 -2px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.28);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.12s ease, filter 0.2s ease;
            backdrop-filter: blur(8px);
        }
        /* No hover color change for send button */
        .send-button:active { transform: translateY(1px); }

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
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
                rgba(255, 255, 255, 0.04);
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

        /* Prompt buttons next to Auto-scroll */
        .prompt-buttons {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-left: 10px;
            flex-wrap: wrap;
        }
        .prompt-button { background: var(--glass-bg); color: var(--text-color); border: 1px solid var(--glass-border); border-radius: 999px; padding: 6px 10px; font-size: 12px; line-height: 1; cursor: default; backdrop-filter: blur(10px); box-shadow: var(--glass-shadow); transition: background-color 0.2s ease, transform 0.12s ease, box-shadow 0.2s ease; }
        .prompt-button:hover { background: var(--glass-hover-bg); }
        .prompt-button:active { transform: translateY(1px); }
        .prompt-button.pulse {
            box-shadow: 0 0 0 2px var(--focus-border-color, #007aff); /* blue outline on click */
        }

        /* Right-side sliding modal for prompt configuration */
        .prompt-panel-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(2px);
            display: flex;
            justify-content: flex-end;
            align-items: stretch;
            z-index: 9998;
        }
        .prompt-panel {
            width: 340px;
            max-width: 92vw;
            height: 100%;
            background: var(--main-content-background);
            border-left: 1px solid var(--border-color);
            border-radius: 8px 0 0 8px;
            transform: translateX(100%);
            transition: transform 0.2s ease-out;
            display: flex;
            flex-direction: column;
        }
        .prompt-panel.open {
            transform: translateX(0);
        }
        .prompt-panel-header {
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .prompt-panel-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--text-color);
        }
        .prompt-panel-body {
            flex: 1;
            overflow: auto;
            padding: 10px;
        }
        .prompt-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background: var(--card-background);
            margin-bottom: 10px;
        }
        .prompt-row input,
        .prompt-row textarea {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 12px;
        }
        .prompt-row textarea {
            min-height: 64px;
            resize: vertical;
        }
        /* Thin rounded scrollbars inside prompt editor textareas */
        .prompt-row textarea {
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.35)) var(--scrollbar-track, transparent);
        }
        .prompt-row textarea::-webkit-scrollbar { width: 6px; height: 6px; }
        .prompt-row textarea::-webkit-scrollbar-track { background: var(--scrollbar-track, transparent); border-radius: 8px; }
        .prompt-row textarea::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.35)); border-radius: 8px; }
        .prompt-row textarea::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.5)); }
        .prompt-row textarea::-webkit-scrollbar-thumb:active { background: var(--scrollbar-thumb-active, rgba(255, 255, 255, 0.6)); }
        .prompt-panel-actions {
            padding: 10px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .prompt-action-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: default;
        }
        .prompt-action-button:hover {
            background: var(--hover-background);
        }
        .add-prompt-button:disabled {
            opacity: 0.4;
            cursor: default;
        }
        /* Modal scrollbar styling */
        .prompt-panel-body::-webkit-scrollbar {
            width: 5px;
            height: 5px;
        }
        .prompt-panel-body::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 6px;
        }
        .prompt-panel-body::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 6px;
            border: 1px solid transparent;
            background-clip: padding-box;
            transition: background-color 0.2s ease;
        }
        .prompt-panel-body::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Resize handles overlay */
        .resize-overlay {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
        }
        .message-block {
            min-height: 100%;
            display: block;
            width: 100%;
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
        questions: { type: Array },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        statusText: { type: String },
        onSendText: { type: Function },
        isStreaming: { type: Boolean },
        autoScrollEnabled: { type: Boolean },
        promptPanelOpen: { type: Boolean },
        // Streaming inputs from parent component
        streamDelta: { type: String },
        streamSession: { type: Number },
        streamIsFinal: { type: Boolean },
        activeTab: { type: String },
        transcriptText: { type: String },
        onTabChange: { type: Function },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.questions = [];
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.statusText = '';
        this.onSendText = () => {};
        this.isStreaming = false;
        this.streamDelta = '';
        this.streamSession = 0;
        this.streamIsFinal = false;
        // Syntax highlighting library instance (loaded in connectedCallback)
        this.hljs = null;
        // Load toggles from localStorage
        this.autoScrollEnabled = localStorage.getItem('assistantAutoScroll') !== 'false';
        // Prompt panel and buttons state
        this.promptPanelOpen = false;
        this.promptButtons = [];
        this.editablePrompts = [];
        this._lastPromptClickTs = 0;
        this.activeTab = 'chat';
        this.transcriptText = '';
        this.onTabChange = () => {};
        this.audioMode = (localStorage.getItem('selectedAudioMode') || 'speaker');

        // Internal streaming state (typewriter engine)
        this._streamTypedText = '';
        this._streamTargetText = '';
        this._currentStreamSession = 0;
        this._typingInterval = null;
        this._typingCharsPerTick = 6;
        this._typingMs = 8;
        this._typingRaf = null;
        this._typingLastTs = 0;
        this._typingCharsPerSecond = 300;
        this._finalEventEmitted = false;
        this._lastRenderedCount = 0;
        this.useScreen = localStorage.getItem('assistantUseScreen') === 'true';
        this.inputFocused = false;
        this._snapToActivePending = false;
        // Streaming markdown rendering (throttled)
        this._streamRenderTimer = null;
        this._streamRenderLastAt = 0;
        this._streamRenderMinIntervalMs = 65; // fast but avoids re-parsing markdown per token
    }

scrollToTop() {
    // Disabled (no auto-scroll should ever happen)
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

    getCurrentQuestion() {
        return this.questions && this.currentResponseIndex >= 0 && this.currentResponseIndex < this.questions.length
            ? (this.questions[this.currentResponseIndex] || '')
            : '';
    }

    async copyQuestion(index) {
        try {
            const qItem = (this.questions || [])[index] || '';
            const q = (typeof qItem === 'string' ? qItem : String(qItem?.text || '')).trim();
            if (!q) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(q);
            } else {
                const ta = document.createElement('textarea');
                ta.value = q;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
        } catch (_) {}
    }

    async copyAnswer(index) {
        try {
            const container = this.shadowRoot?.querySelector('#responseContainer');
            const el = container?.querySelector(`#answer-${index}`);
            if (!el) return;
            const html = el.innerHTML;
            const text = el.innerText;
            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                });
                await navigator.clipboard.write([item]);
            } else if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
        } catch (_) {}
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

                const tokenizer = {
                    code: () => undefined,
                };

                window.marked.use({ renderer, tokenizer });

                // Do not "fix" or restructure model output here.
                // Formatting is the model's responsibility via system/custom prompts.
                const rendered = window.marked.parse(String(content || '').replace(/\r\n/g, '\n'));
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.warn('Marked not available, using plain text');
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

    hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    loadHighlightColor() {
        const saved = localStorage.getItem('highlightColor');
        if (saved) {
            const root = document.documentElement;
            root.style.setProperty('--highlight-color', saved);
            root.style.setProperty('--highlight-bg-color', this.hexToRgba(saved, 0.16));
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Load and apply font size
        this.loadFontSize();

        this.loadHighlightColor();

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
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
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

        window.addEventListener('resize', () => {
        this.fitActiveViewport();
        this._snapToActivePending = true;
        this.requestUpdate();
    });

        window.addEventListener('storage', (e) => {
            if (e.key === 'selectedAudioMode') {
                this.audioMode = (e.newValue || 'speaker');
                if (this.activeTab === 'transcript') this.updateTranscriptContent();
            }
        });

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
            textInput.value = ''; 
            this.adjustTextareaHeight(textInput);

            this._snapToActivePending = true;

            this.requestUpdate(); 
            // Capture a screenshot exactly at submit time (no interval).
            let screenshotPreviewDataUrl = '';
            try {
                if (this.useScreen && typeof window.captureManualScreenshotWithPreview === 'function') {
                    const cap = await window.captureManualScreenshotWithPreview('high');
                    if (cap && cap.success && cap.previewDataUrl) {
                        screenshotPreviewDataUrl = cap.previewDataUrl;
                    }
                }
            } catch (_) {}

            await this.onSendText(message, { screenshotPreviewDataUrl });
        }
    }

    

    async handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const textInput = this.shadowRoot?.querySelector('#textInput');
            const hasText = !!textInput && textInput.value.trim().length > 0;
            if (hasText) {
                await this.handleSendText();
            } else {
                if (this.useScreen) {
                    try {
                        // IMPORTANT: Screenshot capture is best-effort. Even if captureManualScreenshot
                        // is unavailable (startup/init edge cases), we must still show UI feedback and
                        // submit the buffered transcription.

                        try {
                            if (typeof window.captureManualScreenshotWithPreview === 'function') {
                                const cap = await window.captureManualScreenshotWithPreview('high');
                                if (cap && cap.success && cap.previewDataUrl) {
                                    try { window.__stashNextChatScreenshotPreview?.(cap.previewDataUrl); } catch (_) {}
                                }
                            }
                        } catch (_) {}

                        // Always submit the buffered transcript, regardless of screenshot capability.
                        try {
                            if (window.require) {
                                const { ipcRenderer } = window.require('electron');
                                await ipcRenderer.invoke('send-current-transcription', {
                                    actionName: 'Assist',
                                    actionPrompt: 'Assist!',
                                    uiAlreadyShown: true,
                                });
                            }
                        } catch (_) {}
                    } catch (_) {}
                } else {
                    try {
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron');
                            await ipcRenderer.invoke('send-current-transcription', { actionName: 'Assist', actionPrompt: 'Assist!', uiAlreadyShown: true });
                        }
                    } catch (_) {}
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
        // Intentionally no auto-focus
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

    async toggleUseScreen() {
        this.useScreen = !this.useScreen;
        try {
            localStorage.setItem('assistantUseScreen', this.useScreen ? 'true' : 'false');

            // IMPORTANT: await main-process gate update to avoid races where screenshots are ignored.
            try {
                if (window.require) {
                    const { ipcRenderer } = window.require('electron');
                    await ipcRenderer.invoke('set-use-screen-enabled', this.useScreen);
                }
            } catch (_) {}
        } catch (_) {}
        this.requestUpdate();
    }

    handleInputFocus() {
        this.inputFocused = true;
        this.requestUpdate();
    }

    handleInputBlur() {
        const container = this.shadowRoot?.querySelector('.text-input-container');
        setTimeout(() => {
            const open = container ? container.matches(':focus-within') : false;
            this.inputFocused = !!open;
            this.requestUpdate();
        }, 10);
    }

scrollToBottom() {
    const container = this.shadowRoot?.querySelector('#responseContainer');
    if (!container) return;
    container.scrollTop = container.scrollHeight;
}

scrollToActiveBlockTop() {
    const container = this.shadowRoot?.querySelector('#responseContainer');
    if (!container) return;
    const active = container.querySelector('#active-block');
    if (!active) return;
    const pad = 12;
    const nextTop = Math.max(0, (active.offsetTop || 0) - pad);
    container.scrollTop = nextTop;
}


    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
        this.updateTranscriptContent();
        // Do not auto-resize on first render; keep compact initial height.
        try {
            const container = this.shadowRoot?.querySelector('#responseContainer');
            if (container && !this._resizeObserver) {
                // Keep the observer for layout stability, but do not force active block sizing.
                this._resizeObserver = new ResizeObserver(() => {});
                this._resizeObserver.observe(container);
            }
        } catch (_) {}
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (
            changedProperties.has('responses') ||
            changedProperties.has('currentResponseIndex') ||
            changedProperties.has('isStreaming') ||
            changedProperties.has('questions')
        ) {
            this.updateResponseContent();
        }
if (changedProperties.has('currentResponseIndex')) {
    // Mark that the next render should snap to the new question
    this._snapToActivePending = true;
}

        // Auto-scroll: do it ONCE when a new question becomes active.
        // Do NOT re-scroll when the final response arrives (stream completion), otherwise it "pushes" the
        // question/answer and interrupts reading.
        if (this._snapToActivePending && this.autoScrollEnabled) {
            try { this.scrollToActiveBlockTop(); } catch (_) {}
            this._snapToActivePending = false;
        }

        // Streaming coordination
        if (changedProperties.has('streamSession')) {
            this._handleStreamSessionChange();
        }
        if (changedProperties.has('streamDelta')) {
            this._handleStreamDeltaChange();
        }
        if (changedProperties.has('isStreaming')) {
            this._handleStreamingStateChange();
        }
        if (changedProperties.has('promptPanelOpen') && this.promptPanelOpen) {
            this.openPromptPanel();
        }
        if (changedProperties.has('transcriptText')) {
            this.updateTranscriptContent();
        }
        if (changedProperties.has('activeTab')) {
            if (this.activeTab === 'transcript') this.updateTranscriptContent();
            else this.updateResponseContent();
        }
    }

 fitActiveViewport() {
    // Cluely-style chat: do not force the newest block to fill the viewport.
    // We keep a normal scrollable chat history and optionally auto-scroll to bottom.
}


updateResponseContent() {
    const container = this.shadowRoot.querySelector('#responseContainer');
    if (!container) {
        console.warn('Response container not found');
        return;
    }

    const escape = (s) =>
        String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const maxLen = Math.max(
        (this.questions || []).length,
        (this.responses || []).length
    );

    let htmlStr = '';

    for (let i = 0; i < maxLen; i++) {
        const qItem = (this.questions || [])[i] || '';
        const q = typeof qItem === 'string' ? qItem : String(qItem?.text || '');
        const screenshotPreview =
            typeof qItem === 'object' && qItem?.screenshot?.previewDataUrl
                ? String(qItem.screenshot.previewDataUrl)
                : '';
        const isCurrent = i === this.currentResponseIndex;

    // We render the response from `responses[]` directly so the first streamed token
    // appears immediately (no typewriter delay). While streaming, `responses[idx]`
    // is incrementally appended by the app.
    const ansText = ((this.responses || [])[i] || '');
    const formattedText = formatAnswer(ansText, q, null);
    const ansRendered = this.renderMarkdown(formattedText, false);

    const isLatest = i === maxLen - 1;

    // NEW FIX: wrap EVERY block, and only mark the last one as active
    htmlStr += `<div class="message-block ${isLatest ? 'active-block' : ''}" id="${isLatest ? 'active-block' : ''}" data-index="${i}">`;

    if (q && q.trim()) {
        htmlStr += `
            <div class="chat-row right" style="margin-bottom:0">
                <div class="bubble user">${escape(q)}</div>
            </div>
            <div class="chat-row right actions">
                <div class="question-actions">
                    <button class="copy-btn" data-type="question" data-index="${i}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
                            <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
                        </svg>
                    </button>
                </div>
            </div>`;
        if (screenshotPreview) {
            htmlStr += `
                <div class="screenshot-meta-row">
                    <div class="screenshot-meta" aria-label="Sent with screenshot">
                        <span>Sent with screenshot</span>
                        <span class="icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8" opacity="0.9"/>
                                <path d="M7 15l2.5-3 3 4 3.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
                            </svg>
                        </span>
                        <div class="screenshot-popover" role="dialog" aria-label="Captured screenshot preview">
                            <img src="${escape(screenshotPreview)}" alt="Captured screenshot preview" />
                        </div>
                    </div>
                </div>`;
        }
    }

    if (ansText && ansText.trim()) {
        htmlStr += `
            <div class="chat-row left" style="margin-bottom:0">
                <div class="answer-block" id="answer-${i}">${ansRendered}</div>
            </div>
            <div class="chat-row left actions">
                <div class="answer-actions">
                    <button class="copy-btn" data-type="answer" data-index="${i}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
                            <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
                        </svg>
                    </button>
                </div>
            </div>`;
    } else if (isCurrent) {
        // IMPORTANT:
        // - Always render an #answer-* element so streaming deltas can paint immediately.
        // - While streaming, do NOT show the loader again (it looks like a second response).
        const showDots = !this.isStreaming;
        htmlStr += `
            <div class="chat-row left">
                <div class="answer-block placeholder" id="answer-${i}">
                    ${showDots ? `
                    <span class="dots-loader" aria-label="Processing">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </span>` : ``}
                </div>
            </div>`;
    }

    htmlStr += `</div>`; // close message-block
}


    container.innerHTML = htmlStr || '';
    this._lastRenderedCount = maxLen;

    if (!this._copyHandlerBound) {
        this._copyHandlerBound = true;
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.copy-btn');
            if (!btn) return;
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            const type = btn.getAttribute('data-type');
            if (type === 'question') {
                this.copyQuestion(idx);
            } else if (type === 'answer') {
                this.copyAnswer(idx);
            }
        });
    }

    // Keep screenshot preview popover within the visible viewport by flipping up/down on hover.
    if (!this._screenshotPopoverBound) {
        this._screenshotPopoverBound = true;
        container.addEventListener('mouseover', (e) => {
            const meta = e.target?.closest?.('.screenshot-meta');
            if (!meta) return;
            // Estimate desired popover height; if there's not enough room below, flip upward.
            const rect = meta.getBoundingClientRect();
            const desired = 240;
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const pos = (spaceBelow < desired && spaceAbove > spaceBelow) ? 'up' : 'down';
            try { meta.dataset.popoverPos = pos; } catch (_) {}
        });
    }

    // Detect multiline user bubbles
    try {
        container.querySelectorAll('.bubble.user').forEach(el => {
            const cs = getComputedStyle(el);
            const lh = parseFloat(cs.lineHeight) || 18;
            const pt = parseFloat(cs.paddingTop) || 0;
            const pb = parseFloat(cs.paddingBottom) || 0;
            const contentH = (el.clientHeight || 0) - pt - pb;

            const isMulti = contentH > lh * 1.25;
            if (isMulti) el.classList.add('multiline');
            else el.classList.remove('multiline');
        });
    } catch (_) {}

    // Highlight code blocks (only when not streaming)
    if (this.hljs && !this.isStreaming) {
        container
            .querySelectorAll('pre:not(.output-block) code')
            .forEach(el => {
                try {
                    this.hljs.highlightElement(el);
                } catch (e) {
                    console.warn('highlightElement error:', e);
                }
            });
    }

    // IMPORTANT:
    // Do NOT auto-scroll here. This method is called frequently (including on stream completion
    // when markdown is finalized), and scrolling here causes the "jump/push up" issue.
    // Auto-scroll is handled once per new active question in `updated()` and once at stream start.
}



    updateTranscriptContent() {
        const container = this.shadowRoot?.querySelector('#transcriptContainer');
        if (!container) return;
        const mode = (this.audioMode || localStorage.getItem('selectedAudioMode') || 'speaker').toLowerCase();
        const isUser = mode === 'mic';
        const escape = (s) => String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const lines = String(this.transcriptText || '').split('\n').filter(l => l.trim().length > 0);
        let html = '';
        for (const line of lines) {
            html += `<div class="transcript-row ${isUser ? 'right' : 'left'}"><div class="transcript-bubble ${isUser ? 'user' : 'interviewer'}">${escape(line)}</div></div>`;
        }
        container.innerHTML = html;
    }

    // --- Streaming engine (typewriter) ---
    _beginStream() {
        // Interrupt any previous stream
        if (this._typingInterval) {
            clearInterval(this._typingInterval);
            this._typingInterval = null;
        }
        if (this._typingRaf) {
            cancelAnimationFrame(this._typingRaf);
            this._typingRaf = null;
        }
        this._streamTypedText = '';
        this._streamTargetText = '';
        this._finalEventEmitted = false;
        this._typingLastTs = performance.now();
        try {
            const container = this.shadowRoot.querySelector('#responseContainer');
            // Disable auto-scroll during streaming
            this._scrollObserver = null;
        } catch (_) {}
        const loop = (ts) => {
            if (!this.isStreaming) return;
            const delta = ts - (this._typingLastTs || ts);
            this._typingLastTs = ts;
            const add = Math.max(1, Math.floor((delta / 1000) * this._typingCharsPerSecond));
            const currentLen = this._streamTypedText.length;
            const targetLen = this._streamTargetText.length;
            if (currentLen < targetLen) {
                const nextLen = Math.min(currentLen + add, targetLen);
                this._streamTypedText = this._streamTargetText.slice(0, nextLen);
                this.updateResponseContent();
                if (this.streamIsFinal && this._streamTypedText.length === this._streamTargetText.length && !this._finalEventEmitted) {
                    this._finalEventEmitted = true;
                    this.dispatchEvent(new CustomEvent('stream-finished'));
                }
            }
            this._typingRaf = requestAnimationFrame(loop);
        };
        this._typingRaf = requestAnimationFrame(loop);
    }

    _endStream() {
        if (this._typingInterval) {
            clearInterval(this._typingInterval);
            this._typingInterval = null;
        }
        if (this._typingRaf) {
            cancelAnimationFrame(this._typingRaf);
            this._typingRaf = null;
        }
        try {
            if (this._scrollObserver) {
                this._scrollObserver.disconnect();
                this._scrollObserver = null;
            }
        } catch (_) {}
        // After stream ends, the final response will be rendered from responses[]
        this._streamTypedText = '';
        this._streamTargetText = '';
    }

    _handleStreamSessionChange() {
        // Streaming is rendered directly from `responses[]` for instant token display.
        // Keep session tracking only (no typewriter loop).
        if (typeof this.streamSession === 'number' && this.streamSession !== this._currentStreamSession) {
            this._currentStreamSession = this.streamSession;
            // Reset per-session streamed HTML buffer
            try {
                const idx = this.currentResponseIndex >= 0 ? this.currentResponseIndex : ((this.responses || []).length - 1);
                const el = this.shadowRoot?.querySelector(`#answer-${idx}`);
                if (el) {
                    el.dataset.streamText = '';
                    el.innerHTML = '';
                }
            } catch (_) {}
            // Auto-scroll: snap to the START of the active message once, then never chase the bottom while streaming.
            if (this.autoScrollEnabled) {
                try { this.scrollToActiveBlockTop(); } catch (_) {}
            }
        }
    }

    _scheduleStreamMarkdownRender(el) {
        try {
            if (!el) return;
            if (this._streamRenderTimer) return;
            const now = Date.now();
            const wait = Math.max(0, this._streamRenderMinIntervalMs - (now - (this._streamRenderLastAt || 0)));
            this._streamRenderTimer = setTimeout(() => {
                this._streamRenderTimer = null;
                this._streamRenderLastAt = Date.now();
                try {
                    const txt = String(el.dataset.streamText || '');
                    if (!txt) return;
                    // Apply the same formatting rules during streaming as we do for the final render:
                    // - wraps detected code blocks into fenced blocks
                    // - ensures consistent labels + global structure rules
                    // This prevents the "no highlighting while streaming, then sudden highlighting at the end" jump.
                    const idx = this.currentResponseIndex >= 0 ? this.currentResponseIndex : ((this.responses || []).length - 1);
                    const q = (this.questions || [])[idx] || '';
                    const formatted = formatAnswer(txt, q, null);
                    el.innerHTML = this.renderMarkdown(formatted, false);
                    // NOTE: renderMarkdown already highlights fenced code using hljs.highlight(),
                    // so we do not call highlightElement() per-update (too expensive).
                    // IMPORTANT: Do NOT auto-scroll during streaming. Keep viewport anchored near the top of the active answer.
                } catch (_) {}
            }, wait);
        } catch (_) {}
    }

    _handleStreamDeltaChange() {
        // Append streaming deltas to the active answer bubble.
        // We render markdown+highlight on a throttle so code is colored while streaming (ChatGPT/Cluely style),
        // without re-parsing markdown on every single token.
        try {
            if (!this.isStreaming) return;
            const delta = String(this.streamDelta || '');
            if (!delta) return;
            const idx = this.currentResponseIndex >= 0 ? this.currentResponseIndex : ((this.responses || []).length - 1);
            const el = this.shadowRoot?.querySelector(`#answer-${idx}`);
            if (!el) return;
            const existing = el.dataset.streamText || '';
            const next = existing + delta;
            el.dataset.streamText = next;
            this._scheduleStreamMarkdownRender(el);
        } catch (_) {}
    }

    _handleStreamingStateChange() {
        // When streaming ends, responses[] already contains the final content.
        if (!this.isStreaming) {
            // Clear any temporary streaming buffer markers
            try {
                const idx = this.currentResponseIndex >= 0 ? this.currentResponseIndex : ((this.responses || []).length - 1);
                const el = this.shadowRoot?.querySelector(`#answer-${idx}`);
                if (el) {
                    delete el.dataset.streamText;
                }
            } catch (_) {}
            this.updateResponseContent();
        }
    }

    _applyTyping() {
        try {
            if (!this.isStreaming) return;
            const currentLen = this._streamTypedText.length;
            const targetLen = this._streamTargetText.length;
            if (currentLen >= targetLen) return; // wait for more deltas
            const nextLen = Math.min(currentLen + this._typingCharsPerTick, targetLen);
            this._streamTypedText = this._streamTargetText.slice(0, nextLen);
            this.updateResponseContent();

            // If final response is expected and we've caught up, signal completion once
            if (this.streamIsFinal && this._streamTypedText.length === this._streamTargetText.length && !this._finalEventEmitted) {
                this._finalEventEmitted = true;
                this.dispatchEvent(new CustomEvent('stream-finished')); // parent will end streaming state
            }
        } catch (e) {
            console.warn('AssistantView _applyTyping error:', e);
        }
    }

    // Toggle handlers
    handleAutoScrollChange(e) {
        const checked = !!(e?.target?.checked);
        this.autoScrollEnabled = checked;
        try {
            localStorage.setItem('assistantAutoScroll', checked ? 'true' : 'false');
        } catch (_) {}
    }

    // --- Prompt buttons logic ---
    loadPromptButtons() {
        try {
            const raw = localStorage.getItem('assistantPromptButtons');
            const arr = raw ? JSON.parse(raw) : [];
            if (Array.isArray(arr)) {
                const cleaned = arr.filter(p => p && typeof p.name === 'string' && typeof p.text === 'string');
                if (cleaned.length === 0) {
                    const defaults = [
                        {
                            name: 'Assist',
                            text: 'Answer the question directly. Treat the transcript as an interviewer question and assume it may contain minor speech-to-text errors. Silently correct obvious transcription mistakes and answer the intended question. Do not mention transcription errors, do not ask clarifying questions.',
                        },
                        {
                            name: 'What should I say next?',
                            text: 'Give me the exact next thing to say (ready to speak). Assume the transcript may have minor speech-to-text errors; silently correct them and respond without mentioning it.',
                        },
                        {
                            name: 'Code Assistance',
                            text: 'Carefully review the captured screen and the conversation.\n\nUnderstand the question clearly, then provide a precise and helpful answer.\n\nAlways follow the Custom AI Instructions/Context provided — they override everything else.',
                        },
                    ];
                    this.savePromptButtons(defaults);
                    return defaults;
                }
                return cleaned;
            }
        } catch (_) {}
        return [];
    }

    savePromptButtons(list) {
        try {
            localStorage.setItem('assistantPromptButtons', JSON.stringify(list || []));
        } catch (_) {}
    }

    openPromptPanel() {
        this.editablePrompts = [...this.loadPromptButtons()];
        this.requestUpdate();
    }

    closePromptPanel() {
        this.dispatchEvent(new CustomEvent('close-prompt-panel', { bubbles: true, composed: true }));
    }

    addPromptRow() {
        if ((this.editablePrompts || []).length >= 5) return;
        this.editablePrompts = [...(this.editablePrompts || []), { name: '', text: '' }];
        this.requestUpdate();
    }

    deletePromptRow(idx) {
        const list = [...(this.editablePrompts || [])];
        if (idx >= 0 && idx < list.length) {
            list.splice(idx, 1);
            this.editablePrompts = list;
            this.requestUpdate();
        }
    }

    updatePromptName(idx, e) {
        const val = (e?.target?.value || '').slice(0, 60);
        const list = [...(this.editablePrompts || [])];
        if (list[idx]) list[idx].name = val;
        this.editablePrompts = list;
        this.requestUpdate();
    }

    updatePromptText(idx, e) {
        const val = (e?.target?.value || '');
        const list = [...(this.editablePrompts || [])];
        if (list[idx]) list[idx].text = val;
        this.editablePrompts = list;
        this.requestUpdate();
    }

    saveEditablePrompts() {
        const cleaned = (this.editablePrompts || [])
            .map(p => ({ name: (p.name || '').trim(), text: (p.text || '').trim() }))
            .filter(p => p.name && p.text)
            .slice(0, 5);
        this.savePromptButtons(cleaned);
        this.promptButtons = cleaned;
        this.closePromptPanel();
    }

    async submitBufferedTranscriptAction(actionName, actionPrompt) {
        try {
            if (!window.require) return;
            const { ipcRenderer } = window.require('electron');
            try {
                const useScreen = localStorage.getItem('assistantUseScreen') === 'true';
                if (useScreen && typeof window.captureManualScreenshotWithPreview === 'function') {
                    const cap = await window.captureManualScreenshotWithPreview('high');
                    if (cap && cap.success && cap.previewDataUrl) {
                        try { window.__stashNextChatScreenshotPreview?.(cap.previewDataUrl); } catch (_) {}
                    }
                }
            } catch (_) {}
            // If the user has pasted text/code but uses a prompt button (Assist),
            // include the text input so voice + text are treated as one intent.
            let typedText = '';
            try {
                const el = this.shadowRoot?.querySelector('#textInput');
                typedText = el && el.value ? String(el.value) : '';
            } catch (_) {
                typedText = '';
            }

            await ipcRenderer.invoke('send-current-transcription', {
                actionName: String(actionName || '').trim(),
                actionPrompt: String(actionPrompt || '').trim(),
                uiAlreadyShown: true,
                typedText,
            });
        } catch (error) {
            console.warn('Failed to submit buffered transcript action:', error?.message || error);
        }
    }

    handlePromptButtonClick(e, idx) {
        const now = Date.now();
        if (now - (this._lastPromptClickTs || 0) < 1000) return; // debounce 1s
        this._lastPromptClickTs = now;

        const btn = e.currentTarget;
        try {
            btn.classList.add('pulse');
            setTimeout(() => btn.classList.remove('pulse'), 250);
        } catch (_) {}

        const prompt = (this.promptButtons || [])[idx];
        if (!prompt) return;

        // Ensure the user sees the result in the chat thread
        try {
            this.activeTab = 'chat';
            if (typeof this.onTabChange === 'function') this.onTabChange('chat');
        } catch (_) {}

        this.submitBufferedTranscriptAction(prompt.name, prompt.text);
    }





    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();
        // Keep prompt buttons in sync
        if (!this.promptButtons || this.promptButtons.length === 0) {
            this.promptButtons = this.loadPromptButtons();
        }

        return html`
            <div class="tabbar">
                <button class="tab-btn ${this.activeTab==='chat'?'active':''}" @click=${() => { this.activeTab='chat'; this.onTabChange('chat'); this.requestUpdate(); }}>Chat</button>
                <button class="tab-btn ${this.activeTab==='transcript'?'active':''}" @click=${() => { this.activeTab='transcript'; this.onTabChange('transcript'); this.requestUpdate(); }}>Transcript</button>
            </div>
            <div class="response-container chat" id="responseContainer" style="display:${this.activeTab==='chat'?'block':'none'}"></div>
            <div class="response-container transcript" id="transcriptContainer" style="white-space:pre-wrap;display:${this.activeTab==='transcript'?'block':'none'}"></div>

            <div class="text-input-container">
                <div class="input-row">
                    <textarea id="textInput" rows="1" placeholder="Type a message to the AI..." @focus=${() => this.handleInputFocus()} @blur=${() => this.handleInputBlur()} @keydown=${this.handleTextKeydown} @input=${this.handleTextInput} @paste=${this.handleTextInput}></textarea>
                    ${this.inputFocused ? '' : html`<button class="send-button" @click=${() => this.handleSendText()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.5003 12H5.41872M5.24634 12.7972L4.24158 15.7986C3.69128 17.4424 3.41613 18.2643 3.61359 18.7704C3.78506 19.21 4.15335 19.5432 4.6078 19.6701C5.13111 19.8161 5.92151 19.4604 7.50231 18.7491L17.6367 14.1886C19.1797 13.4942 19.9512 13.1471 20.1896 12.6648C20.3968 12.2458 20.3968 11.7541 20.1896 11.3351C19.9512 10.8529 19.1797 10.5057 17.6367 9.81135L7.48483 5.24303C5.90879 4.53382 5.12078 4.17921 4.59799 4.32468C4.14397 4.45101 3.77572 4.78336 3.60365 5.22209C3.40551 5.72728 3.67772 6.54741 4.22215 8.18767L5.24829 11.2793C5.34179 11.561 5.38855 11.7019 5.407 11.8459C5.42338 11.9738 5.42321 12.1032 5.40651 12.231C5.38768 12.375 5.34057 12.5157 5.24634 12.7972Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>`}
                </div>
                <div class="input-actions">
                    <button class="use-screen-btn ${this.useScreen ? 'active' : ''}" @click=${() => this.toggleUseScreen()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
                            <path d="M8 13l2.5-3 3 4 3.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>Use Screen</span>
                    </button>
                    ${this.inputFocused ? html`<button class="send-button" @click=${() => this.handleSendText()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.5003 12H5.41872M5.24634 12.7972L4.24158 15.7986C3.69128 17.4424 3.41613 18.2643 3.61359 18.7704C3.78506 19.21 4.15335 19.5432 4.6078 19.6701C5.13111 19.8161 5.92151 19.4604 7.50231 18.7491L17.6367 14.1886C19.1797 13.4942 19.9512 13.1471 20.1896 12.6648C20.3968 12.2458 20.3968 11.7541 20.1896 11.3351C19.9512 10.8529 19.1797 10.5057 17.6367 9.81135L7.48483 5.24303C5.90879 4.53382 5.12078 4.17921 4.59799 4.32468C4.14397 4.45101 3.77572 4.78336 3.60365 5.22209C3.40551 5.72728 3.67772 6.54741 4.22215 8.18767L5.24829 11.2793C5.34179 11.561 5.38855 11.7019 5.407 11.8459C5.42338 11.9738 5.42321 12.1032 5.40651 12.231C5.38768 12.375 5.34057 12.5157 5.24634 12.7972Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>` : ''}
                </div>
            </div>
            <div class="assistant-toggles">
                <label class="assistant-toggle-label">
                    <input type="checkbox" class="assistant-toggle-input" .checked=${this.autoScrollEnabled} @change=${this.handleAutoScrollChange} />
                    <span>Auto-scroll</span>
                </label>
                ${this.promptButtons && this.promptButtons.length > 0
                    ? html`<div class="prompt-buttons">
                          ${this.promptButtons.map(
                              (p, i) => html`<button class="prompt-button" @click=${e => this.handlePromptButtonClick(e, i)}>${p.name}</button>`
                          )}
                      </div>`
                    : ''}
            </div>

            ${this.promptPanelOpen
                ? html`
                      <div class="prompt-panel-overlay" @click=${e => {
                          if (e.target.classList.contains('prompt-panel-overlay')) this.closePromptPanel();
                      }}>
                          <div class="prompt-panel open" @click=${e => e.stopPropagation()}>
                              <div class="prompt-panel-header">
                                  <span class="prompt-panel-title">Configurable Prompt Buttons</span>
                                  <button class="prompt-action-button" @click=${() => this.closePromptPanel()}>Close</button>
                              </div>
                              <div class="prompt-panel-body">
                                    ${(this.editablePrompts || []).map(
                                        (p, idx) => html`
                                            <div class="prompt-row">
                                                <input type="text" placeholder="Name" .value=${p.name} @input=${e => this.updatePromptName(idx, e)} />
                                                <textarea placeholder="Prompt text" .value=${p.text} @input=${e => this.updatePromptText(idx, e)}></textarea>
                                                <div style="display:flex; justify-content:flex-end; gap:8px;">
                                                    <button class="prompt-action-button" @click=${() => this.deletePromptRow(idx)}>Delete</button>
                                                </div>
                                            </div>
                                        `
                                    )}
                                  <button class="prompt-action-button add-prompt-button" @click=${() => this.addPromptRow()} ?disabled=${(this.editablePrompts || []).length >= 5}>
                                      Add prompt
                                  </button>
                              </div>
                              <div class="prompt-panel-actions">
                                  <button class="prompt-action-button" @click=${() => this.saveEditablePrompts()}>Save</button>
                              </div>
                          </div>
                      </div>
                  `
                : ''}

            <div class="resize-overlay">
                <div class="resize-handle bottom" @pointerdown=${e => this._startResize(e, 'bottom')}></div>
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
        const b = this._resizeStartBounds || { x: 0, y: 0, width: 600, height: 200 };
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

    // Duplicate render() removed; primary render is defined earlier in the class.
}

customElements.define('assistant-view', AssistantView);
