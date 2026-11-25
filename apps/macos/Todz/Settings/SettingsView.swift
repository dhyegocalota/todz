import SwiftUI
import TodzKit

private let subtitleLines = 2

struct SettingsView: View {
    @Environment(AppModel.self) private var model
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

    private func announce(_ notice: AgentNudgeNotice) {
        guard notice == .notSaved else { return }
        AccessibilityNotification.Announcement(ErrorCopy.changeNotSaved).post()
    }
}
