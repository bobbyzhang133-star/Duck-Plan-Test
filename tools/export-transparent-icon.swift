import AppKit
import Foundation
import CryptoKit
import Darwin

// Background-only derivative of the approved opaque master. No silhouette,
// facial geometry, colors or placement are regenerated or reconstructed.
func require(_ condition: Bool, _ message: String) {
  if !condition {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
  }
}
func sha256(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
let root = CommandLine.arguments.dropFirst().first ?? FileManager.default.currentDirectoryPath
let assets = root + "/landing/assets/"
let proof = root + "/docs/sigma-mascot/transparent-v11/"
let sourcePath = assets + "duckplan-sigma-head-v11.png"
let sourceData = try Data(contentsOf: URL(fileURLWithPath: sourcePath))
require(sha256(sourceData) == "7714bd8afc68d05399841291712d57cfcb62ad729eec3cd58e570670156501f5", "The source is not the approved v11 master")
guard let source = NSBitmapImageRep(data: sourceData) else { fatalError("Cannot decode approved master") }
let w = source.pixelsWide, h = source.pixelsHigh, count = w * h
require(w == 1024 && h == 1024 && source.bitsPerSample == 8 && source.samplesPerPixel == 3 && !source.hasAlpha,
  "Expected the approved opaque 1024px RGB master")
require(source.bitmapFormat.rawValue == 0, "Unexpected source channel order")
var rgb = [UInt8](repeating: 0, count: count * 3)
let sourceStride = source.bitsPerPixel / 8
for y in 0..<h { for x in 0..<w { for c in 0..<3 {
  rgb[(y * w + x) * 3 + c] = source.bitmapData![y * source.bytesPerRow + x * sourceStride + c]
} } }
func pixel(_ i: Int) -> [UInt8] { Array(rgb[(i * 3)..<(i * 3 + 3)]) }

// Very dark original stroke cores form a closed barrier except where the neck
// intentionally continues through the bottom crop. Never seed that bottom edge.
let barrierLimit: UInt8 = 60
let barrier = (0..<count).map { pixel($0).max()! <= barrierLimit }
var exterior = [Bool](repeating: false, count: count), queue = [Int](), cursor = 0
func seed(_ i: Int) {
  if !barrier[i] && !exterior[i] { exterior[i] = true; queue.append(i) }
}
for x in 0..<w { seed(x) }
for y in 0..<h { seed(y * w); seed(y * w + w - 1) }
while cursor < queue.count {
  let i = queue[cursor]; cursor += 1
  let x = i % w, y = i / w
  if x > 0 { seed(i - 1) }; if x + 1 < w { seed(i + 1) }
  if y > 0 { seed(i - w) }; if y + 1 < h { seed(i + w) }
}
let bodyProbes = [(512, 200), (512, 950), (512, 1023), (360, 350), (512, 600)]
require(bodyProbes.allSatisfy { !exterior[$0.1 * w + $0.0] }, "Exterior reached the protected duck interior")
for y in 220..<960 { for x in 280..<740 {
  require(!exterior[y * w + x], "Exterior reached the protected facial/body rectangle")
} }

// The original photographed/raster outline has a small white-matted soft edge.
// Only exterior-connected pixels immediately outside its existing dark core are
// eligible for alpha/unmatting. Everything enclosed stays byte-identical/opaque.
let radius = 12
var distance = [Int](repeating: radius + 1, count: count), ring = [Int]()
for i in barrier.indices where barrier[i] {
  let x = i % w, y = i / w
  for j in [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, y > 0 ? i - w : -1, y + 1 < h ? i + w : -1] {
    if j >= 0 && exterior[j] && distance[j] > 1 { distance[j] = 1; ring.append(j) }
  }
}
cursor = 0
while cursor < ring.count {
  let i = ring[cursor]; cursor += 1
  if distance[i] >= radius { continue }
  let x = i % w, y = i / w
  for j in [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, y > 0 ? i - w : -1, y + 1 < h ? i + w : -1] {
    if j >= 0 && exterior[j] && distance[j] > distance[i] + 1 {
      distance[j] = distance[i] + 1; ring.append(j)
    }
  }
}
let matte = pixel(0).map(Double.init)
let edgeInk = [17.0, 16.0, 24.0]
var rgba = [UInt8](repeating: 0, count: count * 4), opaqueCount = 0, edgeCount = 0, clearCount = 0
var enclosedRGBChanges = 0, protectedDarkLoss = 0
for i in 0..<count {
  let original = pixel(i)
  if !exterior[i] {
    for c in 0..<3 { rgba[i * 4 + c] = original[c] }
    rgba[i * 4 + 3] = 255; opaqueCount += 1
  } else if distance[i] <= radius {
    let coverage = (0..<3).map { max(0, min(1, (matte[$0] - Double(original[$0])) / (matte[$0] - edgeInk[$0]))) }.max()!
    // Discard near-matte exterior texture rather than retaining a pale rectangle.
    if coverage >= 0.015 {
      let alpha = UInt8(max(1, min(255, (coverage * 255).rounded())))
      let a = Double(alpha) / 255
      // The soft raster edge contains near-matte chroma noise. Its estimated
      // straight RGB is neutralized only in this exterior partial-alpha ring,
      // preventing a blue/light fringe on dark website surfaces.
      let estimates = (0..<3).map { (Double(original[$0]) - matte[$0] * (1 - a)) / a }
      let neutralInk = UInt8(max(9, min(25, (estimates.reduce(0, +) / 3).rounded())))
      for c in 0..<3 { rgba[i * 4 + c] = alpha == 255 ? original[c] : neutralInk }
      rgba[i * 4 + 3] = alpha
      if alpha == 255 { opaqueCount += 1 } else { edgeCount += 1 }
    } else { clearCount += 1 }
  } else { clearCount += 1 }
  if !exterior[i] && (0..<3).contains(where: { rgba[i * 4 + $0] != original[$0] }) { enclosedRGBChanges += 1 }
  if original.max()! < 60 && rgba[i * 4 + 3] != 255 { protectedDarkLoss += 1 }
}
require(enclosedRGBChanges == 0 && protectedDarkLoss == 0, "Protected artwork changed")
for i in [0, w - 1, (h - 1) * w, count - 1] { require(rgba[i * 4 + 3] == 0, "An exterior corner is not clear") }

func bitmap(_ width: Int, _ height: Int, premultiplied: Bool = false) -> NSBitmapImageRep {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: source.colorSpaceName, bitmapFormat: premultiplied ? [] : .alphaNonpremultiplied,
    bytesPerRow: width * 4, bitsPerPixel: 32)!
  if let profile = source.value(forProperty: .colorSyncProfileData) { rep.setProperty(.colorSyncProfileData, withValue: profile) }
  return rep
}
func save(_ rep: NSBitmapImageRep, _ path: String) throws {
  try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}
