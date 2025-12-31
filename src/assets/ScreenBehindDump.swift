import Foundation
import ScreenCaptureKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func readArg(_ name: String, _ args: [String]) -> String? {
    guard let idx = args.firstIndex(of: name), idx + 1 < args.count else { return nil }
    return args[idx + 1]
}

func fail(_ message: String, _ code: Int32) -> Never {
    fputs(message + "\n", stderr)
    exit(code)
}

func pickDisplay(_ displays: [SCDisplay], preferredId: CGDirectDisplayID?) -> SCDisplay? {
    if let preferredId {
        if let match = displays.first(where: { $0.displayID == preferredId }) {
            return match
        }
    }
    return displays.first
}

@main
struct ScreenBehindDump {
    static func main() async {
        let args = CommandLine.arguments

        guard
            let pidStr = readArg("--ownerPid", args),
            let ownerPid = Int32(pidStr)
        else {
            fail("Missing required args", 2)
        }

        let qStr = readArg("--quality", args) ?? "0.7"
        let quality = max(0.0, min(1.0, Double(qStr) ?? 0.7))

        let displayIdStr = readArg("--displayId", args)
        let displayId = (displayIdStr.flatMap { UInt32($0) }).map { CGDirectDisplayID($0) }

        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = pickDisplay(content.displays, preferredId: displayId) else {
                fail("No displays available", 3)
            }

            let windowsToExclude = content.windows.filter { w in
                guard let app = w.owningApplication else { return false }
                return app.processID == ownerPid
            }

            let bounds = CGDisplayBounds(display.displayID)
            let fullRect = CGRect(x: 0, y: 0, width: bounds.width, height: bounds.height)

            let filter = SCContentFilter(display: display, excludingWindows: windowsToExclude)
            let cfg = SCStreamConfiguration()
            cfg.capturesAudio = false
            cfg.showsCursor = false
            cfg.sourceRect = fullRect
            cfg.width = Int(bounds.width.rounded(.up))
            cfg.height = Int(bounds.height.rounded(.up))

            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: cfg)

            let outData = NSMutableData()
            guard let dest = CGImageDestinationCreateWithData(
                outData as CFMutableData,
                UTType.jpeg.identifier as CFString,
                1,
                nil
            ) else {
                fail("Failed to create image destination", 6)
            }

            let props: CFDictionary = [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
            CGImageDestinationAddImage(dest, image, props)
            guard CGImageDestinationFinalize(dest) else {
                fail("Failed to finalize image", 7)
            }

            let bytes = outData as Data
            let base64 = bytes.base64EncodedString()
            print("\(image.width) \(image.height)")
            print(base64)
        } catch {
            fail("Capture failed: \(error.localizedDescription)", 10)
        }
    }
}
