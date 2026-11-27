import SwiftUI

private let agentSymbol = "sparkle"

struct MenuBarAgentMark: View {
    let agentName: String

    var body: some View {
        HStack {
            Image(systemName: agentSymbol)
            Text(agentName)
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .accessibilityHidden(true)
    }
}
