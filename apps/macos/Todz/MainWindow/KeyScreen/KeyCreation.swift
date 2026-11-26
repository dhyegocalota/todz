import SwiftUI
import TodzKit

struct KeyCreation: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading) {
            if let issuedKey = model.issuedKey {
                SecretNotice(hint: issuedKey.key.hint)
            }
            if canCreate {
                FormButton(title: KeyScreenCopy.createKey, busyTitle: KeyScreenCopy.creating, kind: .primary, isBusy: model.isIssuing, disabledReason: model.keyActionDisabledReason) {
                    Task { await model.issueKey() }
                }
                Text(KeyScreenCopy.createKeyNote)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let issueFailure = model.issueFailure {
                ValidationLine(text: KeyScreenCopy.issueFailed, tone: .issue)
                Text(KeyScreenCopy.failureBody(failure: issueFailure))
                    .foregroundStyle(.secondary)
            }
        }
        .onChange(of: model.isIssuing) {
            guard model.isIssuing else { return }
            AccessibilityNotification.Announcement(KeyScreenCopy.creating).post()
        }
    }

    private var canCreate: Bool {
        model.issuedKey == nil
    }
}
