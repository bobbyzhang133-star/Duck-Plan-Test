import Foundation
import AppKit
let folder = CommandLine.arguments[1]
let data = try Data(contentsOf: URL(fileURLWithPath: folder + "/frames.json"))
let input = try JSONSerialization.jsonObject(with: data) as! [String: Any]
let frames = input["events"] as! [[String: Any]]
let probe = input["probe"] as? [String: Any] ?? ["mode": "white-edge", "x": 500, "minY": 30, "maxY": 150]
let mode = probe["mode"] as! String
let probeX = probe["x"] as! Int
let minY = probe["minY"] as! Int
let maxY = probe["maxY"] as! Int
var samples = [[String: Any]]()
var peak = 0
var peakEdge = -1
for (index, frame) in frames.enumerated() {
  let png = Data(base64Encoded: frame["png"] as! String)!
  let bitmap = NSBitmapImageRep(data: png)!
  var edge = -1
  var darkest: CGFloat = 1
  for y in minY..<maxY {
    if let color = bitmap.colorAt(x: probeX, y: y)?.usingColorSpace(.deviceRGB) {
      if mode == "white-edge" && color.redComponent > 0.99 && color.greenComponent > 0.99 && color.blueComponent > 0.99 { edge = y; break }
      if mode == "hour-rule" && color.blueComponent < darkest { darkest = color.blueComponent; edge = y }
    }
  }
  if edge > peakEdge { peakEdge = edge; peak = index }
  samples.append(["timeMs": frame["timeMs"]!, "paintEdgeY": edge])
  if index == 0 || index == frames.count - 1 { try png.write(to: URL(fileURLWithPath: folder + (index == 0 ? "/before.png" : "/settled.png"))) }
}
try Data(base64Encoded: frames[peak]["png"] as! String)!.write(to: URL(fileURLWithPath: folder + "/peak.png"))
let result: [String: Any] = ["referenceUrl": input["referenceUrl"]!, "runtime": input["runtime"]!, "platform": input["platform"]!, "samples": samples]
let output = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
try output.write(to: URL(fileURLWithPath: folder + "/samples.json"))
print(String(data: output, encoding: .utf8)!)
