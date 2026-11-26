import SwiftUI

private let issueSymbol = "exclamationmark.circle.fill"

enum ValidationTone {
    case issue
    case note
}

struct ValidationLine: View {
    let text: String
    let tone: ValidationTone

    var body: some View {
        line
            .font(.subheadline)
            .fixedSize(horizontal: false, vertical: true)
            .transition(.opacity)
            .onAppear(perform: announce)
            .onChange(of: text, announce)
    }

    @ViewBuilder private var line: some View {
        switch tone {
        case .issue:
            Label(text, systemImage: issueSymbol)
                .foregroundStyle(.red)
        case .note:
            Text(text)
                .foregroundStyle(.secondary)
        }
    }

    private func announce() {
        AccessibilityNotification.Announcement(text).post()
    }
}
