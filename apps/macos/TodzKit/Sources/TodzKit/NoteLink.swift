import Foundation

public enum NoteLink {
    public static func isOpenable(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return OpenableLinkScheme(rawValue: scheme) != nil
    }
}
