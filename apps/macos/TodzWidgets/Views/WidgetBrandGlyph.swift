import SwiftUI

private let brandGlyphName = "MenuBarGlyph"
private let brandGlyphSide: CGFloat = 16
private let brandGlyphLayoutPriority = 1.0

struct WidgetBrandGlyph: View {
    var body: some View {
        Image(brandGlyphName)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(width: brandGlyphSide, height: brandGlyphSide)
            .foregroundStyle(Color.accentColor)
            .widgetAccentable()
            .unredacted()
            .layoutPriority(brandGlyphLayoutPriority)
            .accessibilityHidden(true)
    }
}
