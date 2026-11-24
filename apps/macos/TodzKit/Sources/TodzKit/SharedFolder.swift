import Foundation

public enum SharedFolder {
    public static func of(info: [String: Any], home: URL) -> URL? {
        fatalError("SharedFolder.of is not implemented")
    }

    public static var accountHome: URL? {
        fatalError("SharedFolder.accountHome is not implemented")
    }

    public static func created(_ folder: URL) -> URL? {
        fatalError("SharedFolder.created is not implemented")
    }
}