let master = bitmap(w, h)
rgba.withUnsafeBufferPointer { master.bitmapData!.update(from: $0.baseAddress!, count: rgba.count) }
try FileManager.default.createDirectory(atPath: proof, withIntermediateDirectories: true)
let outputPath = assets + "duckplan-sigma-head-v11-transparent.png"
try save(master, outputPath)
for size in [192, 512] {
  let target = bitmap(size, size, premultiplied: true)
  guard let context = CGContext(data: target.bitmapData!, width: size, height: size,
    bitsPerComponent: 8, bytesPerRow: size * 4, space: master.cgImage!.colorSpace!,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("Cannot create alpha resize context") }
  context.interpolationQuality = .high
  context.draw(master.cgImage!, in: CGRect(x: 0, y: 0, width: size, height: size))
  try save(target, assets + "duckplan-sigma-icon-v11-transparent-\(size).png")
}
// A pixel-accurate binary eligibility map documents which source pixels were
// preserved and where exterior-only matte processing was permitted.
let mask = bitmap(w, h)
for i in 0..<count {
  let value: UInt8 = exterior[i] ? 0 : 255
  for c in 0..<3 { mask.bitmapData![i * 4 + c] = value }
  mask.bitmapData![i * 4 + 3] = 255
}
try save(mask, proof + "protected-interior-mask.png")
let report: [String: Any] = [
  "source": "landing/assets/duckplan-sigma-head-v11.png", "sourceSHA256": sha256(sourceData),
  "output": "landing/assets/duckplan-sigma-head-v11-transparent.png",
  "outputSHA256": sha256(try Data(contentsOf: URL(fileURLWithPath: outputPath))),
  "dimensions": [w,h], "barrierMaxChannel": Int(barrierLimit), "exteriorEdgeRadius": radius,
  "matteRawRGB": matte, "edgeInkEstimateRawRGB": edgeInk,
  "method": "Original source-pixel exterior flood fill with top/side seeds. Enclosed artwork copied unchanged. Only exterior-connected antialias pixels are alpha-matted/unmatted; no generated shape or generated pixels used.",
  "opaquePixels": opaqueCount, "partiallyTransparentEdgePixels": edgeCount, "clearPixels": clearCount,
  "enclosedRGBChanges": enclosedRGBChanges, "protectedVeryDarkAlphaLoss": protectedDarkLoss,
  "retainedWhiteBodyAndFace": true, "allExteriorCornersClear": true,
  "sourcePreserved": try Data(contentsOf: URL(fileURLWithPath: sourcePath)) == sourceData,
  "exports": [192,512], "resampling": "CoreGraphics high interpolation with premultiplied alpha, matching source RGB color profile",
  "exteriorUnmatteNeutralInkRange": [9,25]
]
let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted,.sortedKeys])
try json.write(to: URL(fileURLWithPath: proof + "export-report.json"))
print(String(data: json, encoding: .utf8)!)
