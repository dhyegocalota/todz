import SwiftUI
import TodzKit

struct MenuBarLoading: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack {
            if let banner = model.banner {
                FailureView(banner: banner)
                    .padding()
            }
            if model.banner == nil {
                MenuBarSkeleton()
            }
        }
        .frame(maxWidth: .infinity)
    }
}
