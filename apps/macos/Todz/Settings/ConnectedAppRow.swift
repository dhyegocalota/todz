import SwiftUI
import TodzKit

struct ConnectedAppRow: View {
    let app: ConnectedApp
    @Environment(AppModel.self) private var model
    @State private var isConfirmingDisconnect = false

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                VStack(alignment: .leading) {
                    Text(app.clientName)
                    Text(summary)
                        .settingsDetail()
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(app.clientName)
                .accessibilityValue(accessibilityValue)
                Spacer()
                limitMenu
                FormButton(title: SettingsCopy.disconnectConnectedApp, busyTitle: nil, kind: .secondary, isBusy: model.isChangingConnectedApps, disabledReason: nil) {
                    isConfirmingDisconnect = true
                }
                .accessibilityLabel(SettingsCopy.disconnectConnectedAppTitle(clientName: app.clientName))
            }
            ForEach(Array(app.scopes.enumerated()), id: \.offset) { _, scope in
                scopeLine(scope)
            }
        }
        .confirmationDialog(SettingsCopy.disconnectConnectedAppTitle(clientName: app.clientName), isPresented: $isConfirmingDisconnect, titleVisibility: .visible) {
            Button(SettingsCopy.disconnectConnectedApp, role: .destructive) {
                Task { await model.disconnectConnectedApp(app) }
            }
            Button(SheetCopy.cancel, role: .cancel) {}
                .keyboardShortcut(.defaultAction)
        } message: {
            Text(SettingsCopy.disconnectConnectedAppMessage)
        }
    }

    private func scopeLine(_ scope: ConnectedScope) -> some View {
        HStack {
            Text(SettingsCopy.connectedAppScope(scope))
                .settingsDetail()
            Spacer()
            if canRemove {
                Button(SettingsCopy.removeScope) { narrow(to: app.scopes.filter { $0 != scope }) }
                    .buttonStyle(.link)
                    .accessibilityLabel(SettingsCopy.removeScopeLabel(scope: SettingsCopy.connectedAppScope(scope), clientName: app.clientName))
            }
        }
    }

    @ViewBuilder private var limitMenu: some View {
        if canLimit {
            Menu(SettingsCopy.limitConnectedApp) {
                ForEach(Array(limitTargets.enumerated()), id: \.offset) { _, target in
                    Button(target.title) { narrow(to: [target.scope]) }
                }
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .accessibilityLabel(SettingsCopy.limitLabel(clientName: app.clientName))
        }
    }

    private var isEditable: Bool {
        model.canNarrowConnectedApps && !model.isChangingConnectedApps
    }

    private var canRemove: Bool {
        isEditable && app.scopes.count > 1
    }

    private var canLimit: Bool {
        isEditable && app.scopes.count == 1 && !limitTargets.isEmpty
    }

    private var limitTargets: [(title: String, scope: ConnectedScope)] {
        guard app.scopes.count == 1, let only = app.scopes.first else { return [] }
        switch only {
        case .account:
            return model.workspaces.map { (title: $0.name, scope: .workspace(identifier: $0.identifier, name: $0.name)) }
        case let .workspace(identifier, name):
            let projects = model.workspaces.first { $0.identifier == identifier }?.projects ?? []
            return projects.map { (title: $0.name, scope: .project(identifier: $0.identifier, name: $0.name, workspaceIdentifier: identifier, workspaceName: name)) }
        case .project:
            return []
        }
    }

    private func narrow(to scopes: [ConnectedScope]) {
        Task { await model.narrowConnectedApp(app, to: scopes) }
    }

    private var summary: String {
        SettingsCopy.connectedAppSummary(redirectHost: app.redirectHost, lastUsed: lastUsed)
    }

    private var accessibilityValue: String {
        ([summary] + app.scopes.map(SettingsCopy.connectedAppScope)).joined(separator: ", ")
    }

    private var lastUsed: String {
        DayFormat.moment(instant: app.lastUsedAt, timeZone: model.timeZone)
    }
}
