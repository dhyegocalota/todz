import Foundation
import TodzKit

private let linkSchemeKey = "TodzLinkScheme"

enum WidgetLinkConfiguration {
    static var linkScheme: AppLinkScheme {
        guard let scheme = AppLinkScheme.of(bundle: .main) else {
            fatalError("\(linkSchemeKey) is missing from the widget extension's Info.plist or names no link scheme of ours")
        }
        return scheme
    }
}
