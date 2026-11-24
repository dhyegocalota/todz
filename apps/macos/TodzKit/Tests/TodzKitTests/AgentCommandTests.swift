import Foundation
import Testing
@testable import TodzKit

private let serverText = "http://localhost:8787/mcp"
private let secret = OwnerFixtures.keySecret
private let placeholder = "<new key>"
private let base64PlusSlashSecret = "todz_???>>>~~~b"
private let configParameter = "config"
private let issuedKeyIdentifier = "key-1"
private let secretsOutsideTodzAndBase64URL = ["todz_ab'cd", "todz_ab;cd", "todz_ab\ncd", "todz_ab'c;d\ne", "todz_", "key_abcd"]

private let cursorLinkPrefix = "cursor://anysphere.cursor-deeplink/mcp/install?name=todz&config="
private let secretLink =
    cursorLinkPrefix
    + "eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg3ODcvbWNwIiwiaGVhZGVycyI6eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyIHRvZHpfeU1uS3k4ek56c19RMGRMVDFOWFcx"
    + "OWpaMnR2YzNkN2Y0T0hpNC1UbDV1YyJ9fQ%3D%3D"
private let plusSlashLink =
    cursorLinkPrefix
    + "eyJ1cmwiOiJodHRwOi8vbG9jYWxob3N0Ojg3ODcvbWNwIiwiaGVhZGVycyI6eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyIHRvZHpfPz8%2FPj4%2Bfn5%2BYiJ9fQ%3D%3D"

private func cursorJSON(key: String) -> String {
    """
    {
      "mcpServers": {
        "todz": {
          "url": "\(serverText)",
          "headers": {
            "Authorization": "Bearer \(key)"
          }
        }
      }
    }
    """
}

private func codexConfiguration() -> String {
    """
    [mcp_servers.todz]
    url = "\(serverText)"
    bearer_token_env_var = "TODZ_API_KEY"
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

    @Test func claudeCodeIsOneLineWithTheKeyInABearerHeader() throws {
        let command = AgentCommand.of(client: .claudeCode, serverURL: try serverURL(), key: secret)
        #expect(command == .claudeCode(line: "claude mcp add --transport http todz '\(serverText)' --header 'Authorization: Bearer \(secret)'"))
    }

    @Test func codexIsAConfigurationTableAndAShellLine() throws {
        let command = AgentCommand.of(client: .codex, serverURL: try serverURL(), key: secret)
        #expect(command == .codex(configuration: codexConfiguration(), shellLine: "export TODZ_API_KEY='\(secret)'"))
    }

    @Test func cursorIsTheMCPJSONIndentedByTwoSpaces() throws {
        let command = AgentCommand.of(client: .cursor, serverURL: try serverURL(), key: secret)
        #expect(command == .cursor(json: cursorJSON(key: secret)))
    }

    @Test func thePlaceholderTakesTheKeysPlaceInEveryClient() throws {
        let url = try serverURL()
        #expect(
            AgentCommand.of(client: .claudeCode, serverURL: url, key: placeholder)
                == .claudeCode(line: "claude mcp add --transport http todz '\(serverText)' --header 'Authorization: Bearer <new key>'")
        )
        #expect(
            AgentCommand.of(client: .codex, serverURL: url, key: placeholder)
                == .codex(configuration: codexConfiguration(), shellLine: "export TODZ_API_KEY='<new key>'")
        )
        #expect(AgentCommand.of(client: .cursor, serverURL: url, key: placeholder) == .cursor(json: cursorJSON(key: placeholder)))
    }

    @Test func theCursorLinkCarriesThePaddedBase64OfTheServerPercentEncoded() throws {
        let link = AgentCommand.cursorLink(serverURL: try serverURL(), secret: secret)
        #expect(link.absoluteString == secretLink)
    }

    @Test func theCursorLinkEncodesPlusSlashAndEqualsAndDecodesBackToTheServer() throws {
        let link = AgentCommand.cursorLink(serverURL: try serverURL(), secret: base64PlusSlashSecret)
        #expect(link.absoluteString == plusSlashLink)
        let components = try #require(URLComponents(url: link, resolvingAgainstBaseURL: false))
        let encodedConfig = try #require(components.percentEncodedQueryItems?.first { $0.name == configParameter }?.value)
        let base64 = try #require(encodedConfig.removingPercentEncoding)
        let config = try #require(Data(base64Encoded: base64))
        let decoded = try JSONSerialization.jsonObject(with: config) as? NSDictionary
        let expected: NSDictionary = ["url": serverText, "headers": ["Authorization": "Bearer \(base64PlusSlashSecret)"]]
        #expect(decoded == expected)
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

    @Test(arguments: secretsOutsideTodzAndBase64URL)
    func anIssuedKeyWhoseSecretTheQuotingWouldBreakOnIsRefused(refusedSecret: String) throws {
        let encodedSecret = try #require(String(data: try JSONEncoder().encode(refusedSecret), encoding: .utf8))
        let json = "{\"key\":\(OwnerFixtures.projectKeyJSON(identifier: issuedKeyIdentifier)),\"secret\":\(encodedSecret)}"
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(IssuedKey.self, from: json) }
    }
}
