import SwiftUI
import TodzKit

struct InboxSlot: View {
    let pendingLink: PendingSignInLink
    let linkSentAt: Date?
    let send: (String) async -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack {
            if model.isRequestingLink {
                ProgressView(SignInCopy.sendingLink)
                    .controlSize(.small)
            }
            if !model.isRequestingLink {
                sendAgainButton
            }
            Button(SignInCopy.useDifferentEmail, action: model.discardPendingLink)
                .buttonStyle(.plain)
            if let signInError = model.signInError {
                SignInErrorLine(signInError: signInError, tryAgain: sendAgain)
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
                .disabled(because: waitingReason(at: timeline.date))
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

    private func sendAgain() {
        guard !model.isRequestingLink else { return }
        Task { await send(pendingLink.email) }
    }
}
