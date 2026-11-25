import SwiftUI
import TodzKit

struct InboxSlot: View {
    let pendingLink: PendingSignInLink
    let linkSentAt: Date?
    let send: (String) async -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack {
            ChallengeView()
            if model.isRequestingLink {
                ProgressView(SignInCopy.sendingLink)
                    .controlSize(.small)
            }
            if !model.isRequestingLink {
                sendAgainButton
            }
            Button(SignInCopy.useDifferentEmail, action: model.useDifferentEmail)
                .buttonStyle(.plain)
            if let signInError = model.signInError {
                SignInErrorLine(signInError: signInError, tryAgain: tryAgain)
            }
            Text(SignInCopy.linkLifetime)
                .font(.footnote)
                .foregroundStyle(.secondary)
            cooldownLine
        }
    }

    private var sendAgainButton: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            Button(SignInCopy.sendAgain, action: sendAgain)
                .keyboardShortcut(.defaultAction)
                .disabled(because: sendAgainReason(at: timeline.date))
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
        guard let linkSentAt else { return nil }
        let remaining = linkSentAt.addingTimeInterval(SignInLinkTiming.cooldown).timeIntervalSince(date)
        guard remaining > 0 else { return nil }
        return SignInCopy.sendAgainWaiting(seconds: Int(remaining.rounded(.up)))
    }

    private func sendAgainReason(at date: Date) -> String? {
        guard let waitingReason = waitingReason(at: date) else { return model.missingChallengeReason }
        return waitingReason
    }

    private func tryAgain() {
        guard model.canRedeemAgain else {
            sendAgain()
            return
        }
        Task { await model.redeemHeldSignInLink() }
    }

    private func sendAgain() {
        guard !model.isRequestingLink, model.missingChallengeReason == nil else { return }
        Task { await send(pendingLink.email) }
    }
}
