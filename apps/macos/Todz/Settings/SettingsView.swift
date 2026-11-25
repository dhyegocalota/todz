import SwiftUI
import TodzKit

let subtitleLines = 2
private let focusSettingsAddress = "x-apple.systempreferences:com.apple.Focus-Settings.extension"

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(ProactiveGate.self) private var gate
    @Environment(\.openURL) private var openURL
    @AppStorage(MenuBarBadge.storageKey) private var isCountEnabled = MenuBarBadge.isEnabledByDefault

    var body: some View {
        Form {
            Toggle(isOn: $isCountEnabled) {
                Text(SettingsCopy.showPendingCount)
                Text(SettingsCopy.showPendingCountDetail)
            }
            .toggleStyle(.switch)
            Toggle(isOn: agentNudge) {
                Text(SettingsCopy.agentNudge)
                Text(SettingsCopy.agentNudgeSubtitle(notice: model.agentNudgeNotice))
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            .toggleStyle(.switch)
            .disabled(!model.canChangeAgentNudge)
            LabeledContent {
                Button(SettingsCopy.openFocusSettings, action: openFocusSettings)
            } label: {
                Text(SettingsCopy.focusQuiet)
                Text(SettingsCopy.focusQuietSubtitle(notice: FocusQuietNotice(isQuiet: gate.isQuiet)))
                    .lineLimit(subtitleLines, reservesSpace: true)
            }
            Section {
                ServerAddressForm(layout: .row, exit: {})
            }
        }
        .formStyle(.grouped)
        .fixedSize(horizontal: false, vertical: true)
        .onChange(of: model.agentNudgeNotice) { _, notice in announce(notice) }
        .onDisappear { model.forgetAgentNudgeFailure() }
    }

    private var agentNudge: Binding<Bool> {
        Binding {
            model.agentNudge == true
        } set: { isEnabled in
            Task { await model.changeAgentNudge(isEnabled: isEnabled) }
        }
    }

    private func openFocusSettings() {
        guard let focusSettings = URL(string: focusSettingsAddress) else { return }
        openURL(focusSettings)
    }

    private func announce(_ notice: AgentNudgeNotice) {
        guard notice == .notSaved else { return }
        AccessibilityNotification.Announcement(ErrorCopy.changeNotSaved).post()
    }
}
