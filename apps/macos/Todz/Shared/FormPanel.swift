import SwiftUI

struct FormPanel<Content: View>: View {
    private let width: CGFloat
    private let content: Content

    init(width: CGFloat, @ViewBuilder content: () -> Content) {
        self.width = width
        self.content = content()
    }

    var body: some View {
        VStack {
            content
        }
        .frame(width: width)
        .padding()
        .padding()
        .modifier(GlassSurface(cornerRadius: FormMetrics.panelCornerRadius))
        .controlSize(.large)
        .todzEntrance()
    }
}
