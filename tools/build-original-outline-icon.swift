import AppKit
import Foundation
import Darwin

func require(_ condition: Bool, _ message: String) {
  if !condition {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
  }
}

// Copy and rotate the supplied artwork. Facial changes are isolated and checked
// against the untouched rotated source; the outline is never reconstructed.
struct Raster {
  let width: Int
  let height: Int
  var rgb: [UInt8]
  init(_ path: String) throws {
    guard let bitmap = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: path))) else {
      throw NSError(domain: "DuckIcon", code: 1)
    }
    width = bitmap.pixelsWide
    height = bitmap.pixelsHigh
    rgb = [UInt8](repeating: 255, count: width * height * 3)
    for y in 0..<height { for x in 0..<width {
      let color = bitmap.colorAt(x: x, y: y)!.usingColorSpace(.deviceRGB)!
      let alpha = color.alphaComponent
      let channels = [color.redComponent, color.greenComponent, color.blueComponent]
      for channel in 0..<3 {
        rgb[(y * width + x) * 3 + channel] = UInt8(max(0, min(255,
          ((channels[channel] * alpha + 1 - alpha) * 255).rounded())))
      }
    } }
  }
  init(width: Int, height: Int, color: [UInt8]) {
    self.width = width; self.height = height
    rgb = (0..<(width * height)).flatMap { _ in color }
  }
  func save(_ path: String) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width,
      pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false,
      isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: width * 3, bitsPerPixel: 24)!
    rgb.withUnsafeBufferPointer { buffer in
      bitmap.bitmapData!.update(from: buffer.baseAddress!, count: rgb.count)
    }
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
  }
}
struct Component {
  var points: [Int]
  var minX: Int; var minY: Int; var maxX: Int; var maxY: Int
  var centerX: Double; var centerY: Double
}
func components(_ image: Raster, roi: (Int, Int, Int, Int)? = nil) -> [Component] {
  let w = image.width, h = image.height
  var dark = [Bool](repeating: false, count: w * h)
  for y in 0..<h { for x in 0..<w {
    if let r = roi, (x < r.0 || y < r.1 || x >= r.2 || y >= r.3) { continue }
    let i = (y * w + x) * 3
    dark[y * w + x] = max(image.rgb[i], image.rgb[i + 1], image.rgb[i + 2]) < 77
  } }
  var seen = [Bool](repeating: false, count: w * h), result: [Component] = []
  for i in dark.indices where dark[i] && !seen[i] {
    var queue = [i], cursor = 0
    seen[i] = true
    var minX = i % w, maxX = minX, minY = i / w, maxY = minY, sumX = 0, sumY = 0
    while cursor < queue.count {
      let index = queue[cursor]; cursor += 1
      let x = index % w, y = index / w
      minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
      sumX += x; sumY += y
      for dy in -1...1 { for dx in -1...1 {
        let nx = x + dx, ny = y + dy
        if nx < 0 || nx >= w || ny < 0 || ny >= h { continue }
        let next = ny * w + nx
        if dark[next] && !seen[next] { seen[next] = true; queue.append(next) }
      } }
    }
    if queue.count > 100 {
      result.append(Component(points: queue, minX: minX, minY: minY, maxX: maxX, maxY: maxY,
        centerX: Double(sumX) / Double(queue.count), centerY: Double(sumY) / Double(queue.count)))
    }
  }
  return result.sorted { $0.points.count > $1.points.count }
}
let root = CommandLine.arguments.dropFirst().first { !$0.hasPrefix("--") } ?? FileManager.default.currentDirectoryPath
let raisedBrow = CommandLine.arguments.contains("--raised-brow")
let version = raisedBrow ? "v7" : "v6"
let originalPath = root + "/docs/sigma-mascot/source/original-duck-reference.png"
let original = try Raster(originalPath)
let expressionSource = raisedBrow ? "docs/sigma-mascot/source/raised-brow-features-v7.png" : "landing/assets/duckplan-sigma-head-v5.png"
let expression = try Raster(root + "/" + expressionSource)
let parts = components(original)
require(parts.count >= 4, "Missing original artwork components")
let eyes = [parts[2], parts[3]].sorted { $0.centerX < $1.centerX }
let cx = (eyes[0].centerX + eyes[1].centerX) / 2
let cy = (eyes[0].centerY + eyes[1].centerY) / 2
let angle = atan2(eyes[0].centerY - eyes[1].centerY, eyes[1].centerX - eyes[0].centerX)
let cosine = cos(angle), sine = sin(angle)
func rotate(_ x: Double, _ y: Double) -> (Double, Double) {
  let dx = x - cx, dy = y - cy
  return (cx + dx * cosine - dy * sine, cy + dx * sine + dy * cosine)
}
func inverse(_ x: Double, _ y: Double) -> (Double, Double) {
  let dx = x - cx, dy = y - cy
  return (cx + dx * cosine + dy * sine, cy - dx * sine + dy * cosine)
}
var outlineMask = [Bool](repeating: false, count: original.width * original.height)
var beakMask = outlineMask, eraseMask = outlineMask
for i in parts[0].points { outlineMask[i] = true }
for i in parts[1].points { beakMask[i] = true }
for i in beakMask.indices {
  let r = Int(original.rgb[i * 3]), g = Int(original.rgb[i * 3 + 1]), b = Int(original.rgb[i * 3 + 2])
  if r > 180 && r - b > 20 && r - g > 8 { beakMask[i] = true }
}
func dilate(_ mask: [Bool], radius: Int) -> [Bool] {
  var result = mask
  for i in mask.indices where mask[i] {
    let x = i % original.width, y = i / original.width
    for dy in -radius...radius { for dx in -radius...radius {
      let nx = x + dx, ny = y + dy
      if nx >= 0 && nx < original.width && ny >= 0 && ny < original.height {
        result[ny * original.width + nx] = true
      }
    } }
  }
  return result
}
outlineMask = dilate(outlineMask, radius: 2)
beakMask = dilate(beakMask, radius: 1)
for eye in eyes { for i in eye.points {
  let x = i % original.width, y = i / original.width
  for dy in -3...3 { for dx in -3...3 {
    let nx = x + dx, ny = y + dy
    if nx >= 0 && nx < original.width && ny >= 0 && ny < original.height {
      eraseMask[ny * original.width + nx] = true
    }
  } }
} }
require(!eraseMask.indices.contains { eraseMask[$0] && (outlineMask[$0] || beakMask[$0]) }, "Eye erasure overlaps protected artwork")
let background = Array(original.rgb[0..<3])
let fillIndex = (203 * original.width + 171) * 3
let faceWhite = Array(original.rgb[fillIndex..<(fillIndex + 3)])
var clean = original
for i in eraseMask.indices where eraseMask[i] {
  for channel in 0..<3 { clean.rgb[i * 3 + channel] = faceWhite[channel] }
}
let size = 1024
let cropX = 74.0, cropY = 58.0, cropSize = 280.0
let proof = root + "/docs/sigma-mascot/" + version + "-preservation/"
try FileManager.default.createDirectory(atPath: proof, withIntermediateDirectories: true)
func taps(_ x: Double, _ y: Double) -> [(Int, Double)] {
  let x0 = Int(floor(x)), y0 = Int(floor(y)), fx = x - Double(x0), fy = y - Double(y0)
  return [(x0,y0,(1-fx)*(1-fy)), (x0+1,y0,fx*(1-fy)), (x0,y0+1,(1-fx)*fy), (x0+1,y0+1,fx*fy)]
    .filter { $0.0 >= 0 && $0.0 < original.width && $0.1 >= 0 && $0.1 < original.height }
    .map { ($0.1 * original.width + $0.0, $0.2) }
}
func sample(_ image: Raster, _ neighbors: [(Int, Double)], _ channel: Int) -> UInt8 {
  let weight = neighbors.reduce(0) { $0 + $1.1 }
  let value = neighbors.reduce(Double(background[channel]) * (1 - weight)) { $0 + Double(image.rgb[$1.0 * 3 + channel]) * $1.1 }
  return UInt8(max(0, min(255, value.rounded())))
}
var baseline = Raster(width: size, height: size, color: background)
var final = baseline
var editMask = [Bool](repeating: false, count: size * size)
var protectedOutline = editMask, protectedBeak = editMask
for y in 0..<size { for x in 0..<size {
  let rx = cropX + (Double(x) + 0.5) * cropSize / Double(size)
  let ry = cropY + (Double(y) + 0.5) * cropSize / Double(size)
  let source = inverse(rx, ry), neighbors = taps(source.0, source.1), i = y * size + x
  editMask[i] = neighbors.contains { eraseMask[$0.0] && $0.1 > 0 }
  protectedOutline[i] = neighbors.contains { outlineMask[$0.0] && $0.1 > 0 }
  protectedBeak[i] = neighbors.contains { beakMask[$0.0] && $0.1 > 0 }
  for channel in 0..<3 {
    baseline.rgb[i * 3 + channel] = sample(original, neighbors, channel)
    final.rgb[i * 3 + channel] = sample(clean, neighbors, channel)
  }
} }
try baseline.save(proof + "rotated-original.png")
func merge(_ parts: [Component]) -> Component {
  require(!parts.isEmpty, "Missing expression feature")
  let points = parts.flatMap { $0.points }
  return Component(points: points,
    minX: parts.map { $0.minX }.min()!, minY: parts.map { $0.minY }.min()!,
    maxX: parts.map { $0.maxX }.max()!, maxY: parts.map { $0.maxY }.max()!,
    centerX: parts.reduce(0) { $0 + $1.centerX * Double($1.points.count) } / Double(points.count),
    centerY: parts.reduce(0) { $0 + $1.centerY * Double($1.points.count) } / Double(points.count))
}
let features = components(expression, roi: raisedBrow ? nil : (370, 330, 880, 501))
let browCutoff = raisedBrow ? Double(expression.height) * 0.52 : 420
let browParts = features.filter { $0.centerY < browCutoff }
let eyeParts = features.filter { $0.centerY >= browCutoff }
// Open eyes have disconnected pupils; keep each pupil with its eye outline.
let brows = raisedBrow ? [true, false].map { left in
  merge(browParts.filter { ($0.centerX < Double(expression.width) / 2) == left })
} : browParts.sorted { $0.centerX < $1.centerX }
let lids = raisedBrow ? [true, false].map { left in
  merge(eyeParts.filter { ($0.centerX < Double(expression.width) / 2) == left })
} : eyeParts.sorted { $0.centerX < $1.centerX }
require(brows.count == 2 && lids.count == 2, "Expected four expression components; found \(brows.count) brows and \(lids.count) eyes")
func composite(_ feature: Component, center: (Double, Double), width: Double) {
  let minX = feature.minX - 2, minY = feature.minY - 2
  let patchWidth = feature.maxX - minX + 3, patchHeight = feature.maxY - minY + 3
  let height = width * Double(patchHeight) / Double(patchWidth)
  let left = center.0 - width / 2, top = center.1 - height / 2
  let destLeft = max(0, Int(floor((left - cropX) * Double(size) / cropSize)))
  let destRight = min(size, Int(ceil((left + width - cropX) * Double(size) / cropSize)))
  let destTop = max(0, Int(floor((top - cropY) * Double(size) / cropSize)))
  let destBottom = min(size, Int(ceil((top + height - cropY) * Double(size) / cropSize)))
  for y in destTop..<destBottom { for x in destLeft..<destRight {
    let rx = cropX + (Double(x) + 0.5) * cropSize / Double(size)
    let ry = cropY + (Double(y) + 0.5) * cropSize / Double(size)
    let sx = Double(minX) + (rx - left) / width * Double(patchWidth) - 0.5
    let sy = Double(minY) + (ry - top) / height * Double(patchHeight) - 0.5
    let x0 = Int(floor(sx)), y0 = Int(floor(sy)), fx = sx - Double(x0), fy = sy - Double(y0)
    var opacity = 0.0
    for (px,py,weight) in [(x0,y0,(1-fx)*(1-fy)),(x0+1,y0,fx*(1-fy)),(x0,y0+1,(1-fx)*fy),(x0+1,y0+1,fx*fy)] {
      if px < minX || py < minY || px >= minX + patchWidth || py >= minY + patchHeight { continue }
      let index = (py * expression.width + px) * 3
      let luminance = (Double(expression.rgb[index]) + Double(expression.rgb[index+1]) + Double(expression.rgb[index+2])) / 3
      if luminance < 238 { opacity += max(0, 1 - luminance / 247) * weight }
    }
    if opacity < 0.001 { continue }
    let i = y * size + x
    require(!protectedOutline[i] && !protectedBeak[i], "Expression touches protected \(protectedOutline[i] ? "outline" : "beak") at output (\(x),\(y)), original plane (\(rx),\(ry))")
    editMask[i] = true
    for channel in 0..<3 { final.rgb[i * 3 + channel] = UInt8((Double(final.rgb[i * 3 + channel]) * (1 - min(1, opacity))).rounded()) }
  } }
}
for side in 0..<2 {
  let eye = rotate(eyes[side].centerX, eyes[side].centerY)
  let inward = side == 0 ? 4.0 : -4.0
  composite(lids[side], center: (eye.0 + inward, eye.1 - 13), width: 43)
  let browInset = side == 0 ? 14.0 : -14.0
  let browLift = raisedBrow ? (side == 0 ? 49.0 : 34.0) : 40.0
  composite(brows[side], center: (eye.0 + inward + browInset, eye.1 - browLift), width: 45)
}
var changes = 0, outsideEdits = 0, outlineChanges = 0, beakChanges = 0
for i in 0..<(size * size) {
  let changed = (0..<3).contains { final.rgb[i * 3 + $0] != baseline.rgb[i * 3 + $0] }
  if changed {
    changes += 1
    if !editMask[i] { outsideEdits += 1 }
    if protectedOutline[i] { outlineChanges += 1 }
    if protectedBeak[i] { beakChanges += 1 }
  }
}
require(outsideEdits == 0 && outlineChanges == 0 && beakChanges == 0, "Protected pixels changed")
var mask = Raster(width: size, height: size, color: [0,0,0])
for i in editMask.indices where editMask[i] { for channel in 0..<3 { mask.rgb[i * 3 + channel] = 255 } }
try mask.save(proof + "facial-edit-mask.png")
try final.save(root + "/landing/assets/duckplan-sigma-head-" + version + ".png")
let report: [String: Any] = [
  "source": "docs/sigma-mascot/source/original-duck-reference.png",
  "expressionSource": expressionSource,
  "clockwiseDegrees": angle * 180 / Double.pi,
  "pivot": [cx,cy], "rotatedCrop": [cropX,cropY,cropSize,cropSize],
  "outputSize": size, "changedFacialPixels": changes,
  "changedPixelsOutsideFacialEdits": outsideEdits,
  "changedOriginalOutlinePixels": outlineChanges, "changedOriginalBeakPixels": beakChanges,
  "method": "Original raster copied with one rotation/scale/crop; \(raisedBrow ? "reference-inspired asymmetric raised-brow" : "existing") expression components composited inside. No generated or reconstructed contour."
]
let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted,.sortedKeys])
try data.write(to: URL(fileURLWithPath: proof + "preservation-report.json"))
print(String(data: data, encoding: .utf8)!)
