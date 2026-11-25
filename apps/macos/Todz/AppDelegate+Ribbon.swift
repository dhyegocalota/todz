import AppKit
import TodzKit

extension AppDelegate {
    func startRibbon() {
        ribbonScheduler.start()
    }

    func makeRibbon() -> RibbonCoordinator {
        RibbonCoordinator(
            gate: gate,
            preference: RibbonPreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain),
            isDayCloseOn: { DayClosePreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain).isOn },
            timeZone: model.timeZone,
            pause: { try await Task.sleep(for: $0) },
            content: { [model] in model.ribbonContent },
            isScreenLocked: { ScreenLock.isLocked },
            isPopoverVisible: { [panel] in panel.isShown },
            isMotionReduced: { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion },
            textWidth: { [ribbonStrips] in
                ribbonStrips.strip(content: $0, isMotionReduced: NSWorkspace.shared.accessibilityDisplayShouldReduceMotion).textWidth
            }
        )
    }
}
