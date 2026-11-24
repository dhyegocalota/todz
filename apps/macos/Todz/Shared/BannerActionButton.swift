import SwiftUI
import TodzKit

struct BannerActionButton: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.canTryAgain {
            Button(MainWindowCopy.tryAgain) {
                Task { await model.tryAgain() }
            }
        }
        if !model.canTryAgain {
            Button(MainWindowCopy.dismiss) {
                model.dismissBanner()
            }
        }
    }
}
