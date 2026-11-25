import SwiftUI
import TodzKit

struct AddressSlot: View {
    @Binding var email: String
    let isServerFormOpen: Bool
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
            ChallengeView()
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
                    .disabled(because: sendReason)
            }
            if let signInError = model.signInError {
                SignInErrorLine(signInError: signInError, tryAgain: submit)
            }
        }
        .task {
            await Task.yield()
            focusEmail()
        }
        .onChange(of: model.isRequestingLink) {
            guard !model.isRequestingLink, model.signInError != nil else { return }
            Task {
                await Task.yield()
                focusEmail()
            }
        }
        .onChange(of: controlActiveState) {
            guard controlActiveState == .key else { return }
            focusEmail()
        }
    }

    private func focusEmail() {
        guard !isServerFormOpen else { return }
        isEmailFocused = true
    }

    private var address: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var missingEmailReason: String? {
        guard address.isEmpty else { return nil }
        return SignInCopy.emailRequired
    }

    private var sendReason: String? {
        guard missingEmailReason == nil else { return missingEmailReason }
        return model.missingChallengeReason
    }

    private func submit() {
        guard sendReason == nil, !model.isRequestingLink else { return }
        isFormatRefused = !EmailAddressFormat.isValid(address)
        guard !isFormatRefused else {
            focusEmail()
            return
        }
        Task { await send(address) }
    }
}
