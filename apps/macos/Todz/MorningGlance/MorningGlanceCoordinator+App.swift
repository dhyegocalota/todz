import AppKit
import TodzKit

private let displayNumberKey = NSDeviceDescriptionKey("NSScreenNumber")

@MainActor private func isMenuBarScreenMirrored() -> Bool {
    guard let displayNumber = NSScreen.screens.first?.deviceDescription[displayNumberKey] as? NSNumber else { return true }
    return CGDisplayIsInMirrorSet(displayNumber.uint32Value) != 0
}

@MainActor private func isMenuBarScreenCaptured() -> Bool {
    guard let displayNumber = NSScreen.screens.first?.deviceDescription[displayNumberKey] as? NSNumber else { return true }
    return CGDisplayIsCaptured(displayNumber.uint32Value) != 0
}

extension MorningGlanceCoordinator {
    @MainActor static func app(
        model: AppModel,
        gate: ProactiveGate,
        dayClose: DayCloseCoordinator,
        popover: MenuBarPanel,
        presenter: MorningGlancePresenter
    ) -> MorningGlanceCoordinator {
        let coordinator = MorningGlanceCoordinator(
            gate: gate,
            preference: MorningGlancePreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain),
            timeZone: model.timeZone,
            content: { model.morningGlanceContent },
            isScreenLocked: { ScreenLock.isLocked },
            isScreenMirrored: isMenuBarScreenMirrored,
            isScreenCaptured: isMenuBarScreenCaptured,
            isTodayInFront: {
                MorningGlanceFront.isInFront(
                    isDayCloseDue: dayClose.isDueAndIdle,
                    isClosingDay: dayClose.isClosingDay,
                    isPopoverShown: popover.isShown,
                    isApplicationActive: NSApp.isActive,
                    hasVisibleMainCapableWindow: NSApp.windows.contains { $0.isVisible && $0.canBecomeMain }
                )
            },
            showPanel: { await presenter.show($0) },
            closePanel: { presenter.close() }
        )
        presenter.coordinator = coordinator
        return coordinator
    }
}
