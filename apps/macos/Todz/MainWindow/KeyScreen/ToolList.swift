import SwiftUI
import TodzKit

struct ToolList: View {
    var body: some View {
        Grid(alignment: .leadingFirstTextBaseline) {
            ForEach(AgentTool.allCases, id: \.self) { tool in
                GridRow {
                    Text(tool.rawValue)
                        .font(.body.monospaced())
                        .accessibilityLabel(tool.rawValue)
                        .accessibilityValue(KeyScreenCopy.toolLine(tool: tool))
                    Text(KeyScreenCopy.toolLine(tool: tool))
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
            }
        }
    }
}
