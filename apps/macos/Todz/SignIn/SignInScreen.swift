import SwiftUI
import TodzKit

private let columnWidth: CGFloat = 280
private let iconSize: CGFloat = 64

struct SignInScreen: View {
    let notice: SignInNotice?

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
            if let notice {
                Text(notice.copy)
            }
            CredentialSlot()
            Text(SignInCopy.developmentNotice)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
    }
}
