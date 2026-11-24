import SwiftUI
import TodzKit

private let columnWidth: CGFloat = 280
private let iconSize: CGFloat = 64

struct SignInScreen: View {
    let notice: SignInNotice?
    @Environment(AppModel.self) private var model

    var body: some View {
        CenteredColumn(width: columnWidth) {
            Image(nsImage: NSApplication.shared.applicationIconImage)
                .resizable()
                .frame(width: iconSize, height: iconSize)
                .accessibilityHidden(true)
            Text(SignInCopy.title)
                .font(.title)
                .bold()
            Text(SignInCopy.subtitle)
                .foregroundStyle(.secondary)
            if let noticeLine {
                Text(noticeLine)
            }
            CredentialSlot()
            Text(SignInCopy.developmentNotice)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
    }

    private var noticeLine: String? {
        let waitingChangeCount = model.waitingChangeCount
        guard waitingChangeCount > 0 else { return notice?.copy }
        return SignInCopy.sessionEndedWaiting(count: waitingChangeCount)
    }
}
