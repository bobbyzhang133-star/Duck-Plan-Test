import AppKit
import Foundation
func load(_ path: String) throws -> NSBitmapImageRep {
 guard let r=NSBitmapImageRep(data:try Data(contentsOf:URL(fileURLWithPath:path))) else {throw NSError(domain:"IconQA",code:1)}
 return r
}
func rgba(_ r:NSBitmapImageRep,_ x:Int,_ y:Int)->[Int] {
 let c=r.colorAt(x:x,y:y)!.usingColorSpace(.deviceRGB)!
 return [c.redComponent,c.greenComponent,c.blueComponent,c.alphaComponent].map{Int(($0*255).rounded())}
}
let args=Array(CommandLine.arguments.dropFirst())
guard args.count>=1 else {fatalError("source PNG required, optional candidate PNG")}
let src=try load(args[0]), w=src.pixelsWide,h=src.pixelsHigh
var out:[String:Any]=["sourceDimensions":[w,h],"sourceHasAlpha":src.hasAlpha,"sourceBitmapFormat":src.bitmapFormat.rawValue,"sourceColorSpace":src.colorSpaceName.rawValue]
let points:[[Int]]=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[512,200],[512,950],[360,350],[512,600],[20,900],[100,100]]
out["sourceProbes"]=points.map{["xy":$0,"rgba":rgba(src,$0[0],$0[1])]}
if args.count>1 {
 let dst=try load(args[1]);out["candidateDimensions"]=[dst.pixelsWide,dst.pixelsHigh];out["candidateHasAlpha"]=dst.hasAlpha;out["candidateBitmapFormat"]=dst.bitmapFormat.rawValue;out["candidateColorSpace"]=dst.colorSpaceName.rawValue
 if dst.pixelsWide==w && dst.pixelsHigh==h {
  var transparent=0,partial=0,opaque=0,opaqueRGBMismatch=0,sourceDark=0,darkAlphaLoss=0,darkRGBMismatch=0
  var minX=w,minY=h,maxX = -1,maxY = -1
  for y in 0..<h {for x in 0..<w {
   let a=rgba(src,x,y),b=rgba(dst,x,y),alpha=b[3]
   if alpha==0 {transparent+=1} else {minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y);if alpha==255 {opaque+=1;if a[0...2] != b[0...2] {opaqueRGBMismatch+=1}} else {partial+=1}}
   if a[0...2].max()!<60 {sourceDark+=1;if alpha<250 {darkAlphaLoss+=1};if a[0...2] != b[0...2] {darkRGBMismatch+=1}}
  }}
  out["alphaCounts"]=["transparent":transparent,"partial":partial,"opaque":opaque];out["alphaBounds"]=[minX,minY,maxX,maxY];out["opaqueRGBMismatch"]=opaqueRGBMismatch;out["sourceVeryDarkPixelCount"]=sourceDark;out["sourceVeryDarkAlphaLoss"]=darkAlphaLoss;out["sourceVeryDarkRGBMismatch"]=darkRGBMismatch
  out["candidateProbes"]=points.map{["xy":$0,"rgba":rgba(dst,$0[0],$0[1])]}
  var coreAlphaLoss=0,coreRGBMismatch=0,coreCount=0
  for y in 220..<960 {for x in 280..<740 {let a=rgba(src,x,y),b=rgba(dst,x,y);coreCount+=1;if b[3] != 255 {coreAlphaLoss+=1};if a[0...2] != b[0...2] {coreRGBMismatch+=1}}}
  out["centralSubjectCore"]=["pixels":coreCount,"alphaLoss":coreAlphaLoss,"rgbMismatch":coreRGBMismatch]
 }
}
let data=try JSONSerialization.data(withJSONObject:out,options:[.prettyPrinted,.sortedKeys]);print(String(data:data,encoding:.utf8)!)
