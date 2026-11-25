import AppKit
import SwiftUI

final class MorningGlanceHostingView: NSHostingView<MorningGlanceView> {
    var onHover: ((Bool) -> Void)?
    var onClick: (() -> Void)?
    var isPointerAllowed = false
    private var isArmed = false
    private var hoverArea: NSTrackingArea?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        hoverArea.map(removeTrackingArea)
        let area = NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
        addTrackingArea(area)
        hoverArea = area
    }

    override func mouseEntered(with event: NSEvent) {
        isArmed = isPointerAllowed
        onHover?(true)
    }

    override func mouseExited(with event: NSEvent) {
        isArmed = false
        onHover?(false)
    }

    override func mouseDown(with event: NSEvent) {}

    override func mouseUp(with event: NSEvent) {
        let isInside = bounds.contains(convert(event.locationInWindow, from: nil))
        guard isArmed, isInside else { return }
        onClick?()
    }
}
