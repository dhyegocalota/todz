import Foundation

private let keyVariable = "TODZ_API_KEY"
private let serverPath = "mcp"
private let cursorBundleIdentifier = "com.todesktop.230313mzl4w4u92"
private let cursorInstallAddress = "cursor://anysphere.cursor-deeplink/mcp/install?name=\(AgentServer.project.rawValue)&config="
private let linkFailure = "base64 percent-encodes into an install link always"
private let unreservedCharacters = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

private func codexConfiguration(server: String, name: String) -> String {
    """
    [mcp_servers.\(name)]
    url = "\(server)"
    bearer_token_env_var = "\(keyVariable)"
    """
}

private func cursorJSON(server: String, name: String, key: String) -> String {
    """
    {
      "mcpServers": {
        "\(name)": {
          "url": "\(server)",
          "headers": {
            "Authorization": "Bearer \(key)"
          }
        }
      }
    }
    """
}

public enum AgentCommand: Equatable, Sendable {
    case claudeCode(line: String)
    case codex(configuration: String, shellLine: String)
    case cursor(json: String)

    // NB ADR 0034: a secret is todz_ plus base64url, so single quotes hold it without escaping.
    public static func of(client: AgentClient, serverURL: URL, key: String, server: AgentServer = .project) -> AgentCommand {
        let address = serverURL.absoluteString
        switch client {
        case .claudeCode:
            return .claudeCode(line: "claude mcp add --transport http \(server.rawValue) '\(address)' --header 'Authorization: Bearer \(key)'")
        case .codex:
            return .codex(configuration: codexConfiguration(server: address, name: server.rawValue), shellLine: "export \(keyVariable)='\(key)'")
        case .cursor:
            return .cursor(json: cursorJSON(server: address, name: server.rawValue, key: key))
        }
    }

    public static func cursorLink(serverURL: URL, secret: String) -> URL {
        let config = "{\"url\":\"\(serverURL.absoluteString)\",\"headers\":{\"Authorization\":\"Bearer \(secret)\"}}"
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
