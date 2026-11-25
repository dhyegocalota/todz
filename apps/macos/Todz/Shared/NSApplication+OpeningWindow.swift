import AppKit
import TodzKit

extension NSApplication.ActivationPolicy {
    init(_ activation: AppActivation) {
        switch activation {
        case .regular: self = .regular
        case .accessory: self = .accessory
        }
    }
}

extension NSApplication {
    // NB ADR 0074: opening a window sets the rule's policy before it activates, since a hidden app's window never becomes key on its own.
    func activateForAnOpeningWindow() {
        let preference = MenuBarOnlyPreference(defaults: .standard, domainName: AppConfiguration.defaultsDomain)
        setActivationPolicy(NSApplication.ActivationPolicy(ActivationPolicyRule.policyForAnOpeningWindow(isSettingOn: preference.isOn)))
        activate()
    }
}
