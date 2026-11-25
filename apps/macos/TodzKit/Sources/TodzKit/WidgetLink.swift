import Foundation

let linkScheme = "todz"
private let pathSeparator: Character = "/"
private let taskLinkComponentCount = 2
private let firstTaskNumber = 1
private let pathComponentAllowed = CharacterSet.urlPathAllowed.subtracting(CharacterSet(charactersIn: String(pathSeparator)))
private let encodingFailure = "a Swift string always percent-encodes"
private let linkFailure = "a todz link always has a scheme, a host and an absolute path"

private enum WidgetLinkHost: String {
    case today
    case task
}

private func encoded(_ component: String) -> String {
    guard let encoded = component.addingPercentEncoding(withAllowedCharacters: pathComponentAllowed) else { preconditionFailure(encodingFailure) }
    return encoded
}

public enum WidgetLink: Equatable, Sendable {
    case today
    case task(TaskKey)

    public init?(url: URL, scheme: AppLinkScheme) {
        guard url.scheme == linkScheme, let host = url.host().flatMap(WidgetLinkHost.init(rawValue:)) else { return nil }
        let components = url.path(percentEncoded: true)
            .split(separator: pathSeparator, omittingEmptySubsequences: false)
            .dropFirst()
            .map { $0.removingPercentEncoding }
        switch host {
        case .today:
            guard components.isEmpty else { return nil }
            self = .today
        case .task:
            guard components.count == taskLinkComponentCount, let projectIdentifier = components[0], let numberText = components[1] else { return nil }
            guard !projectIdentifier.isEmpty, let number = Int(numberText), number >= firstTaskNumber else { return nil }
            self = .task(TaskKey(projectIdentifier: projectIdentifier, number: number))
        }
    }

    public func url(scheme: AppLinkScheme) -> URL {
        var components = URLComponents()
        components.scheme = linkScheme
        components.host = host.rawValue
        components.percentEncodedPath = path
        guard let url = components.url else { preconditionFailure(linkFailure) }
        return url
    }

    private var host: WidgetLinkHost {
        switch self {
        case .today: .today
        case .task: .task
        }
    }

    private var path: String {
        switch self {
        case .today: ""
        case let .task(key): [String(), encoded(key.projectIdentifier), String(key.number)].joined(separator: String(pathSeparator))
        }
    }
}
