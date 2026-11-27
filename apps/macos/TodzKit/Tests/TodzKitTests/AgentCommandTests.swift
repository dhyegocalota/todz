import Foundation
import Testing
@testable import TodzKit

private let serverText = "http://localhost:8787/mcp"
private let configParameter = "config"
private let cursorLink = "cursor://anysphere.cursor-deeplink/mcp/install?name=todz&config=eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg3ODcvbWNwIn0%3D"

private func cursorJSON() -> String {
    """
    {
      "mcpServers": {
        "todz": {
          "url": "\(serverText)"
        }
      }
    }
    """
}

private func codexConfiguration() -> String {
    """
    [mcp_servers.todz]
    url = "\(serverText)"
    """
}

private func serverURL() throws -> URL {
    try #require(URL(string: serverText))
}

@Suite struct AgentCommandTests {
    @Test func theToolsAreTheFiveTheServerRegistersInOrder() {
        #expect(AgentTool.allCases.map(\.rawValue) == ["next", "add", "list", "update", "done"])
    }

    @Test func theClientsAreClaudeCodeCodexAndCursor() {
        #expect(AgentClient.allCases == [.claudeCode, .codex, .cursor])
    }

    @Test func claudeCodeIsOneLineWithNoKey() throws {
        let command = AgentCommand.of(client: .claudeCode, serverURL: try serverURL())
        #expect(command == .claudeCode(line: "claude mcp add --transport http todz \(serverText)"))
    }

    @Test func codexIsAConfigurationTableAndALoginLine() throws {
        let command = AgentCommand.of(client: .codex, serverURL: try serverURL())
        #expect(command == .codex(configuration: codexConfiguration(), loginLine: "codex mcp login todz"))
    }

    @Test func cursorIsTheMCPJSONOfTheServerAloneIndentedByTwoSpaces() throws {
        let command = AgentCommand.of(client: .cursor, serverURL: try serverURL())
        #expect(command == .cursor(json: cursorJSON()))
    }

    @Test func theCursorLinkCarriesThePaddedBase64OfTheServerPercentEncoded() throws {
        let link = AgentCommand.cursorLink(serverURL: try serverURL())
        #expect(link.absoluteString == cursorLink)
        let components = try #require(URLComponents(url: link, resolvingAgainstBaseURL: false))
        let encodedConfig = try #require(components.percentEncodedQueryItems?.first { $0.name == configParameter }?.value)
        let base64 = try #require(encodedConfig.removingPercentEncoding)
        let config = try #require(Data(base64Encoded: base64))
        let decoded = try JSONSerialization.jsonObject(with: config) as? NSDictionary
        #expect(decoded == ["url": serverText])
    }

    @Test(arguments: ["http://localhost:8787", "http://localhost:8787/"])
    func theServerURLIsTheAPIBasePlusMCP(apiBase: String) throws {
        let url = AgentCommand.serverURL(apiBase: try #require(URL(string: apiBase)))
        #expect(url.absoluteString == serverText)
    }

    @Test(arguments: [("com.todesktop.230313mzl4w4u92", true), ("com.apple.Safari", false), (nil, false)])
    func onlyCursorTakesTheCursorLink(bundleIdentifier: String?, isCursor: Bool) {
        #expect(AgentCommand.isCursor(bundleIdentifier: bundleIdentifier) == isCursor)
    }
}
