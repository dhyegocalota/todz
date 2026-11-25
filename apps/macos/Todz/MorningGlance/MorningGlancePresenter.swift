import AppKit
import SwiftUI
import TodzKit

private let screenInset: CGFloat = 12
private let occlusionWait: Duration = .seconds(1)

@MainActor final class MorningGlancePresenter {
    weak var coordinator: MorningGlanceCoordinator?
    private let windowState: MainWindowState
    private var panel: MorningGlancePanel?
    private var dwell = MorningGlanceDwell(shownAt: .now)
    private var graceTask: Task<Void, Never>?
    private var dwellTask: Task<Void, Never>?

    init(windowState: MainWindowState) {
        self.windowState = windowState
    }

    func show(_ content: MorningGlanceContent) async -> Bool {
        let isLocked = ScreenLock.isLocked
        guard let screen = NSScreen.screens.first, !isLocked else { return false }
        close()
        let hostingView = MorningGlanceHostingView(rootView: MorningGlanceView(content: content, open: open))
        hostingView.onHover = hover
        hostingView.onClick = open
        let glancePanel = MorningGlancePanel(contentView: hostingView)
        panel = glancePanel
        glancePanel.setFrameOrigin(origin(of: glancePanel, on: screen))
        glancePanel.ignoresMouseEvents = true
        if NSApp.isHidden { NSApp.unhideWithoutActivation() }
        glancePanel.orderFrontRegardless()
        guard await isVisible(glancePanel), panel === glancePanel else {
            dismissWithoutSignal(glancePanel)
            return false
        }
        AccessibilityNotification.Announcement(AccessibilityCopy.menuBarCount(count: content.openCount)).post()
        dwell = MorningGlanceDwell(shownAt: .now)
        allowPointerAfterGrace(on: glancePanel)
        scheduleFade(of: glancePanel)
        return true
    }

    func close() {
        guard let panel else { return }
        dismissWithoutSignal(panel)
    }

    private func open() {
        guard let panel else { return }
        dismissWithoutSignal(panel)
        coordinator?.dismissed()
        windowState.waitingLink = .today
    }

    private func hover(isOver: Bool) {
        guard let panel else { return }
        dwell = isOver ? dwell.hovered(at: .now) : dwell.left(at: .now)
        scheduleFade(of: panel)
    }

    private func origin(of glancePanel: NSPanel, on screen: NSScreen) -> NSPoint {
        let visibleFrame = screen.visibleFrame
        return NSPoint(
            x: visibleFrame.maxX - glancePanel.frame.width - screenInset,
            y: visibleFrame.maxY - glancePanel.frame.height - screenInset
        )
    }

    private func dismissWithoutSignal(_ glancePanel: MorningGlancePanel) {
        graceTask?.cancel()
        dwellTask?.cancel()
        glancePanel.orderOut(nil)
        guard panel === glancePanel else { return }
        panel = nil
    }

    private func allowPointerAfterGrace(on glancePanel: MorningGlancePanel) {
        graceTask?.cancel()
        graceTask = Task {
            try? await Task.sleep(for: .seconds(MorningGlanceDwell.pointerGrace))
            guard !Task.isCancelled else { return }
            glancePanel.ignoresMouseEvents = false
        }
    }

    private func scheduleFade(of glancePanel: MorningGlancePanel) {
        dwellTask?.cancel()
        let wait = max(dwell.fadeStart.timeIntervalSinceNow, 0)
        dwellTask = Task {
            try? await Task.sleep(for: .seconds(wait))
            guard !Task.isCancelled else { return }
            fade(glancePanel)
        }
    }

    private func fade(_ glancePanel: MorningGlancePanel) {
        glancePanel.ignoresMouseEvents = true
        let reducesMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        NSAnimationContext.runAnimationGroup { context in
            context.duration = MorningGlanceDwell.fadeDuration(reducesMotion: reducesMotion)
            glancePanel.animator().alphaValue = 0
        } completionHandler: { [weak self, weak glancePanel] in
            MainActor.assumeIsolated {
                guard let self, let glancePanel, self.panel === glancePanel else { return }
                self.dismissWithoutSignal(glancePanel)
                self.coordinator?.dismissed()
            }
        }
    }

    private func isVisible(_ glancePanel: MorningGlancePanel) async -> Bool {
        guard !glancePanel.occlusionState.contains(.visible) else { return true }
        let (changes, change) = AsyncStream.makeStream(of: Bool.self)
        let observation = NotificationCenter.default.addObserver(
            forName: NSWindow.didChangeOcclusionStateNotification,
            object: glancePanel,
            queue: .main
        ) { [weak glancePanel] _ in
            MainActor.assumeIsolated { _ = change.yield(glancePanel?.occlusionState.contains(.visible) == true) }
        }
        let timeout = Task {
            try? await Task.sleep(for: occlusionWait)
            change.finish()
        }
        defer {
            NotificationCenter.default.removeObserver(observation)
            timeout.cancel()
        }
        for await isVisible in changes where isVisible { return true }
        return false
    }
}
