import Foundation

public enum AgentCommand: Equatable, Sendable {
    case claudeCode(line: String)
    case codex(configuration: String, shellLine: String)
    case cursor(json: String)

    public static func of(client: AgentClient, serverURL: URL, key: String) -> AgentCommand {
        fatalError("AgentCommand.of is not implemented")
    }

    public static func cursorLink(serverURL: URL, secret: String) -> URL? {
        fatalError("AgentCommand.cursorLink is not implemented")
    }

    public static func serverURL(apiBase: URL) -> URL {
        fatalError("AgentCommand.serverURL is not implemented")
    }
}
