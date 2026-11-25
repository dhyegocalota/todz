import SwiftUI
import TodzKit

struct BannerActionButton: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let isUpdateNeededBanner = model.banner == .updateNeeded
        if isUpdateNeededBanner {
            DownloadButton()
        }
        if model.canTryAgain {
            Button(MainWindowCopy.tryAgain) {
                Task { await model.tryAgain() }
            }
        }
        if !model.canTryAgain && !isUpdateNeededBanner {
            Button(MainWindowCopy.dismiss) {
                model.dismissBanner()
            }
        }
    }
}
