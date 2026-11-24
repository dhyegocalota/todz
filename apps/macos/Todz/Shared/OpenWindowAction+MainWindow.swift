import SwiftUI

extension OpenWindowAction {
    func mainWindow() {
        callAsFunction(id: MainWindowScene.identifier)
        NSApp.activate()
    }
}
