public enum ServerAddressIssue: Error, Equatable, Sendable {
    case invalid
    case missingScheme
    case unsupportedScheme
    case missingHost
    case insecureRemoteHost
    case hasPath
    case hasQuery
    case hasFragment
    case hasCredentials
}
