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
            FormField(label: SignInCopy.emailLabel, prompt: SignInCopy.emailPlaceholder, text: $email, issue: formatIssue, isLabelShown: false, isBusy: model.isRequestingLink, isFocused: $isEmailFocused)
                .textContentType(.emailAddress)
                .autocorrectionDisabled()
                .onSubmit(submit)
                .onChange(of: email) { isFormatRefused = false }
            ChallengeView()
            FormButton(title: SignInCopy.sendLink, busyTitle: SignInCopy.sendingLink, kind: .primary, isBusy: model.isRequestingLink, disabledReason: sendReason, isFullWidth: true, action: submit)
                .keyboardShortcut(.defaultAction)
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

    private var formatIssue: String? {
        guard isFormatRefused else { return nil }
        return SignInCopy.emailFormat
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
