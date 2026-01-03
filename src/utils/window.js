const { BrowserWindow, globalShortcut, ipcMain, screen, systemPreferences, app } = require('electron');
const path = require('node:path');

let mouseEventsIgnored = false;
let smartMouseEventsIgnored = true;
let windowResizing = false;
let resizeAnimation = null;
const RESIZE_ANIMATION_DURATION = 500; // milliseconds
const MIN_ASSISTANT_W = 730;
const MIN_ASSISTANT_H = 500;
const MAX_ASSISTANT_W = 730;
const MAX_ASSISTANT_H = 750;

// Runtime content protection state:
// - undetectableEnabledRuntime: driven by the user's Undetectable toggle
// - aiCaptureExclusionRuntime: driven by our internal AI capture session (screen/video stream)
// Effective contentProtection = undetectableEnabledRuntime || aiCaptureExclusionRuntime
let undetectableEnabledRuntime = false;
let aiCaptureExclusionRuntime = false;

function applyContentProtectionState(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const next =
        !!undetectableEnabledRuntime || (process.platform === 'win32' ? !!aiCaptureExclusionRuntime : false);
    try {
        mainWindow.setContentProtection(next);
    } catch (e) {
        console.error('Failed to apply content protection state:', e);
    }
}

function applyMouseEventsPolicy(mainWindow) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const shouldIgnore = !!mouseEventsIgnored || !!smartMouseEventsIgnored;
    try {
        if (shouldIgnore) {
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
        } else {
            mainWindow.setIgnoreMouseEvents(false);
        }
    } catch (_) {}
}

