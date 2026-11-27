import Foundation

private let serverPath = "mcp"
private let cursorBundleIdentifier = "com.todesktop.230313mzl4w4u92"
private let cursorInstallAddress = "cursor://anysphere.cursor-deeplink/mcp/install?name=\(AgentServer.project.rawValue)&config="
private let linkFailure = "base64 percent-encodes into an install link always"
private let unreservedCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

private func codexConfiguration(server: String, name: String) -> String {
    """
    [mcp_servers.\(name)]
    url = "\(server)"
    """
}

private func cursorJSON(server: String, name: String) -> String {
    """
    {
      "mcpServers": {
        "\(name)": {
          "url": "\(server)"
        }
      }
    }
    """
}

public enum AgentCommand: Equatable, Sendable {
    case claudeCode(line: String)
    case codex(configuration: String, loginLine: String)
    case cursor(json: String)

    public static func of(client: AgentClient, serverURL: URL) -> AgentCommand {
        let address = serverURL.absoluteString
        let name = AgentServer.project.rawValue
        switch client {
        case .claudeCode:
            return .claudeCode(line: "claude mcp add --transport http \(name) \(address)")
        case .codex:
            return .codex(configuration: codexConfiguration(server: address, name: name), loginLine: "codex mcp login \(name)")
        case .cursor:
            return .cursor(json: cursorJSON(server: address, name: name))
        }
    }

    public static func cursorLink(serverURL: URL) -> URL {
        let config = "{\"url\":\"\(serverURL.absoluteString)\"}"
        let encodedConfig = Data(config.utf8).base64EncodedString().addingPercentEncoding(withAllowedCharacters: unreservedCharacters)
        guard let encodedConfig, let link = URL(string: cursorInstallAddress + encodedConfig) else { preconditionFailure(linkFailure) }
        return link
    }

    public static func serverURL(apiBase: URL) -> URL {
        apiBase.appending(path: serverPath)
    }

    public static func isCursor(bundleIdentifier: String?) -> Bool {
        bundleIdentifier == cursorBundleIdentifier
    }
}
