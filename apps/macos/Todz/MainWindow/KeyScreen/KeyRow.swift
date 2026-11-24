import SwiftUI
import TodzKit

struct KeyRow: View {
    let key: ProjectKey
    let projectName: String
    @Environment(AppModel.self) private var model
    @State private var isConfirmingRevoke = false

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                VStack(alignment: .leading) {
                    Text(KeyScreenCopy.maskedKey(hint: key.hint))
                        .font(.body.monospaced())
                    Text(createdLine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(KeyScreenCopy.keyEnding(hint: key.hint), marking: key.hint) { $0.speechSpellsOutCharacters() })
                .accessibilityValue(createdLine)
                if model.failedRevokeIdentifiers.contains(key.identifier) {
                    KeyScreenFailureLine(text: KeyScreenCopy.revokeFailed)
                }
            }
            Spacer()
            if isRevoking {
                ProgressView()
                    .controlSize(.small)
                    .accessibilityLabel(KeyScreenCopy.revoking)
            }
            if !isRevoking {
                Button(KeyScreenCopy.revoke) { isConfirmingRevoke = true }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(because: model.keyActionDisabledReason)
                    .accessibilityLabel(KeyScreenCopy.revokeKeyLabel(hint: key.hint))
            }
        }
        .confirmationDialog(
            KeyScreenCopy.revokeTitle(hint: key.hint),
            isPresented: $isConfirmingRevoke,
            titleVisibility: .visible
        ) {
            Button(KeyScreenCopy.revokeKey, role: .destructive) {
                Task { await model.revokeKey(key) }
            }
            Button(SheetCopy.cancel, role: .cancel) {}
                .keyboardShortcut(.defaultAction)
        } message: {
            Text(KeyScreenCopy.revokeMessage(project: projectName))
        }
    }

    private var isRevoking: Bool {
        model.revokingKeyIdentifiers.contains(key.identifier)
    }

    private var createdLine: String {
        KeyScreenCopy.created(time: DayFormat.moment(instant: key.createdAt, timeZone: model.timeZone))
    }
}
