import Foundation

public enum IncomingLink: Equatable, Sendable {
    case signIn(SignInLink)
    case widget(WidgetLink)

    public init?(url: URL) {
        if let signInLink = SignInLink(url: url) {
            self = .signIn(signInLink)
            return
        }
        guard let widgetLink = WidgetLink(url: url) else { return nil }
        self = .widget(widgetLink)
    }
}
