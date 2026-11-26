import SwiftUI
import TodzKit

struct OpenSourceLink: View {
    var body: some View {
        Button(OpenSourceCopy.openSource) {
            NSWorkspace.shared.open(RepositoryAddress.url)
        }
        .buttonStyle(.link)
        .font(.footnote)
    }
}
