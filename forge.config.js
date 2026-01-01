process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
    hooks: {
        // Ensure macOS helper binaries ship with executable permissions.
        // (Do this at build/package time to avoid mutating signed app bundles at runtime.)
        prePackage: async () => {
            try {
                const assetsDir = path.join(__dirname, 'src/assets');
                const sourceLogo = path.join(assetsDir, 'cueFlowLogo.png');
                const legacyPng = path.join(assetsDir, 'logo.png');
                if (fs.existsSync(sourceLogo)) {
                    try {
                        const src = fs.readFileSync(sourceLogo);
                        const dst = fs.existsSync(legacyPng) ? fs.readFileSync(legacyPng) : null;
                        if (!dst || !dst.equals(src)) fs.writeFileSync(legacyPng, src);
                    } catch (_) {}
                }

                if (process.platform === 'darwin' && fs.existsSync(sourceLogo)) {
                    try {
                        const iconsetDir = path.join(assetsDir, 'logo.iconset');
                        fs.rmSync(iconsetDir, { recursive: true, force: true });
                        fs.mkdirSync(iconsetDir, { recursive: true });

                        const sizes = [
                            16, 32, 64, 128, 256, 512,
                        ];
                        for (const size of sizes) {
                            const out1x = path.join(iconsetDir, `icon_${size}x${size}.png`);
                            const out2x = path.join(iconsetDir, `icon_${size}x${size}@2x.png`);
                            try {
                                spawnSync('sips', ['-z', String(size), String(size), sourceLogo, '--out', out1x], {
                                    stdio: 'ignore',
                                });
                            } catch (_) {}
                            try {
                                spawnSync('sips', ['-z', String(size * 2), String(size * 2), sourceLogo, '--out', out2x], {
                                    stdio: 'ignore',
                                });
                            } catch (_) {}
                        }

                        const icnsOut = path.join(assetsDir, 'logo.icns');
                        try {
                            fs.rmSync(icnsOut, { force: true });
                        } catch (_) {}
                        try {
                            spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsOut], { stdio: 'ignore' });
                        } catch (_) {}

                        try {
                            fs.rmSync(iconsetDir, { recursive: true, force: true });
                        } catch (_) {}
                    } catch (_) {}
                }
            } catch (_) {}

            try {
                const p = path.join(__dirname, 'src/assets/SystemAudioDump');
                fs.chmodSync(p, 0o755);
            } catch (_) {}
            try {
                const helper = path.join(__dirname, 'src/assets/ScreenBehindDump');
                const swiftSrc = path.join(__dirname, 'src/assets/ScreenBehindDump.swift');
                if (!fs.existsSync(helper) && fs.existsSync(swiftSrc)) {
                    try {
                        spawnSync(
                            'xcrun',
                            [
                                'swiftc',
                                '-parse-as-library',
                                swiftSrc,
                                '-O',
                                '-o',
                                helper,
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
                fs.chmodSync(helper, 0o755);
            } catch (_) {}
        },
        postPackage: async (_forgeConfig, options) => {
            try {
                if (!options || options.platform !== 'darwin') return;
                if (!Array.isArray(options.outputPaths)) return;

                const entitlementsPath = path.join(__dirname, 'entitlements.plist');
                const identity = process.env.MACOS_CODESIGN_IDENTITY || process.env.APPLE_CODESIGN_IDENTITY || '-';

                for (const outPath of options.outputPaths) {
                    try {
                        const entries = fs.readdirSync(outPath);
                        const appDirName = entries.find(e => e.endsWith('.app'));
                        if (!appDirName) continue;

                        const appPath = path.join(outPath, appDirName);
                        const args = ['--force', '--deep', '--sign', identity];
                        if (fs.existsSync(entitlementsPath)) {
                            args.push('--entitlements', entitlementsPath);
                        }
                        args.push(appPath);
                        spawnSync('codesign', args, { stdio: 'ignore' });
                    } catch (_) {}
                }
            } catch (_) {}
        },
    },
    packagerConfig: {
        asar: true,
        extraResource: ['./src/assets/SystemAudioDump', './src/assets/ScreenBehindDump'],
        name: 'CueFlow',
        icon: 'src/assets/logo',
        appBundleId: 'com.ghostprep.ghostprep',
        extendInfo: {
            NSMicrophoneUsageDescription: 'CueFlow needs microphone access to capture interview audio for transcription.',
            NSScreenCaptureUsageDescription: 'CueFlow needs screen recording access to capture your screen for interview context.',
        },
        osxSign: process.env.MACOS_CODESIGN_IDENTITY
            ? {
                  identity: process.env.MACOS_CODESIGN_IDENTITY,
                  optionsForFile: () => ({ entitlements: 'entitlements.plist' }),
              }
            : undefined,
        // notarize if off cuz i ran this for 6 hours and it still didnt finish
        // osxNotarize: {
        //    appleId: 'your apple id',
        //    appleIdPassword: 'app specific password',
        //    teamId: 'your team id',
        // },
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'cueflow',
                productName: 'CueFlow',
                shortcutName: 'CueFlow',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
            config: {
                name: 'CueFlow',
                icon: 'src/assets/logo.icns',
            },
        },
        {
            name: '@electron-forge/maker-deb',
            config: {},
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {},
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
