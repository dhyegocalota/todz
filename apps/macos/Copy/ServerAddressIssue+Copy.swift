import TodzKit

extension ServerAddressIssue {
    var copy: String {
        switch self {
        case .invalid: ErrorCopy.serverAddressInvalid
        case .missingScheme, .unsupportedScheme: ErrorCopy.serverSchemeMissing
        case .missingHost: ErrorCopy.serverHostMissing
        case .insecureRemoteHost: ErrorCopy.serverInsecureRemoteHost
        case .hasPath: ErrorCopy.serverAddressHasPath
        case .hasQuery: ErrorCopy.serverAddressHasQuery
        case .hasFragment: ErrorCopy.serverAddressHasFragment
        case .hasCredentials: ErrorCopy.serverAddressHasCredentials
        }
    }
}
