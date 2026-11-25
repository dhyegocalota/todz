import Foundation

private let secureScheme = "https"
private let plainScheme = "http"
private let defaultPortOfScheme = [secureScheme: 443, plainScheme: 80]
private let loopbackHosts: Set<String> = ["localhost", "127.0.0.1", "::1"]
private let rootPaths: Set<String> = ["", "/"]
private let addressBrackets = CharacterSet(charactersIn: "[]")
private let schemeSeparator = "://"
private let portSeparator = ":"

private func authorityText(host: String, port: Int?, defaultPort: Int) -> String {
    let hostLabel = host.contains(portSeparator) ? "[\(host)]" : host
    guard let port, port != defaultPort else { return hostLabel }
    return "\(hostLabel)\(portSeparator)\(port)"
}

public struct ServerAddress:Equatable, Sendable {
    public let origin: String
    public let authority: String
    public let url: URL

    public static func checked(text: String) -> Result<ServerAddress, ServerAddressIssue> {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let isSingleWord = !trimmed.isEmpty && !trimmed.contains(where: \.isWhitespace)
        guard isSingleWord, let components = URLComponents(string: trimmed) else { return .failure(.invalid) }
        guard let scheme = components.scheme?.lowercased() else { return .failure(.missingScheme) }
        guard let defaultPort = defaultPortOfScheme[scheme] else { return .failure(.unsupportedScheme) }
        guard let host = components.host?.lowercased().trimmingCharacters(in: addressBrackets), !host.isEmpty else { return .failure(.missingHost) }
        guard components.user == nil, components.password == nil else { return .failure(.hasCredentials) }
        guard scheme == secureScheme || loopbackHosts.contains(host) else { return .failure(.insecureRemoteHost) }
        guard rootPaths.contains(components.path) else { return .failure(.hasPath) }
        guard components.query == nil else { return .failure(.hasQuery) }
        guard components.fragment == nil else { return .failure(.hasFragment) }
        let authority = authorityText(host: host, port: components.port, defaultPort: defaultPort)
        let origin = scheme + schemeSeparator + authority
        guard let url = URL(string: origin) else { return .failure(.invalid) }
        return .success(ServerAddress(origin: origin, authority: authority, url: url))
    }
}
