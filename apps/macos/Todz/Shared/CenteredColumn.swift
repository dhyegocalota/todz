import SwiftUI

private let screenMinimumWidth: CGFloat = 760
private let screenMinimumHeight: CGFloat = 480

struct CenteredColumn<Content: View>: View {
    private let width: CGFloat?
    private let content: Content

    init(width: CGFloat? = nil, @ViewBuilder content: () -> Content) {
        self.width = width
        self.content = content()
    }

    var body: some View {
        VStack {
            content
        }
        .frame(width: width)
        .frame(minWidth: screenMinimumWidth, maxWidth: .infinity, minHeight: screenMinimumHeight, maxHeight: .infinity)
    }
}
