const { BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('node:path');

let mouseEventsIgnored = false;
let windowResizing = false;
let resizeAnimation = null;
const RESIZE_ANIMATION_DURATION = 500; // milliseconds
const MIN_ASSISTANT_W = 450;
const MIN_ASSISTANT_H = 330;
const MAX_ASSISTANT_W = 800;
const MAX_ASSISTANT_H = 550;

function createWindow(sendToRenderer, geminiSessionRef) {
    // Get layout preference (default to 'normal')
    let windowWidth = 1100;
    let windowHeight = 600;

    const mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        frame: false,
        transparent: true,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // TODO: change to true
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        backgroundColor: '#00000000',
    });

    const { session, desktopCapturer } = require('electron');
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                callback({ video: sources[0], audio: 'loopback' });
            });
        },
        { useSystemPicker: true }
    );

    mainWindow.setResizable(false);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Center window at the top of the screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = 0;
    mainWindow.setPosition(x, y);

    if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // Helper to read undetectable setting directly from localStorage inside the renderer
    async function readUndetectableFromStorage() {
        try {
            const value = await mainWindow.webContents.executeJavaScript(`(() => {
                try {
                    const v = localStorage.getItem('undetectableEnabled');
                    if (v !== null) return v === 'true';
                    const legacyCP = localStorage.getItem('contentProtection');
                    if (legacyCP !== null) return legacyCP === 'true';
                    const legacyT = localStorage.getItem('undetectableTEnabled');
                    if (legacyT !== null) return legacyT === 'true';
                    return false;
                } catch(e) { return false; }
            })()`);
            return !!value;
        } catch (e) {
            console.warn('Failed to read undetectable setting from storage:', e);
            return false;
        }
    }

    async function applyUndetectableSetting() {
        if (mainWindow.isDestroyed()) return;
        const contentProtection = await readUndetectableFromStorage();
        try {
            mainWindow.setContentProtection(!!contentProtection);
        } catch (e) {
            console.error('Failed to apply content protection:', e);
        }
    }

    // After window is created, check for layout preference and apply content protection before showing
    mainWindow.webContents.once('dom-ready', () => {
        const defaultKeybinds = getDefaultKeybinds();
        let keybinds = defaultKeybinds;

            mainWindow.webContents
                .executeJavaScript(
                    `
                try {
                    const savedKeybinds = localStorage.getItem('customKeybinds');
                    
                    return {
                        keybinds: savedKeybinds ? JSON.parse(savedKeybinds) : null
                    };
                } catch (e) {
                    return { keybinds: null };
                }
            `
                )
                .then(async savedSettings => {
                    if (savedSettings.keybinds) {
                        keybinds = { ...defaultKeybinds, ...savedSettings.keybinds };
                    }

                    await applyUndetectableSetting();

                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
                    // Show the window after content protection has been applied
                    try {
                        mainWindow.showInactive();
                    } catch (_) {}
                })
                .catch(() => {
                    // Default to content protection OFF (visible)
                    mainWindow.setContentProtection(false);
                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
                    try {
                        mainWindow.showInactive();
                    } catch (_) {}
                });
    });

    // Re-apply the setting once content fully finishes loading to guard against timing issues
    mainWindow.webContents.once('did-finish-load', async () => {
        await applyUndetectableSetting();
    });

    setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef);

    return mainWindow;
}

