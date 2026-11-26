import AppKit
import SwiftUI
import TodzKit

private let renderFailure = "a glyph and a count always render into an image"

@MainActor enum MenuBarCountImage {
    // NB ADR 0065: the status item drops SwiftUI alpha, so the glyph and the count are drawn into one template image with the count at the step's opacity.
    static func render(badgeText: String, opacity: Double, displayScale: CGFloat) -> NSImage {
        let content = HStack(spacing: MenuBarLayout.glyphSpacing) {
            Image(menuBarGlyphName)
            Text(badgeText)
                .monospacedDigit()
                .offset(y: -MenuBarLayout.countRise)
                .opacity(opacity)
        }
        .foregroundStyle(.black)
        return template(of: content, displayScale: displayScale)
    }

    // NB ADR 0106: a roll frame draws both counts in the width of the wider one, clipped to one line, so the item resizes only when the roll ends.
    static func renderRoll(presentation: CountRollPresentation, opacity: Double, displayScale: CGFloat) -> NSImage {
        let frame = presentation.frame
        let isOutgoingWider = presentation.outgoing.count > presentation.incoming.count
        let widest = isOutgoingWider ? presentation.outgoing : presentation.incoming
        let content = HStack(spacing: MenuBarLayout.glyphSpacing) {
            Image(menuBarGlyphName)
            ZStack(alignment: .leading) {
                Text(widest).hidden()
                Text(presentation.outgoing)
                    .offset(y: -frame.outgoingRise)
                    .opacity(frame.outgoingOpacity)
                Text(presentation.incoming)
                    .offset(y: -frame.incomingRise)
                    .opacity(frame.incomingOpacity)
            }
            .monospacedDigit()
            .clipped()
            .offset(y: -MenuBarLayout.countRise)
            .opacity(opacity)
        }
        .foregroundStyle(.black)
        return template(of: content, displayScale: displayScale)
    }

    private static func template(of content: some View, displayScale: CGFloat) -> NSImage {
        let renderer = ImageRenderer(content: content)
        renderer.scale = displayScale
        guard let image = renderer.nsImage else { preconditionFailure(renderFailure) }
        image.isTemplate = true
        return image
    }
}
