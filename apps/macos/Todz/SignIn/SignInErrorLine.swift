import SwiftUI
import TodzKit

struct SignInErrorLine: View {
    let signInError: SignInError
    let tryAgain: () -> Void

    var body: some View {
        VStack {
            Text(signInError.copy)
                .foregroundStyle(.red)
            if signInError.canTryAgain {
                Button(MainWindowCopy.tryAgain, action: tryAgain)
            }
        }
        .accessibilityElement(children: .contain)
    }
}
