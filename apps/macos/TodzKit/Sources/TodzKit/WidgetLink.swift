import Foundation

public enum WidgetLink: Equatable, Sendable {
    case today
    case task(TaskKey)

    public init?(url: URL) {
        fatalError("WidgetLink.init is not implemented")
    }

    public var url: URL {
        fatalError("WidgetLink.url is not implemented")
    }
}
