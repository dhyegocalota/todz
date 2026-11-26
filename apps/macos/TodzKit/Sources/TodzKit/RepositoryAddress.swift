import Foundation

public enum RepositoryAddress {
    public static let text = "https://github.com/dhyegocalota/todz"

    public static var url: URL {
        guard let address = URL(string: text) else {
            preconditionFailure("\(text) is not a URL")
        }
        return address
    }
}
