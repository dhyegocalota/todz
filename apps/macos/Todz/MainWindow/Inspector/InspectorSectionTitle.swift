import SwiftUI

struct InspectorSectionTitle: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.callout)
            .foregroundStyle(.secondary)
            .accessibilityAddTraits(.isHeader)
    }
}
