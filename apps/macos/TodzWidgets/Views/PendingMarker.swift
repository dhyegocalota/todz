import SwiftUI

private let pendingSymbol = "circle.dashed"

struct PendingMarker: View {
    var body: some View {
        Image(systemName: pendingSymbol)
            .foregroundStyle(.secondary)
    }
}
