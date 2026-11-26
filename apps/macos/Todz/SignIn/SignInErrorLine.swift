import SwiftUI
import TodzKit

struct SignInErrorLine: View {
    let signInError: SignInError
    let tryAgain: () -> Void

    var body: some View {
        VStack {
            ValidationLine(text: signInError.copy, tone: .issue)
            if signInError.canTryAgain {
                FormButton(title: MainWindowCopy.tryAgain, busyTitle: nil, kind: .secondary, isBusy: false, disabledReason: nil, action: tryAgain)
            }
        }
        .accessibilityElement(children: .contain)
    }
}
