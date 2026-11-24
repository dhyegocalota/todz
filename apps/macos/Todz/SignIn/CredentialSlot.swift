import SwiftUI
import TodzKit

struct CredentialSlot: View {
    @Environment(AppModel.self) private var model
    @State private var identity = ""
    @State private var isFormatRefused = false
    @FocusState private var isIdentityFocused: Bool

    var body: some View {
        VStack {
            TextField(SignInCopy.identityPlaceholder, text: $identity)
                .textFieldStyle(.roundedBorder)
                .focused($isIdentityFocused)
                .disabled(model.isSigningIn)
                .onSubmit(submit)
            if isFormatRefused {
                Text(SignInCopy.identityFormat)
                    .foregroundStyle(.red)
            }
            if model.isSigningIn {
                ProgressView(SignInCopy.signingIn)
                    .controlSize(.small)
            }
            if !model.isSigningIn {
                Button(SignInCopy.signIn, action: submit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(because: missingIdentityReason)
            }
            if let signInError = model.signInError {
                SignInErrorLine(signInError: signInError, tryAgain: submit)
            }
        }
        .task {
            isIdentityFocused = true
            guard let lastIdentity = model.lastIdentity else { return }
            identity = lastIdentity
        }
    }

    private var missingIdentityReason: String? {
        guard identity.isEmpty else { return nil }
        return SignInCopy.identityRequired
    }

    private func submit() {
        guard missingIdentityReason == nil, !model.isSigningIn else { return }
        isFormatRefused = !IdentityFormat.isValid(identity)
        guard !isFormatRefused else {
            isIdentityFocused = true
            return
        }
        Task { await model.signIn(identity: identity) }
    }
}
