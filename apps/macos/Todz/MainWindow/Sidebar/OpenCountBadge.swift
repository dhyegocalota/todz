import SwiftUI

struct OpenCountBadge: ViewModifier {
    let count: Int?

    func body(content: Content) -> some View {
        if let count {
            content
                .badge(count)
                .accessibilityValue(AccessibilityCopy.openCount(count: count))
        }
        if count == nil {
            content
        }
    }
}

extension View {
    func openCountBadge(_ count: Int?) -> some View {
        modifier(OpenCountBadge(count: count))
    }
}
