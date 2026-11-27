import SwiftUI

struct CommandBlock: View {
    let name: String
    let caption: AttributedString?
    let text: String

    var body: some View {
        VStack(alignment: .leading) {
            HStack(alignment: .firstTextBaseline) {
                if let caption {
                    Text(caption)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                CopyButton(text: text, item: name)
            }
            Text(text)
                .font(.body.monospaced())
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: FormMetrics.fieldCornerRadius, style: .continuous))
                .accessibilityLabel(name)
                .accessibilityValue(text)
        }
    }
}
