import SwiftUI
import TodzKit

private let boxSpacing: CGFloat = 10
private let boxWidth: CGFloat = 40
private let boxHeight: CGFloat = 48
private let invalidHold: Duration = .milliseconds(1200)

struct CodeField: View {
    @Binding var entry: CodeEntry
    let failureCount: Int
    let isBusy: Bool
    let isAutofocused: Bool
    let onComplete: (String) -> Void
    @FocusState private var isFocused: Bool
    @State private var isInvalid = false

    var body: some View {
        ZStack {
            TextField(SignInCopy.codeLabel, text: text)
                .textFieldStyle(.plain)
                .textContentType(.oneTimeCode)
                .focused($isFocused)
                .opacity(0.01)
                .disabled(isBusy)
                .accessibilityLabel(SignInCopy.codeLabel)
                .accessibilityValue(entry.text)
                .accessibilityHint(SignInCopy.codeHint)
            boxes
                .environment(\.layoutDirection, .leftToRight)
                .accessibilityHidden(true)
                .allowsHitTesting(false)
        }
        .fixedSize()
        .contentShape(Rectangle())
        .onTapGesture { isFocused = true }
        .todzShake(trigger: failureCount)
        .onAppear { isFocused = isAutofocused }
        .onChange(of: failureCount) { _, _ in fail() }
    }

    private var boxes: some View {
        HStack(spacing: boxSpacing) {
            ForEach(0..<CodeEntry.length, id: \.self) { index in
                Text(entry.digit(at: index).map(String.init) ?? "")
                    .font(.title2.monospacedDigit())
                    .frame(width: boxWidth, height: boxHeight)
                    .modifier(FieldChrome(state: state(of: index)))
            }
        }
    }

    private var text: Binding<String> {
        Binding {
            entry.text
        } set: { newText in
            isInvalid = false
            guard let code = entry.edit(to: newText) else { return }
            onComplete(code)
        }
    }

    private func state(of index: Int) -> FieldState {
        FieldState.of(isFocused: isFocused && index == entry.focusedIndex, hasIssue: isInvalid, isDisabled: false, isBusy: isBusy)
    }

    private func fail() {
        isInvalid = true
        entry = CodeEntry()
        isFocused = isAutofocused
        Task {
            try? await Task.sleep(for: invalidHold)
            isInvalid = false
        }
    }
}
