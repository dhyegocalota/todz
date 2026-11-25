import SwiftUI

extension OpenWindowAction {
    func mainWindow() {
        NSApp.activateAsRegularApp()
        callAsFunction(id: MainWindowScene.identifier)
    }
}
