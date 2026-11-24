import SwiftUI
import TodzKit

struct KeyCreation: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading) {
            if let issuedKey = model.issuedKey {
                SecretNotice(hint: issuedKey.key.hint)
            }
            if model.isIssuing {
                HStack {
                    ProgressView()
                        .controlSize(.small)
                    Text(KeyScreenCopy.creating)
                }
                .accessibilityElement(children: .combine)
                .onAppear { AccessibilityNotification.Announcement(KeyScreenCopy.creating).post() }
            }
            if canCreate {
                Button(KeyScreenCopy.createKey) {
                    Task { await model.issueKey() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(because: model.keyActionDisabledReason)
                Text(KeyScreenCopy.createKeyNote)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let issueFailure = model.issueFailure {
                KeyScreenFailureLine(text: KeyScreenCopy.issueFailed)
                Text(KeyScreenCopy.failureBody(failure: issueFailure))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var canCreate: Bool {
        model.issuedKey == nil && !model.isIssuing
    }
}
