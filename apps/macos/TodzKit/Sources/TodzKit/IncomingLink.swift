import Foundation

public enum IncomingLink: Equatable, Sendable {
    case signIn(SignInLink)
    case widget(WidgetLink)

    public init?(url: URL) {
        nil
    }
}
