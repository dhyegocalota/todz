import SwiftUI
import TodzKit

private let sheetWidth: CGFloat = 520

struct OwnerKeySheet: View {
    let issuedKey: IssuedKey
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading) {
            Text(SettingsCopy.ownerKeyCreatedTitle)
                .font(.headline)
            Text(SettingsCopy.ownerKeyCreatedBody)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text(issuedKey.secret)
                .font(.body.monospaced())
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(.fill.quaternary)
                .accessibilityLabel(SettingsCopy.ownerKeyCreatedTitle)
            if let line = claudeCodeLine {
                CommandBlock(
                    name: SettingsCopy.ownerKeyCommand,
                    caption: AttributedString(SettingsCopy.ownerKeyCommandCaption),
                    text: line,
                    holdsSecret: true,
                    disabledReason: nil
                )
            }
            HStack {
                Spacer()
                Button(SettingsCopy.copyOwnerKey) { Pasteboard.copy(text: issuedKey.secret, holdsSecret: true) }
                Button(SettingsCopy.ownerKeyDone) { model.hideOwnerKey() }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding()
        .frame(minWidth: sheetWidth)
        .onAppear { AccessibilityNotification.Announcement(SettingsCopy.ownerKeyCreatedTitle).post() }
    }

    private var claudeCodeLine: String? {
        let serverURL = AgentCommand.serverURL(apiBase: model.serverURL.url)
        guard case let .claudeCode(line) = AgentCommand.of(client: .claudeCode, serverURL: serverURL, key: issuedKey.secret, server: .owner) else { return nil }
        return line
    }
}
