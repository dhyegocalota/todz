import SwiftUI
import TodzKit

struct ClientCommands: View {
    let serverURL: URL
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
        switch AgentCommand.of(client: windowState.agentClient, serverURL: serverURL) {
        case let .claudeCode(line):
            CommandBlock(name: KeyScreenCopy.claudeCodeCommand, caption: KeyScreenCopy.claudeCodeCaption, text: line)
        case let .codex(configuration, loginLine):
            CommandBlock(name: KeyScreenCopy.codexConfiguration, caption: KeyScreenCopy.codexConfigCaption, text: configuration)
            CommandBlock(name: KeyScreenCopy.codexLoginLine, caption: KeyScreenCopy.codexLoginCaption, text: loginLine)
        case let .cursor(json):
            AddToCursorButton(serverURL: serverURL)
            CommandBlock(name: KeyScreenCopy.cursorJSON, caption: KeyScreenCopy.cursorCaption, text: json)
        }
    }
}
