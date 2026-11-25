import SwiftUI

struct DownloadButton: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button(VersionCopy.download, action: download)
            .accessibilityLabel(VersionCopy.downloadLabel)
    }

    private func download() {
        guard let address = URL(string: VersionCopy.downloadAddress) else { return }
        openURL(address)
    }
}
