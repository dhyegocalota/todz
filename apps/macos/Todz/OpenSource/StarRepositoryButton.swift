import SwiftUI
import TodzKit

struct StarRepositoryButton: View {
    var body: some View {
        Button(OpenSourceCopy.starOnGitHub) {
            NSWorkspace.shared.open(RepositoryAddress.url)
        }
    }
}
