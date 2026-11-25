import AppKit
import SwiftUI

private let renderFailure = "a glyph and a count always render into an image"

@MainActor enum MenuBarCountImage {
    // NB ADR 0065: the status item drops SwiftUI alpha, so the glyph and the count are drawn into one template image with the count at the step's opacity.
    static func render(badgeText: String, opacity: Double, displayScale: CGFloat) -> NSImage {
        let content = HStack(spacing: menuBarLabelSpacing) {
            Image(menuBarGlyphName)
            Text(badgeText)
                .monospacedDigit()
                .opacity(opacity)
        }
        .foregroundStyle(.black)
        let renderer = ImageRenderer(content: content)
        renderer.scale = displayScale
        guard let image = renderer.nsImage else { preconditionFailure(renderFailure) }
        image.isTemplate = true
        return image
    }
}
