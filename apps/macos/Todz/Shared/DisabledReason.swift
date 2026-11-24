import SwiftUI

private let noReason = ""

struct DisabledReason: ViewModifier {
    let reason: String?

    func body(content: Content) -> some View {
        content
            .disabled(reason != nil)
            .help(shownReason)
            .accessibilityHint(shownReason)
    }

    private var shownReason: String {
        guard let reason else { return noReason }
        return reason
    }
}

extension View {
    func disabled(because reason: String?) -> some View {
        modifier(DisabledReason(reason: reason))
    }
}
