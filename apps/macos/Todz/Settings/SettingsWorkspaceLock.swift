import SwiftUI
import TodzKit

struct SettingsWorkspaceLock: View {
    @Environment(AppModel.self) private var model
    @State private var isConfirming = false

    var body: some View {
        Group {
            SettingsRow(title: SettingsCopy.lockWorkspaces, detail: SettingsCopy.lockWorkspacesDetail) {
                Toggle(SettingsCopy.lockWorkspaces, isOn: isOn)
                    .toggleStyle(.switch)
                    .labelsHidden()
                    .disabled(isConfirming)
                    .disabled(because: unavailableReason)
            }
            if model.workspaceLock.isEnabled {
                SettingsRow(title: SettingsCopy.lockTimeout, detail: SettingsCopy.lockTimeoutDetail) {
                    Picker(SettingsCopy.lockTimeout, selection: timeout) {
                        ForEach(WorkspaceLockTimeout.allCases, id: \.self) { option in
                            Text(SettingsCopy.lockTimeoutName(option)).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .disabled(isConfirming)
                }
            }
            if model.workspaceLock.isConfirmationFailed {
                ValidationLine(text: WorkspaceLockCopy.confirmationFailed, tone: .issue)
            }
        }
        .todzAnimation(.snap, value: model.workspaceLock.isEnabled)
    }

    private var unavailableReason: String? {
        let isUnavailable = !model.workspaceLock.isEnabled && model.workspaceLock.availability == .passcodeNotSet
        return isUnavailable ? SettingsCopy.lockUnavailable : nil
    }

    private var isOn: Binding<Bool> {
        Binding {
            model.workspaceLock.isEnabled
        } set: { isOn in
            confirming {
                if isOn { await model.turnWorkspaceLockOn() }
                if !isOn { _ = await model.turnWorkspaceLockOff() }
            }
        }
    }

    private var timeout: Binding<WorkspaceLockTimeout> {
        Binding {
            model.workspaceLock.timeout
        } set: { timeout in
            confirming { _ = await model.setWorkspaceLockTimeout(timeout) }
        }
    }

    private func confirming(_ change: @escaping @MainActor () async -> Void) {
        Task {
            isConfirming = true
            await change()
            isConfirming = false
        }
    }
}
