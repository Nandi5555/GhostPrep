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
    },
    packagerConfig: {
        asar: true,
        extraResource: ['./src/assets/SystemAudioDump', './src/assets/ScreenBehindDump'],
        name: 'Firefox',
        icon: 'src/assets/logo',
        // use `security find-identity -v -p codesigning` to find your identity
        // for macos signing
        // also fuck apple
        // osxSign: {
        //    identity: '<paste your identity here>',
        //   optionsForFile: (filePath) => {
        //       return {
        //           entitlements: 'entitlements.plist',
        //       };
        //   },
        // },
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
                name: 'firefox',
                productName: 'Firefox',
                shortcutName: 'Firefox',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
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
