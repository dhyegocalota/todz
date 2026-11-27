import SwiftUI
import TodzKit

private let noHint = ""

struct FormField: View {
    let label: String
    let prompt: String
    @Binding var text: String
    let issue: String?
    let isLabelShown: Bool
    let isBusy: Bool
    var isFocused: FocusState<Bool>.Binding
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        VStack(alignment: .leading) {
            if isLabelShown {
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
            }
            TextField(label, text: $text, prompt: Text(prompt))
                .textFieldStyle(.plain)
                .labelsHidden()
                .multilineTextAlignment(.leading)
                .focused(isFocused)
                .disabled(isBusy)
                .accessibilityLabel(label)
                .accessibilityHint(hint)
                .modifier(FieldChrome(state: state))
            if let issue {
                ValidationLine(text: issue, tone: .issue)
            }
        }
        .todzMotion(.sheetPresent, value: issue)
    }

    private var state: FieldState {
        FieldState.of(isFocused: isFocused.wrappedValue, hasIssue: issue != nil, isDisabled: !isEnabled, isBusy: isBusy)
    }

    private var hint: String {
        guard let issue else { return noHint }
        return issue
    }
}
