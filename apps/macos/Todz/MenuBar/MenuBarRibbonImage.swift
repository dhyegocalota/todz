import AppKit
import SwiftUI
import TodzKit

private let renderFailure = "a glyph and a line always render into an image"
private let glyphFailure = "the menu bar glyph ships in the asset catalog"
private let bitmapFailure = "a bitmap of a frame's size always exists"
private let bitsPerComponent = 8
private let componentsPerPixel = 4
private let stripScale: CGFloat = 2

struct MenuBarRibbonStrip {
    let image: NSImage
    let textWidth: Double

    var textOrigin: Double {
        image.size.width - textWidth
    }
}

@MainActor enum MenuBarRibbonImage {
    // NB ADR 0071: the line is rendered once into a template strip and every frame is a crop of it.
    static func strip(content: RibbonContent, isMotionReduced: Bool) -> MenuBarRibbonStrip {
        let maxTextWidth = isMotionReduced ? RibbonMotion.windowWidth : RibbonMotion.stripMaxWidth
        guard let glyph = NSImage(named: menuBarGlyphName) else { preconditionFailure(glyphFailure) }
        let line = Text(MenuBarCopy.ribbon(content))
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: maxTextWidth, alignment: .leading)
        let drawing = HStack(spacing: MenuBarLayout.glyphSpacing) {
            Image(menuBarGlyphName)
            line
                .offset(y: -MenuBarLayout.countRise)
        }
        .foregroundStyle(.black)
        let renderer = ImageRenderer(content: drawing)
        renderer.scale = stripScale
        guard let image = renderer.nsImage else { preconditionFailure(renderFailure) }
        image.isTemplate = true
        let textOrigin = MenuBarLayout.textOrigin(glyphWidth: glyph.size.width)
        return MenuBarRibbonStrip(image: image, textWidth: image.size.width - textOrigin)
    }

    static func frame(strip: MenuBarRibbonStrip, frame: RibbonFrame, displayScale: CGFloat) -> NSImage {
        let shownTextWidth = min(strip.textWidth, RibbonMotion.windowWidth)
        let revealedWidth = shownTextWidth * frame.reveal
        let size = NSSize(width: strip.textOrigin + shownTextWidth, height: strip.image.size.height)
        let glyphArea = NSRect(x: 0, y: 0, width: strip.textOrigin, height: size.height)
        let textSource = NSRect(x: strip.textOrigin + frame.offset, y: 0, width: revealedWidth, height: size.height)
        let textTarget = NSRect(x: strip.textOrigin, y: 0, width: revealedWidth, height: size.height)
        guard let bitmap = bitmap(size: size, displayScale: displayScale), let context = NSGraphicsContext(bitmapImageRep: bitmap) else { preconditionFailure(bitmapFailure) }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        strip.image.draw(in: glyphArea, from: glyphArea, operation: .sourceOver, fraction: 1)
        if revealedWidth > 0 {
            strip.image.draw(in: textTarget, from: textSource, operation: .sourceOver, fraction: frame.reveal)
        }
        NSGraphicsContext.restoreGraphicsState()
        let image = NSImage(size: size)
        image.addRepresentation(bitmap)
        image.isTemplate = true
        return image
    }

    private static func bitmap(size: NSSize, displayScale: CGFloat) -> NSBitmapImageRep? {
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int((size.width * displayScale).rounded(.up)),
            pixelsHigh: Int((size.height * displayScale).rounded(.up)),
            bitsPerSample: bitsPerComponent,
            samplesPerPixel: componentsPerPixel,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )
        bitmap?.size = size
        return bitmap
    }
}
