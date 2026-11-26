import SwiftUI
import TodzKit

struct OwnerKeyRow: View {
    let key: ProjectKey
    @Environment(AppModel.self) private var model
    @State private var isConfirmingRevoke = false

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(SettingsCopy.ownerKeyMasked(hint: key.hint))
                    .font(.body.monospaced())
                Text(createdLine)
                    .settingsDetail()
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(SettingsCopy.ownerKeyEnding(hint: key.hint), marking: key.hint) { $0.speechSpellsOutCharacters() })
            .accessibilityValue(createdLine)
            Spacer()
            Button(SettingsCopy.revokeOwnerKey) { isConfirmingRevoke = true }
                .disabled(model.isChangingOwnerKeys)
                .disabled(because: model.keyActionDisabledReason)
                .accessibilityLabel(KeyScreenCopy.revokeKeyLabel(hint: key.hint))
        }
        .confirmationDialog(SettingsCopy.revokeOwnerKeyTitle, isPresented: $isConfirmingRevoke, titleVisibility: .visible) {
            Button(SettingsCopy.revokeOwnerKey, role: .destructive) {
                Task { await model.revokeOwnerKey(key) }
            }
            Button(SheetCopy.cancel, role: .cancel) {}
                .keyboardShortcut(.defaultAction)
        } message: {
            Text(SettingsCopy.revokeOwnerKeyMessage)
        }
    }

    private var createdLine: String {
        KeyScreenCopy.created(time: DayFormat.moment(instant: key.createdAt, timeZone: model.timeZone))
    }
}
