import AppKit

private let returnKey = "\r"

@MainActor public enum TaskDeletionAlert {
    public struct Wording: Sendable {
        public let title: String
        public let message: String
        public let delete: String
        public let cancel: String

        public init(title: String, message: String, delete: String, cancel: String) {
            self.title = title
            self.message = message
            self.delete = delete
            self.cancel = cancel
        }
    }

    public static func make(_ wording: Wording) -> NSAlert {
        let alert = NSAlert()
        alert.messageText = wording.title
        alert.informativeText = wording.message
        let cancel = alert.addButton(withTitle: wording.cancel)
        cancel.keyEquivalent = returnKey
        let delete = alert.addButton(withTitle: wording.delete)
        delete.keyEquivalent = ""
        delete.hasDestructiveAction = true
        return alert
    }

    public static func isDeletion(_ response: NSApplication.ModalResponse) -> Bool {
        response == .alertSecondButtonReturn
    }
}
