import SwiftUI

extension View {
    func languageDirection() -> some View {
        environment(\.layoutDirection, Localized.language.isRightToLeft ? .rightToLeft : .leftToRight)
    }
}
