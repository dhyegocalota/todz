import SwiftUI
import TodzKit

struct MainWindow: View {
    var body: some View {
        CenteredColumn {
            ProgressView(MainWindowCopy.loading)
        }
    }
}
