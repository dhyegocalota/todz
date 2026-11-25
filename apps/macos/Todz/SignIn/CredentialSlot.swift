import SwiftUI
import TodzKit

private let noIdentity = ""

struct CredentialSlot: View {
    let isServerFormOpen: Bool
    @Environment(AppModel.self) private var model
    @Environment(\.controlActiveState) private var controlActiveState
    @State private var identity = noIdentity
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
            await Task.yield()
            focusIdentity()
            guard let lastIdentity = model.lastIdentity else { return }
            identity = lastIdentity
        }
        .onChange(of: controlActiveState) {
            guard controlActiveState == .key else { return }
            focusIdentity()
        }
    }

    private func focusIdentity() {
        guard !isServerFormOpen else { return }
        isIdentityFocused = true
    }

    private var missingIdentityReason: String? {
        guard identity.isEmpty else { return nil }
        return SignInCopy.identityRequired
    }

    private func submit() {
        guard missingIdentityReason == nil, !model.isSigningIn else { return }
        isFormatRefused = !IdentityFormat.isValid(identity)
        guard !isFormatRefused else {
            focusIdentity()
            return
        }
        Task { await model.signIn(identity: identity) }
    }
}
