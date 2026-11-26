import SwiftUI
import TodzKit

private let noticeSymbol = "key.fill"

struct SecretNotice: View {
    let hint: String
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack {
            Image(systemName: noticeSymbol)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            VStack(alignment: .leading) {
                Text(KeyScreenCopy.secretTitle)
                    .font(.headline)
                Text(KeyScreenCopy.secretBody(hint: hint))
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            Spacer()
            Button(KeyScreenCopy.hideKey) { model.hideKey() }
                .buttonStyle(.bordered)
                .accessibilityHint(KeyScreenCopy.hideKeyHint)
        }
        .padding()
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: FormMetrics.fieldCornerRadius, style: .continuous))
        .onAppear { AccessibilityNotification.Announcement(KeyScreenCopy.secretTitle).post() }
    }
}
