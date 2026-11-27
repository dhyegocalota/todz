import SwiftUI
import TodzKit

struct InboxSlot: View {
    let pendingLink: PendingSignInLink
    let linkSentAt: Date?
    let isServerFormOpen: Bool
    let resend: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var entry = CodeEntry()
    @State private var heldCode: String?

    var body: some View {
        VStack {
            Text(SignInCopy.codeHint)
                .font(.footnote)
                .foregroundStyle(.secondary)
            CodeField(entry: $entry, failureCount: model.codeFailureCount, isBusy: model.isSubmittingCode, isAutofocused: !isServerFormOpen, onComplete: submit)
            ChallengeView()
            resendButton
            FormButton(title: SignInCopy.useDifferentEmail, busyTitle: nil, kind: .quiet, isBusy: false, disabledReason: nil, action: model.useDifferentEmail)
            if let signInError = model.signInError {
                SignInErrorLine(signInError: signInError, tryAgain: tryAgain)
            }
            Text(SignInCopy.linkLifetime)
                .font(.footnote)
                .foregroundStyle(.secondary)
            cooldownLine
        }
        .onChange(of: model.missingChallengeReason) { sendHeldCode() }
    }

    private var resendButton: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            FormButton(title: SignInCopy.resendCode, busyTitle: SignInCopy.sendingLink, kind: .secondary, isBusy: model.isRequestingLink, disabledReason: resendReason(at: timeline.date), action: resendAgain)
        }
    }

    private var cooldownLine: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            if let waitingReason = waitingReason(at: timeline.date) {
                Text(waitingReason)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }
    }

    private func waitingReason(at date: Date) -> String? {
        guard let linkSentAt, let seconds = CodeResend.remainingSeconds(sentAt: linkSentAt, now: date) else { return nil }
        return SignInCopy.sendAgainWaiting(seconds: seconds)
    }

    private func resendReason(at date: Date) -> String? {
        guard let waitingReason = waitingReason(at: date) else { return model.missingChallengeReason }
        return waitingReason
    }

    private func submit(_ code: String) {
        guard model.missingChallengeReason == nil else {
            heldCode = code
            return
        }
        Task { await model.signIn(code: code) }
    }

    private func sendHeldCode() {
        guard let heldCode, model.missingChallengeReason == nil else { return }
        self.heldCode = nil
        submit(heldCode)
    }

    private func tryAgain() {
        guard model.canRedeemAgain else {
            resendAgain()
            return
        }
        Task { await model.redeemHeldSignInLink() }
    }

    private func resendAgain() {
        guard !model.isRequestingLink, model.missingChallengeReason == nil else { return }
        Task { await resend() }
    }
}
