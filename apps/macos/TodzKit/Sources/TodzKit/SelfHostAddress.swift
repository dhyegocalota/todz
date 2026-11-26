import Foundation

public enum SelfHostAddress {
    public static let text = "https://docs.todz.app/self-host"

    public static var url: URL {
        guard let address = URL(string: text) else {
            preconditionFailure("\(text) is not a URL")
        }
        return address
    }
}
