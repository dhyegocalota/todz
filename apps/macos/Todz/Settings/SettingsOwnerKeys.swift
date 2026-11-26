import SwiftUI
import TodzKit

struct SettingsOwnerKeys: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.isReady {
            Section {
                Text(SettingsCopy.ownerKeysDetail)
                    .settingsDetail()
                list
                creation
            } header: {
                Text(SettingsCopy.ownerKeys)
            }
            .task { await model.loadOwnerKeys() }
            .onDisappear { model.forgetOwnerKeys() }
            .sheet(isPresented: isShowingIssuedKey) {
                if let issuedKey = model.issuedOwnerKey {
                    OwnerKeySheet(issuedKey: issuedKey)
                }
            }
        }
    }

    @ViewBuilder private var list: some View {
        switch model.ownerKeys {
        case .none, .loading:
            ProgressView()
                .controlSize(.small)
        case .failed:
            Text(KeyScreenCopy.listFailed)
                .foregroundStyle(.red)
            Button(MainWindowCopy.tryAgain) { Task { await model.loadOwnerKeys() } }
        case let .loaded(keys):
            if keys.isEmpty {
                Text(SettingsCopy.noOwnerKeys)
                    .foregroundStyle(.secondary)
            }
            ForEach(keys.sorted { $0.createdAt > $1.createdAt }) { key in
                OwnerKeyRow(key: key)
            }
        }
    }

    private var creation: some View {
        VStack(alignment: .leading) {
            Button(SettingsCopy.createOwnerKey) { Task { await model.issueOwnerKey() } }
                .disabled(!canCreate)
                .disabled(because: model.keyActionDisabledReason)
            if let failure = model.ownerKeyFailure {
                ValidationLine(text: SettingsCopy.ownerKeyFailure(failure), tone: .issue)
            }
            if isAtLimit {
                Text(SettingsCopy.ownerKeysAtLimit)
                    .settingsDetail()
            }
        }
    }

    private var isAtLimit: Bool {
        guard case let .loaded(keys) = model.ownerKeys else { return false }
        return keys.count >= OwnerKeyLimit.liveKeysMax
    }

    private var canCreate: Bool {
        guard case .loaded = model.ownerKeys else { return false }
        return !isAtLimit && !model.isChangingOwnerKeys
    }

    private var isShowingIssuedKey: Binding<Bool> {
        Binding {
            model.issuedOwnerKey != nil
        } set: { isShowing in
            guard !isShowing else { return }
            model.hideOwnerKey()
        }
    }
}
