import AppKit

private let concealedType = NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType")
private let transientType = NSPasteboard.PasteboardType("org.nspasteboard.TransientType")

enum Pasteboard {
    static func copy(text: String, holdsSecret: Bool) {
        let pasteboard = NSPasteboard.general
        guard holdsSecret else {
            pasteboard.clearContents()
            pasteboard.setString(text, forType: .string)
            return
        }
        pasteboard.prepareForNewContents(with: .currentHostOnly)
        let item = NSPasteboardItem()
        item.setString(text, forType: .string)
        item.setData(Data(), forType: concealedType)
        item.setData(Data(), forType: transientType)
        pasteboard.writeObjects([item])
    }
}