function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
        moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
        moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
        moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        sendTranscription: isMac ? 'Cmd+Shift+Enter' : 'Ctrl+Shift+Enter',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef) {

    // Unregister all existing shortcuts
    globalShortcut.unregisterAll();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const moveIncrement = Math.floor(Math.min(width, height) * 0.1);

    // Register window movement shortcuts
    const movementActions = {
        moveUp: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX, currentY - moveIncrement);
        },
        moveDown: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX, currentY + moveIncrement);
        },
        moveLeft: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX - moveIncrement, currentY);
        },
        moveRight: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX + moveIncrement, currentY);
        },
    };

    // Register each movement shortcut
    Object.keys(movementActions).forEach(action => {
        const keybind = keybinds[action];
        if (keybind) {
            try {
                globalShortcut.register(keybind, movementActions[action]);
            } catch (error) {
                console.error(`Failed to register ${action} (${keybind}):`, error);
            }
        }
    });

    // Register toggle visibility shortcut
    if (keybinds.toggleVisibility) {
        try {
            globalShortcut.register(keybinds.toggleVisibility, () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.showInactive();
                }
            });
        } catch (error) {
            console.error(`Failed to register toggleVisibility (${keybinds.toggleVisibility}):`, error);
        }
    }

    // Register toggle click-through shortcut
    if (keybinds.toggleClickThrough) {
        try {
            globalShortcut.register(keybinds.toggleClickThrough, () => {
                mouseEventsIgnored = !mouseEventsIgnored;
                if (mouseEventsIgnored) {
                    mainWindow.setIgnoreMouseEvents(true, { forward: true });
                } else {
                    mainWindow.setIgnoreMouseEvents(false);
                }
                mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
            });
            // Registered toggleClickThrough
        } catch (error) {
            console.error(`Failed to register toggleClickThrough (${keybinds.toggleClickThrough}):`, error);
        }
    }

    // Register next step shortcut (either starts session or takes screenshot based on view)
    if (keybinds.nextStep) {
        try {
            globalShortcut.register(keybinds.nextStep, async () => {
                try {
                    // Determine the shortcut key format
                    const isMac = process.platform === 'darwin';
                    const shortcutKey = isMac ? 'cmd+enter' : 'ctrl+enter';

                    // Ensure behavior respects hidden state: don't unhide on nextStep
                    if (!mainWindow.isVisible()) {
                        return;
                    }

                    // If minimized but visible, restore, then focus
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }

                    // Focus both the window and its webContents for reliability
                    mainWindow.focus();
                    try { mainWindow.webContents.focus(); } catch (_) {}

                    // Execute shortcut handling in renderer after focusing the window
                    setTimeout(() => {
                        try {
                            mainWindow.webContents.executeJavaScript(`
                                if (window.cheddar && window.cheddar.handleShortcut) {
                                    window.cheddar.handleShortcut('${shortcutKey}');
                                } else {
                                    /* no-op */
                                }
                            `);
                        } catch (e) {
                            console.error('Error executing handleShortcut after focus:', e);
                        }
                    }, 0);
                } catch (error) {
                    console.error('Error handling next step shortcut:', error);
                }
            });
            // Registered nextStep
        } catch (error) {
            console.error(`Failed to register nextStep (${keybinds.nextStep}):`, error);
        }
    }

    // Register send transcription shortcut
    if (keybinds.sendTranscription) {
        try {
            globalShortcut.register(keybinds.sendTranscription, async () => {
                try {
                    const isMac = process.platform === 'darwin';
                    const shortcutKey = isMac ? 'cmd+shift+enter' : 'ctrl+shift+enter';

                    mainWindow.webContents.executeJavaScript(`
                        if (window.cheddar && window.cheddar.handleShortcut) {
                            window.cheddar.handleShortcut('${shortcutKey}');
                        } else {
                            /* no-op */
                        }
                    `);
                } catch (error) {
                    console.error('Error handling send transcription shortcut:', error);
                }
            });
            // Registered sendTranscription
        } catch (error) {
            console.error(`Failed to register sendTranscription (${keybinds.sendTranscription}):`, error);
        }
    }

    // Register previous response shortcut
    if (keybinds.previousResponse) {
        try {
            globalShortcut.register(keybinds.previousResponse, () => {
                sendToRenderer('navigate-previous-response');
            });
            // Registered previousResponse
        } catch (error) {
            console.error(`Failed to register previousResponse (${keybinds.previousResponse}):`, error);
        }
    }

    // Register next response shortcut
    if (keybinds.nextResponse) {
        try {
            globalShortcut.register(keybinds.nextResponse, () => {
                sendToRenderer('navigate-next-response');
            });
            // Registered nextResponse
        } catch (error) {
            console.error(`Failed to register nextResponse (${keybinds.nextResponse}):`, error);
        }
    }

    // Register scroll up shortcut
    if (keybinds.scrollUp) {
        try {
            globalShortcut.register(keybinds.scrollUp, () => {
                sendToRenderer('scroll-response-up');
            });
            // Registered scrollUp
        } catch (error) {
            console.error(`Failed to register scrollUp (${keybinds.scrollUp}):`, error);
        }
    }

    // Register scroll down shortcut
    if (keybinds.scrollDown) {
        try {
            globalShortcut.register(keybinds.scrollDown, () => {
                sendToRenderer('scroll-response-down');
            });
            // Registered scrollDown
        } catch (error) {
            console.error(`Failed to register scrollDown (${keybinds.scrollDown}):`, error);
        }
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef) {
    ipcMain.on('view-changed', (event, view) => {
        if (mainWindow.isDestroyed()) return;
        // Enable full-window resizing when Assistant view is active
        if (view === 'assistant') {
            mainWindow.setResizable(true);
            try {
                mainWindow.setMinimumSize(MIN_ASSISTANT_W, MIN_ASSISTANT_H);
                mainWindow.setMaximumSize(MAX_ASSISTANT_W, MAX_ASSISTANT_H);
            } catch (_) {}
        } else {
            mainWindow.setResizable(false);
        }
        if (view !== 'assistant') {
            mainWindow.setIgnoreMouseEvents(false);
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    ipcMain.handle('toggle-window-visibility', async event => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }

            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.showInactive();
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling window visibility:', error);
            return { success: false, error: error.message };
        }
    });

    // Undetectable mode: toggle content protection to hide from screen share
    ipcMain.handle('set-undetectable-mode', (event, enabled) => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }
            const on = !!enabled;
            mainWindow.setContentProtection(on);
            return { success: true };
        } catch (error) {
            console.error('Error setting undetectable mode:', error);
            return { success: false, error: error.message };
        }
    });

    // New: IPC helpers for resizing from the renderer
    ipcMain.handle('get-window-size', () => {
        if (mainWindow.isDestroyed()) return { width: 0, height: 0 };
        const [width, height] = mainWindow.getSize();
        return { width, height };
    });

    ipcMain.handle('get-max-window-size', () => {
        const { workAreaSize } = screen.getPrimaryDisplay();
        return { width: workAreaSize.width, height: workAreaSize.height };
    });

    // New: full bounds getter and setter for left/top edge drags
    ipcMain.handle('get-window-bounds', () => {
        if (mainWindow.isDestroyed()) return { x: 0, y: 0, width: 0, height: 0 };
        const [width, height] = mainWindow.getSize();
        const [x, y] = mainWindow.getPosition();
        return { x, y, width, height };
    });

    ipcMain.handle('set-window-bounds', (event, bounds) => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }
            const { workArea } = screen.getPrimaryDisplay();
            let x = Math.floor(Number(bounds.x));
            let y = Math.floor(Number(bounds.y));
            let width = Math.floor(Number(bounds.width));
            let height = Math.floor(Number(bounds.height));

            const minW = MIN_ASSISTANT_W;
            const minH = MIN_ASSISTANT_H;
            const maxW = Math.min(workArea.width, MAX_ASSISTANT_W);
            const maxH = Math.min(workArea.height, MAX_ASSISTANT_H);

            width = Math.max(minW, Math.min(maxW, width));
            height = Math.max(minH, Math.min(maxH, height));

            x = Math.max(workArea.x, Math.min(workArea.x + workArea.width - width, x));
            y = Math.max(workArea.y, Math.min(workArea.y + workArea.height - height, y));

            mainWindow.setBounds({ x, y, width, height });
            return { success: true, x, y, width, height };
        } catch (error) {
            console.error('Error setting window bounds:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('resize-window-to', (event, { width, height }) => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }
            const { workAreaSize } = screen.getPrimaryDisplay();
            const clampedWidth = Math.max(MIN_ASSISTANT_W, Math.min(Math.min(workAreaSize.width, MAX_ASSISTANT_W), Math.floor(Number(width)) || 0));
            const clampedHeight = Math.max(MIN_ASSISTANT_H, Math.min(Math.min(workAreaSize.height, MAX_ASSISTANT_H), Math.floor(Number(height)) || 0));
            mainWindow.setSize(clampedWidth, clampedHeight);
            return { success: true, width: clampedWidth, height: clampedHeight };
        } catch (error) {
            console.error('Error resizing window:', error);
            return { success: false, error: error.message };
        }
    });

    function animateWindowResize(mainWindow, targetWidth, targetHeight, layoutMode, keepResizable) {
        return new Promise(resolve => {
            // Check if window is destroyed before starting animation
            if (mainWindow.isDestroyed()) {
                console.warn('Cannot animate resize: window has been destroyed');
                resolve();
                return;
            }

            // Clear any existing animation
            if (resizeAnimation) {
                clearInterval(resizeAnimation);
                resizeAnimation = null;
            }

            const [startWidth, startHeight] = mainWindow.getSize();

            // If already at target size, no need to animate
            if (startWidth === targetWidth && startHeight === targetHeight) {
                resolve();
                return;
            }

            
            windowResizing = true;
            mainWindow.setResizable(true);

            const frameRate = 60; // 60 FPS
            const totalFrames = Math.floor(RESIZE_ANIMATION_DURATION / (1000 / frameRate));
            let currentFrame = 0;

            const widthDiff = targetWidth - startWidth;
            const heightDiff = targetHeight - startHeight;

            resizeAnimation = setInterval(() => {
                currentFrame++;
                const progress = currentFrame / totalFrames;

                // Use easing function (ease-out)
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                const currentWidth = Math.round(startWidth + widthDiff * easedProgress);
                const currentHeight = Math.round(startHeight + heightDiff * easedProgress);

                if (!mainWindow || mainWindow.isDestroyed()) {
                    clearInterval(resizeAnimation);
                    resizeAnimation = null;
                    windowResizing = false;
                    return;
                }
                mainWindow.setSize(currentWidth, currentHeight);

                // Re-center the window during animation
                const primaryDisplay = screen.getPrimaryDisplay();
                const { width: screenWidth } = primaryDisplay.workAreaSize;
                const x = Math.floor((screenWidth - currentWidth) / 2);
                const y = 0;
                mainWindow.setPosition(x, y);

                if (currentFrame >= totalFrames) {
                    clearInterval(resizeAnimation);
                    resizeAnimation = null;
                    windowResizing = false;

                    // Check if window is still valid before final operations
                    if (!mainWindow.isDestroyed()) {
                        // Keep window resizable only when Assistant view is active
                        mainWindow.setResizable(!!keepResizable);

                        // Ensure final size is exact
                        mainWindow.setSize(targetWidth, targetHeight);
                        const finalX = Math.floor((screenWidth - targetWidth) / 2);
                        mainWindow.setPosition(finalX, 0);
                    }

                    resolve();
                }
            }, 1000 / frameRate);
        });
    }

    ipcMain.handle('update-sizes', async event => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }

            // Get current view and layout mode from renderer
            let viewName, layoutMode;
            let isPromptLibraryOpen = false;
            try {
                viewName = await event.sender.executeJavaScript(
                    'window.cheddar && window.cheddar.getCurrentView ? window.cheddar.getCurrentView() : "main"'
                );
                layoutMode =
                    (await event.sender.executeJavaScript(
                        'window.cheddar && window.cheddar.getLayoutMode ? window.cheddar.getLayoutMode() : "normal"'
                    )) || 'normal';
                // Check if the Prompt Library modal is open (boolean or function)
                isPromptLibraryOpen = await event.sender.executeJavaScript(
                    '(() => { try { const c = window.cheddar; const v = c && c.isPromptLibraryOpen; return typeof v === "function" ? !!v() : !!v; } catch(e) { return false; } })()'
                );
            } catch (error) {
                console.warn('Failed to get view/layout from renderer, using defaults:', error);
                viewName = 'main';
                layoutMode = 'normal';
                isPromptLibraryOpen = false;
            }


            let targetWidth, targetHeight;

            // Determine base size from layout mode
            const baseWidth = layoutMode === 'compact' ? 700 : 900;
            const baseHeight = layoutMode === 'compact' ? 300 : 400;

            // Adjust height based on view
            switch (viewName) {
                case 'customize':
                case 'settings':
                    targetWidth = baseWidth;
                    targetHeight = layoutMode === 'compact' ? 500 : 600;
                    break;
                case 'help':
                    targetWidth = baseWidth;
                    targetHeight = layoutMode === 'compact' ? 450 : 550;
                    break;
                case 'history':
                    targetWidth = baseWidth;
                    targetHeight = layoutMode === 'compact' ? 450 : 550;
                    break;
                case 'advanced':
                    targetWidth = baseWidth;
                    targetHeight = layoutMode === 'compact' ? 400 : 500;
                    break;
                case 'assistant':
                    // Always open Assistant in expanded default size, regardless of compact setting
                    targetWidth = 650;
                    targetHeight = 450;
                    break;
                case 'main':
                case 'onboarding':
                default:
                    targetWidth = baseWidth;
                    targetHeight = baseHeight;
                    break;
            }

            const [currentWidth, currentHeight] = mainWindow.getSize();

            // If currently resizing, the animation will start from current position
            if (windowResizing) {
            }

            await animateWindowResize(
                mainWindow,
                targetWidth,
                targetHeight,
                `${viewName} view (${layoutMode})`,
                viewName === 'assistant' || !!isPromptLibraryOpen
            );

            return { success: true };
        } catch (error) {
            console.error('Error updating sizes:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    createWindow,
    getDefaultKeybinds,
    updateGlobalShortcuts,
    setupWindowIpcHandlers,
};
