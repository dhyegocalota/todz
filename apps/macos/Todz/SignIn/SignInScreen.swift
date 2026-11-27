import SwiftUI
import TodzKit

private let columnWidth: CGFloat = 280
private let iconSize: CGFloat = 64

struct SignInScreen: View {
    let notice: SignInNotice?
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var linkSentAt: Date?
    @State private var isServerFormOpen = false
    @AccessibilityFocusState private var isTitleFocused: Bool

    var body: some View {
        CenteredColumn {
            FormPanel(width: columnWidth) {
                Image(nsImage: NSApplication.shared.applicationIconImage)
                    .resizable()
                    .frame(width: iconSize, height: iconSize)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.title)
                    .bold()
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityFocused($isTitleFocused)
                Text(subtitle)
                    .foregroundStyle(.secondary)
                if let pendingLink = awaitedLink {
                    Text(pendingLink.email)
                        .bold()
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .help(pendingLink.email)
                }
                if let noticeLine {
                    Text(noticeLine)
                }
                slot
                if let footnote {
                    Text(footnote)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if isCloudSpotsLineShown {
                    Text(SignInCopy.cloudSpotsLine)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .todzMotion(.stageChange, value: stage)
            ServerDisclosure(isExpanded: $isServerFormOpen)
                .frame(width: columnWidth)
        }
        .multilineTextAlignment(.center)
        .task(id: model.serverURL) {
            if let pendingLink = model.pendingLink { email = pendingLink.email }
            guard model.signInMethod == nil else { return }
            await model.loadSignInMethod()
        }
        .onChange(of: stage) { isTitleFocused = true }
    }

    private var stage: SignInStage {
        SignInStage(model: model)
    }

    private var awaitedLink: PendingSignInLink? {
        guard stage == .awaitingLink else { return nil }
        return model.pendingLink
    }

    private var title: String {
        stage == .awaitingLink ? SignInCopy.inboxTitle : SignInCopy.title
    }

    private var subtitle: String {
        stage == .awaitingLink ? SignInCopy.inboxSubtitle : SignInCopy.subtitle
    }

    private var isCloudSpotsLineShown: Bool {
        stage == .address || stage == .sending
    }

    private var footnote: String? {
        switch stage {
        case .identity: SignInCopy.developmentNotice
        case .address, .sending: SignInCopy.linkPromise
        case .methodLoading, .methodUnavailable, .awaitingLink, .redeeming: nil
        }
    }

    @ViewBuilder private var slot: some View {
        switch stage {
        case .methodLoading:
            ProgressView(SignInCopy.gettingReady)
                .controlSize(.small)
        case .methodUnavailable:
            if let signInMethodError = model.signInMethodError {
                SignInErrorLine(signInError: signInMethodError) { Task { await model.loadSignInMethod() } }
            }
        case .identity:
            CredentialSlot(isServerFormOpen: isServerFormOpen)
        case .address, .sending:
            AddressSlot(email: $email, isServerFormOpen: isServerFormOpen, send: sendLink)
        case .awaitingLink:
            if let pendingLink = model.pendingLink {
                InboxSlot(pendingLink: pendingLink, linkSentAt: linkSentAt, isServerFormOpen: isServerFormOpen, resend: resendCode)
            }
        case .redeeming:
            ProgressView(SignInCopy.signingIn)
                .controlSize(.small)
        }
    }

    private var noticeLine: String? {
        let waitingChangeCount = model.waitingChangeCount
        guard waitingChangeCount > 0 else { return notice?.copy }
        return SignInCopy.sessionEndedWaiting(count: waitingChangeCount)
    }

    private func resendCode() async {
        await model.resendCode()
        linkSentAt = .now
    }

    private func sendLink(to address: String) async {
        await model.requestSignInLink(email: address)
        linkSentAt = .now
    }
}
