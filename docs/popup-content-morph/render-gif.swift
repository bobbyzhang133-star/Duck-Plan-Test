import Foundation
import ImageIO
import UniformTypeIdentifiers
let folder = URL(fileURLWithPath: CommandLine.arguments[1])
let paths = (0...20).map { folder.appendingPathComponent(String(format: "frame-%02d.png", $0)) }
let output = folder.appendingPathComponent("opening.gif")
let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, paths.count, nil)!
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for (index, path) in paths.enumerated() {
  let source = CGImageSourceCreateWithURL(path as CFURL, nil)!
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
  let delay = index == 0 ? 0.4 : index == paths.count - 1 ? 0.9 : 0.016
  CGImageDestinationAddImage(destination, image, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFUnclampedDelayTime: delay, kCGImagePropertyGIFDelayTime: delay]] as CFDictionary)
}
if !CGImageDestinationFinalize(destination) { fatalError("Could not export GIF") }
print(output.path)
