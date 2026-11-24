import SwiftUI
import TodzKit

struct AppCommands: Commands {
    let model: AppModel
    let windowState: MainWindowState

    var body: some Commands {
        CommandGroup(after: .appInfo) {
            Divider()
            Button(MainWindowCopy.signOut) {
                Task { await model.signOut() }
            }
            .disabled(!model.isSignedIn)
        }
    }
}
