import SwiftUI
import TodzKit

struct ClientCommands: View {
    let serverURL: URL
    let secret: String?
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        @Bindable var windowState = windowState
        VStack(alignment: .leading) {
            Picker(selection: $windowState.agentClient) {
                ForEach(AgentClient.allCases, id: \.self) { client in
                    Text(KeyScreenCopy.clientName(client: client))
                        .tag(client)
                }
            } label: {
                EmptyView()
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            blocks
        }
    }

    @ViewBuilder private var blocks: some View {
        switch AgentCommand.of(client: windowState.agentClient, serverURL: serverURL, key: shownKey) {
        case let .claudeCode(line):
            secretBlock(name: KeyScreenCopy.claudeCodeCommand, caption: KeyScreenCopy.claudeCodeCaption, text: line)
        case let .codex(configuration, shellLine):
            CommandBlock(
                name: KeyScreenCopy.codexConfiguration,
                caption: KeyScreenCopy.codexConfigCaption,
                text: configuration,
                holdsSecret: false,
                disabledReason: disabledReason
            )
            secretBlock(name: KeyScreenCopy.codexShellLine, caption: KeyScreenCopy.codexShellCaption, text: shellLine)
        case let .cursor(json):
            AddToCursorButton(serverURL: serverURL, secret: secret, disabledReason: disabledReason)
            secretBlock(name: KeyScreenCopy.cursorJSON, caption: KeyScreenCopy.cursorCaption, text: json)
        }
    }

    private var shownKey: String {
        guard let secret else { return KeyScreenCopy.secretPlaceholder }
        return secret
    }

    private var disabledReason: String? {
        guard secret == nil else { return nil }
        return KeyScreenCopy.createKeyFirst
    }

    private func secretBlock(name: String, caption: AttributedString, text: String) -> CommandBlock {
        CommandBlock(name: name, caption: caption, text: text, holdsSecret: secret != nil, disabledReason: disabledReason)
    }
}
