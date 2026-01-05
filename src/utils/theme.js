const THEME_PRESETS = [
    {
        id: 'dark',
        name: 'Dark',
        description: 'Cheating Daddy Dark',
        preview: {
            bg: '#1e1e1e',
            panel: '#1a1a1a',
            border: '#333333',
            text: '#e0e0e0',
            muted: '#6b6b6b',
        },
    },
    {
        id: 'midnight',
        name: 'Midnight Blue',
        description: 'Cheating Daddy Midnight',
        preview: {
            bg: '#0d1117',
            panel: '#161b22',
            border: '#30363d',
            text: '#c9d1d9',
            muted: '#6e7681',
        },
    },
    {
        id: 'nord',
        name: 'Nord',
        description: 'Cheating Daddy Nord',
        preview: {
            bg: '#2e3440',
            panel: '#3b4252',
            border: '#3b4252',
            text: '#eceff4',
            muted: '#4c566a',
        },
    },
    {
        id: 'dracula',
        name: 'Dracula',
        description: 'Cheating Daddy Dracula',
        preview: {
            bg: '#282a36',
            panel: '#44475a',
            border: '#44475a',
            text: '#f8f8f2',
            muted: '#6272a4',
        },
    },
    {
        id: 'abyss',
        name: 'Abyss',
        description: 'Cheating Daddy Abyss',
        preview: {
            bg: '#0a0a0a',
            panel: '#141414',
            border: '#1a1a1a',
            text: '#d4d4d4',
            muted: '#505050',
        },
    },
];

const STORAGE_KEY = 'uiThemeChoice';
const TRANSITION_MS = 300;

let _themeChoice = 'dark';
let _resolvedTheme = 'dark';

const _listeners = new Set();

export function getThemePresets() {
    return THEME_PRESETS.slice();
}

export function getThemeChoice() {
    return _themeChoice;
}

export function getResolvedTheme() {
    return _resolvedTheme;
}

export function subscribeTheme(fn) {
    _listeners.add(fn);
    try {
        fn({ themeChoice: _themeChoice, resolvedTheme: _resolvedTheme });
    } catch (_) {}
    return () => _listeners.delete(fn);
}

function _emit() {
    for (const fn of _listeners) {
        try {
            fn({ themeChoice: _themeChoice, resolvedTheme: _resolvedTheme });
        } catch (_) {}
    }
}

function _applyToDocument({ animate } = { animate: true }) {
    if (typeof document === 'undefined' || !document?.documentElement) return;
    const root = document.documentElement;
    if (animate) {
        root.classList.add('theme-transition');
        window.setTimeout(() => {
            try {
                root.classList.remove('theme-transition');
            } catch (_) {}
        }, TRANSITION_MS);
    }
    root.dataset.themeChoice = _themeChoice;
    root.dataset.theme = _resolvedTheme;
}

export function setThemeChoice(themeChoice, { persist = true, animate = true } = {}) {
    const nextChoice = typeof themeChoice === 'string' && themeChoice ? themeChoice : 'dark';
    const isValid = THEME_PRESETS.some(t => t.id === nextChoice);
    _themeChoice = isValid ? nextChoice : 'dark';
    _resolvedTheme = _themeChoice;

    if (persist) {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, _themeChoice);
        } catch (_) {}
    }

    _applyToDocument({ animate });
    _emit();
}

export function initTheme() {
    let stored = null;
    try {
        if (typeof localStorage !== 'undefined') stored = localStorage.getItem(STORAGE_KEY);
    } catch (_) {
        stored = null;
    }

    setThemeChoice(stored || _themeChoice, { persist: false, animate: false });

    return () => {};
}
