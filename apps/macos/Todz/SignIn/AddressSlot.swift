import SwiftUI
import TodzKit

struct AddressSlot: View {
    @Binding var email: String
    let send: (String) async -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.controlActiveState) private var controlActiveState
    @State private var isFormatRefused = false
    @FocusState private var isEmailFocused: Bool

    var body: some View {
        VStack {
            TextField(SignInCopy.emailPlaceholder, text: $email)
                .textFieldStyle(.roundedBorder)
                .textContentType(.emailAddress)
                .autocorrectionDisabled()
                .accessibilityLabel(SignInCopy.emailLabel)
                .focused($isEmailFocused)
                .disabled(model.isRequestingLink)
                .onSubmit(submit)
            if isFormatRefused {
                Text(SignInCopy.emailFormat)
                    .foregroundStyle(.red)
            }
            if model.isRequestingLink {
                ProgressView(SignInCopy.sendingLink)
                    .controlSize(.small)
            }
            if !model.isRequestingLink {
                Button(SignInCopy.sendLink, action: submit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(because: missingEmailReason)
            }
            if let signInError = model.signInError {
                SignInErrorLine(signInError: signInError, tryAgain: submit)
            }
        }
        .task {
            await Task.yield()
            isEmailFocused = true
        }
        .onChange(of: controlActiveState) {
            guard controlActiveState == .key else { return }
            isEmailFocused = true
        }
    }

    private var address: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var missingEmailReason: String? {
        guard address.isEmpty else { return nil }
        return SignInCopy.emailRequired
    }

    private func submit() {
        guard missingEmailReason == nil, !model.isRequestingLink else { return }
        isFormatRefused = !EmailAddressFormat.isValid(address)
        guard !isFormatRefused else {
            isEmailFocused = true
            return
        }
        Task { await send(address) }
    }
}
