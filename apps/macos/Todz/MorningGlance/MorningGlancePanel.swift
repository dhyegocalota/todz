import AppKit

final class MorningGlancePanel: NSPanel {
    let hostingView: MorningGlanceHostingView

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    init(hostingView: MorningGlanceHostingView) {
        self.hostingView = hostingView
        super.init(
            contentRect: NSRect(origin: .zero, size: NSSize(width: morningGlanceWidth, height: hostingView.fittingSize.height)),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        contentView = hostingView
        level = .statusBar
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        canHide = false
        sharingType = .none
        hidesOnDeactivate = false
        becomesKeyOnlyIfNeeded = true
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        isReleasedWhenClosed = false
    }
}
