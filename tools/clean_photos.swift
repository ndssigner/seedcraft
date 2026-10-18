// Usage: swift tools/clean_photos.swift IN OUT [IN OUT ...]
// Writes each IN as a 1600 px (long side) JPEG, quality 0.8, orientation applied
// to the pixels, and NO metadata (no properties are copied from the source).
import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers

// ImageIO still adds a small Exif block (pixel size, colour space) and an empty
// Photoshop block. Drop every marker segment before the image data except
// JFIF (APP0) and the ICC colour profile (APP2), so only the pixels remain.
func strip(_ d: Data) -> Data? {
    let b = [UInt8](d)
    guard b.count > 4, b[0] == 0xFF, b[1] == 0xD8 else { return nil }
    var out: [UInt8] = [0xFF, 0xD8]
    var i = 2
    while i + 4 <= b.count {
        guard b[i] == 0xFF else { return nil }
        let m = b[i + 1]
        if m == 0xDA { out += b[i...]; return Data(out) }   // start of scan: copy the rest
        let len = Int(b[i + 2]) << 8 | Int(b[i + 3])
        guard i + 2 + len <= b.count else { return nil }
        let drop = (m >= 0xE1 && m <= 0xEF && m != 0xE2) || m == 0xFE
        if !drop { out += b[i ..< i + 2 + len] }
        i += 2 + len
    }
    return nil
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2, args.count % 2 == 0 else {
    FileHandle.standardError.write("usage: clean_photos.swift IN OUT [IN OUT ...]\n".data(using: .utf8)!)
    exit(2)
}
for i in stride(from: 0, to: args.count, by: 2) {
    let inURL = URL(fileURLWithPath: args[i]), outURL = URL(fileURLWithPath: args[i + 1])
    guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil) else { print("cannot read \(args[i])"); exit(1) }
    let opts: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: 1600,
    ]
    guard let img = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { print("cannot decode \(args[i])"); exit(1) }
    guard let dst = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { print("cannot write \(args[i + 1])"); exit(1) }
    CGImageDestinationAddImage(dst, img, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
    guard CGImageDestinationFinalize(dst) else { print("finalize failed \(args[i + 1])"); exit(1) }
    guard let raw = try? Data(contentsOf: outURL), let clean = strip(raw), (try? clean.write(to: outURL)) != nil else { print("strip failed \(args[i + 1])"); exit(1) }
    print("\(outURL.lastPathComponent): \(img.width)x\(img.height)")
}
