import Foundation

public enum DocumentationAddress {
    public static let connectAnAgentText = "https://docs.todz.app/connect-an-agent"

    public static var connectAnAgent: URL {
        guard let address = URL(string: connectAnAgentText) else {
            preconditionFailure("\(connectAnAgentText) is not a URL")
        }
        return address
    }
}
