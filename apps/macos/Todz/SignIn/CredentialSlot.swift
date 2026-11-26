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
            FormField(label: SignInCopy.identityPlaceholder, prompt: SignInCopy.identityPlaceholder, text: $identity, issue: formatIssue, isLabelShown: false, isBusy: model.isSigningIn, isFocused: $isIdentityFocused)
                .onSubmit(submit)
                .onChange(of: identity) { isFormatRefused = false }
            FormButton(title: SignInCopy.signIn, busyTitle: SignInCopy.signingIn, kind: .primary, isBusy: model.isSigningIn, disabledReason: missingIdentityReason, isFullWidth: true, action: submit)
                .keyboardShortcut(.defaultAction)
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

    private var formatIssue: String? {
        guard isFormatRefused else { return nil }
        return SignInCopy.identityFormat
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
