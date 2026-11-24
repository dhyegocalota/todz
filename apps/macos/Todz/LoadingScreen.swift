import SwiftUI
import TodzKit

struct LoadingScreen: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        CenteredColumn {
            if let banner = model.banner {
                FailureView(banner: banner)
            }
            if model.banner == nil {
                ProgressView(MainWindowCopy.loading)
            }
        }
    }
}
