import SwiftUI

struct CommandBlock: View {
    let name: String
    let caption: AttributedString?
    let text: String
    let holdsSecret: Bool
    let disabledReason: String?

    var body: some View {
        VStack(alignment: .leading) {
            HStack(alignment: .firstTextBaseline) {
                if let caption {
                    Text(caption)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                CopyButton(text: text, item: name, holdsSecret: holdsSecret, disabledReason: disabledReason)
            }
            if isSelectable {
                commandText
                    .textSelection(.enabled)
            }
            if !isSelectable {
                commandText
            }
        }
    }

    private var isSelectable: Bool {
        disabledReason == nil && !holdsSecret
    }

    private var commandText: some View {
        Text(text, marking: KeyScreenCopy.secretPlaceholder) { $0.foregroundStyle(.secondary) }
            .font(.body.monospaced())
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(.fill.quaternary)
            .accessibilityLabel(name)
            .accessibilityValue(text)
    }
}
