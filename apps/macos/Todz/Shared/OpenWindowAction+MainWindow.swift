import SwiftUI

extension OpenWindowAction {
    func mainWindow() {
        NSApp.activateForAnOpeningWindow()
        callAsFunction(id: MainWindowScene.identifier)
    }
}