function createWindow(sendToRenderer) {
    // Compact mode is the ONLY supported layout mode.
    // Start directly in compact sizing (fresh installs should never see "normal").
    let windowWidth = 700;
    // Onboarding slides (textarea/features) need more vertical space.
    // Main view will immediately resize itself down via update-sizes.
    let windowHeight = 500;

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
            undetectableEnabledRuntime = !!contentProtection;
            applyContentProtectionState(mainWindow);
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

                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer);
                    // Show the window after content protection has been applied
                    try {
                        mainWindow.showInactive();
                    } catch (_) {}
                })
                .catch(() => {
                    // Default to content protection OFF (visible)
                    undetectableEnabledRuntime = false;
                    applyContentProtectionState(mainWindow);
                    updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer);
                    try {
                        mainWindow.showInactive();
                    } catch (_) {}
                });
    });

    // Re-apply the setting once content fully finishes loading to guard against timing issues
    mainWindow.webContents.once('did-finish-load', async () => {
        await applyUndetectableSetting();
    });

    setupWindowIpcHandlers(mainWindow, sendToRenderer);

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
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer) {

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
                applyMouseEventsPolicy(mainWindow);
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
                    // Debug visibility: confirm the OS-level shortcut fired (Cluely-style "instant submit" depends on this).
                    try { console.log('[AI][SUBMIT] Global shortcut triggered:', keybinds.nextStep); } catch (_) {}
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

    // Remove previous/next response shortcuts for chat-style conversation

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

function setupWindowIpcHandlers(mainWindow, sendToRenderer) {
    ipcMain.handle('get-permission-status', async () => {
        try {
            if (process.platform !== 'darwin') {
                return {
                    success: true,
                    platform: process.platform,
                    supported: false,
                    permissions: {},
                    allGranted: true,
                };
            }

            const safeGet = (kind) => {
                try {
                    const v = systemPreferences.getMediaAccessStatus(kind);
                    return typeof v === 'string' ? v : 'unknown';
                } catch (_) {
                    return 'unknown';
                }
            };

            const microphone = safeGet('microphone');
            const screenRecording = safeGet('screen');

            const allGranted = microphone === 'granted' && screenRecording === 'granted';

            return {
                success: true,
                platform: process.platform,
                supported: true,
                identity: {
                    name: app.getName(),
                    isPackaged: app.isPackaged,
                    appPath: app.getAppPath(),
                },
                permissions: {
                    microphone,
                    screenRecording,
                },
                allGranted,
            };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    ipcMain.handle('request-microphone-permission', async () => {
        try {
            if (process.platform !== 'darwin') {
                return { success: false, error: 'Unsupported platform' };
            }
            const granted = await systemPreferences.askForMediaAccess('microphone');
            return { success: true, granted: !!granted };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    // Internal AI capture exclusion:
    // We must exclude THIS window from the screen/video stream used for AI screenshots,
    // regardless of the user's Undetectable toggle, but without persisting it.
    // This is done by keeping contentProtection enabled for the entire capture session.
    ipcMain.handle('set-ai-capture-exclusion', async (_event, enabled) => {
        try {
            if (mainWindow.isDestroyed()) return { success: false, error: 'Window destroyed' };
            aiCaptureExclusionRuntime = !!enabled;
            applyContentProtectionState(mainWindow);
            return {
                success: true,
                enabled: aiCaptureExclusionRuntime,
                undetectable: undetectableEnabledRuntime,
                effective: !!undetectableEnabledRuntime || !!aiCaptureExclusionRuntime,
            };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    ipcMain.handle('capture-screen-behind-app', async (_event, { imageQuality = 'high' } = {}) => {
        try {
            if (process.platform !== 'darwin') {
                return { success: false, error: 'Unsupported platform' };
            }
            if (!mainWindow || mainWindow.isDestroyed()) {
                return { success: false, error: 'Window destroyed' };
            }

            const { spawnSync } = require('child_process');
            const fs = require('node:fs');

            // Fixed behavior: always High quality (ignore any passed value).
            const quality = 0.9;

            const bounds = mainWindow.getBounds();
            const display = screen.getDisplayMatching(bounds);
            const args = [
                '--ownerPid',
                String(process.pid),
                '--displayId',
                String(display?.id ?? ''),
                '--quality',
                String(quality),
            ];

            let helperPath;
            if (app.isPackaged) {
                helperPath = path.join(process.resourcesPath, 'ScreenBehindDump');
            } else {
                helperPath = path.join(__dirname, '../assets', 'ScreenBehindDump');
                const swiftSrc = path.join(__dirname, '../assets', 'ScreenBehindDump.swift');
                if (!fs.existsSync(helperPath) && fs.existsSync(swiftSrc)) {
                    try {
                        spawnSync(
                            'xcrun',
                            [
                                'swiftc',
                                '-parse-as-library',
                                swiftSrc,
                                '-O',
                                '-o',
                                helperPath,
                                '-framework',
                                'ScreenCaptureKit',
                                '-framework',
                                'CoreGraphics',
                                '-framework',
                                'ImageIO',
                                '-framework',
                                'UniformTypeIdentifiers',
                            ],
                            { stdio: 'ignore' }
                        );
                    } catch (_) {}
                }
            }

            try {
                fs.accessSync(helperPath, fs.constants.X_OK);
            } catch (_) {
                try {
                    fs.chmodSync(helperPath, 0o755);
                } catch (e) {
                    return { success: false, error: `ScreenBehindDump not executable (${e?.message || e})` };
                }
            }

            const out = spawnSync(helperPath, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
            if (out.error) {
                return { success: false, error: out.error?.message || String(out.error) };
            }
            const stdout = String(out.stdout || '').trim();
            if (!stdout) {
                const stderr = String(out.stderr || '').trim();
                return { success: false, error: stderr || 'No output from ScreenBehindDump' };
            }

            const lines = stdout.split('\n');
            const first = String(lines[0] || '').trim();
            const parts = first.split(/\s+/).filter(Boolean);
            const width = Math.max(0, parseInt(parts[0] || '0', 10) || 0);
            const height = Math.max(0, parseInt(parts[1] || '0', 10) || 0);
            const base64 = lines.slice(1).join('').trim();
            if (!base64 || base64.length < 100) {
                const stderr = String(out.stderr || '').trim();
                return { success: false, error: stderr || 'Invalid screenshot data' };
            }

            return { success: true, base64, mimeType: 'image/jpeg', width, height };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    ipcMain.on('view-changed', (event, view) => {
        if (mainWindow.isDestroyed()) return;
        // Enable full-window resizing when Assistant view is active
        if (view === 'assistant') {
            mainWindow.setResizable(false);
            try {
                mainWindow.setMinimumSize(MIN_ASSISTANT_W, MIN_ASSISTANT_H);
                mainWindow.setMaximumSize(MAX_ASSISTANT_W, MAX_ASSISTANT_H);
            } catch (_) {}
        } else {
            mainWindow.setResizable(false);
        }
        applyMouseEventsPolicy(mainWindow);
    });

    ipcMain.handle('set-smart-mouse-events-ignored', async (_event, ignored) => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }
            smartMouseEventsIgnored = !!ignored;
            applyMouseEventsPolicy(mainWindow);
            return { success: true, ignored: smartMouseEventsIgnored, forced: !!mouseEventsIgnored };
        } catch (e) {
            return { success: false, error: e?.message || String(e) };
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer);
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
            undetectableEnabledRuntime = on;
            applyContentProtectionState(mainWindow);
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

    // New: expose display metrics so renderer can accurately redact the app window from AI screenshots
    ipcMain.handle('get-primary-display-metrics', () => {
        try {
            const d = screen.getPrimaryDisplay();
            return {
                bounds: d.bounds,
                workArea: d.workArea,
                scaleFactor: d.scaleFactor,
                size: d.size,
                workAreaSize: d.workAreaSize,
            };
        } catch (e) {
            return { bounds: null, workArea: null, scaleFactor: 1, size: null, workAreaSize: null };
        }
    });

    // New: expose the display that currently contains the app window (more accurate than primary).
    ipcMain.handle('get-window-display-metrics', () => {
        try {
            if (mainWindow.isDestroyed()) return { bounds: null, workArea: null, scaleFactor: 1, size: null, workAreaSize: null };
            const b = mainWindow.getBounds();
            const d = screen.getDisplayMatching(b);
            return {
                bounds: d.bounds,
                workArea: d.workArea,
                scaleFactor: d.scaleFactor,
                size: d.size,
                workAreaSize: d.workAreaSize,
            };
        } catch (e) {
            return { bounds: null, workArea: null, scaleFactor: 1, size: null, workAreaSize: null };
        }
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

    function animateWindowResize(mainWindow, targetWidth, targetHeight, label, keepResizable) {
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

            // Get current view from renderer (layout mode removed; compact-only app)
            let viewName;
            let isPromptLibraryOpen = false;
            try {
                viewName = await event.sender.executeJavaScript(
                    'window.cheddar && window.cheddar.getCurrentView ? window.cheddar.getCurrentView() : "main"'
                );
                // Check if the Prompt Library modal is open (boolean or function)
                isPromptLibraryOpen = await event.sender.executeJavaScript(
                    '(() => { try { const c = window.cheddar; const v = c && c.isPromptLibraryOpen; return typeof v === "function" ? !!v() : !!v; } catch(e) { return false; } })()'
                );
            } catch (error) {
                console.warn('Failed to get view/layout from renderer, using defaults:', error);
                viewName = 'main';
                isPromptLibraryOpen = false;
            }

            let measuredMainHeader = null;
            if (viewName === 'main') {
                try {
                    measuredMainHeader = await event.sender.executeJavaScript(`(() => {
                        try {
                            const app = document.querySelector('ghostprep-app');
                            const appRoot = app && app.shadowRoot;
                            const headerEl = appRoot && appRoot.querySelector('app-header');
                            const headerRoot = headerEl && headerEl.shadowRoot;
                            const header = headerRoot && headerRoot.querySelector('.header');
                            const center = headerRoot && headerRoot.querySelector('.center-actions');
                            const floatingClose = headerRoot && headerRoot.querySelector('.floating-close');

                            const rects = [header, center, floatingClose]
                                .filter(Boolean)
                                .map(el => {
                                    try { return el.getBoundingClientRect(); } catch (_) { return null; }
                                })
                                .filter(Boolean);
                            if (!rects.length) return null;

                            let left = Infinity;
                            let top = Infinity;
                            let right = -Infinity;
                            let bottom = -Infinity;
                            for (const r of rects) {
                                left = Math.min(left, r.left);
                                top = Math.min(top, r.top);
                                right = Math.max(right, r.right);
                                bottom = Math.max(bottom, r.bottom);
                            }

                            const width = Math.ceil(Math.max(0, right - left));
                            const height = Math.ceil(Math.max(0, bottom - top));
                            if (!width || !height) return null;
                            return { width, height };
                        } catch (e) {
                            return null;
                        }
                    })()`);
                } catch (_) {
                    measuredMainHeader = null;
                }
            }


            let targetWidth, targetHeight;

            // Compact-only base size
            const baseWidth = 700;
            const baseHeight = 300;

            // Adjust height based on view
            switch (viewName) {
                case 'customize':
                case 'settings':
                    targetWidth = baseWidth;
                    targetHeight = 500;
                    break;
                case 'onboarding':
                    // Compact-only onboarding still needs a taller window for proper layout.
                    targetWidth = baseWidth;
                    targetHeight = 500;
                    break;
                case 'help':
                    targetWidth = baseWidth;
                    targetHeight = 450;
                    break;
                case 'history':
                    targetWidth = baseWidth;
                    targetHeight = 450;
                    break;
                case 'advanced':
                    targetWidth = baseWidth;
                    targetHeight = 400;
                    break;
                case 'assistant':
                    // Always open Assistant in expanded default size, regardless of compact setting
                    targetWidth = 635;
                    targetHeight = 500;
                    break;
                case 'main':
                default:
                    if (measuredMainHeader && measuredMainHeader.width && measuredMainHeader.height) {
                        targetWidth = baseWidth;
                        targetHeight = Math.max(44, measuredMainHeader.height + 2);
                    } else {
                        targetWidth = baseWidth;
                        targetHeight = baseHeight;
                    }
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
                `${viewName} view`,
                viewName === 'assistant' ? false : !!isPromptLibraryOpen
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
