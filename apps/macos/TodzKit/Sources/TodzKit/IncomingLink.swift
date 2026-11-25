import Foundation

public enum IncomingLink: Equatable, Sendable {
    case signIn(SignInLink)
    case widget(WidgetLink)

    public init?(url: URL, scheme: AppLinkScheme) {
        if let signInLink = SignInLink(url: url, scheme: scheme) {
            self = .signIn(signInLink)
            return
        }
        guard let widgetLink = WidgetLink(url: url, scheme: scheme) else { return nil }
        self = .widget(widgetLink)
    }
}
