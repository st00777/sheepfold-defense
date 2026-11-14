// 用 macOS 內建的「主體去背」（Vision，macOS 14 以上）算出前景遮罩，存成灰階 PNG。先編譯：swiftc -O scripts/subject-mask.swift -o /tmp/subject-mask；用法：subject-mask <原圖> <遮罩.png> [更多成對的 原圖 遮罩]
import Foundation
import Vision
import CoreImage
import AppKit

let a = CommandLine.arguments
var i = 1
let ctx = CIContext()
while i + 1 < a.count {
  let src = URL(fileURLWithPath: a[i]), dst = URL(fileURLWithPath: a[i + 1]); i += 2
  guard let ci = CIImage(contentsOf: src) else { print("讀不到 \(src.lastPathComponent)"); continue }
  let handler = VNImageRequestHandler(ciImage: ci)
  let req = VNGenerateForegroundInstanceMaskRequest()
  do {
    try handler.perform([req])
    guard let r = req.results?.first else { print("沒找到主體 \(src.lastPathComponent)"); continue }
    let buf = try r.generateScaledMaskForImage(forInstances: r.allInstances, from: handler)
    let m = CIImage(cvPixelBuffer: buf)
    try ctx.writePNGRepresentation(of: m, to: dst, format: .L8, colorSpace: CGColorSpace(name: CGColorSpace.linearGray)!)
    print("\(src.lastPathComponent) 主體數 \(r.allInstances.count)")
  } catch { print("失敗 \(src.lastPathComponent): \(error)") }
}
