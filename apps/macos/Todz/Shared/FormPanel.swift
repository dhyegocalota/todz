import SwiftUI

struct FormPanel<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack {
            content
        }
        .padding()
        .padding()
        .modifier(GlassSurface(cornerRadius: FormMetrics.panelCornerRadius))
        .controlSize(.large)
        .todzEntrance()
    }
}
