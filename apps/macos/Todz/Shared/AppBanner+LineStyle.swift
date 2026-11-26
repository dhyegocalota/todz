import SwiftUI
import TodzKit

extension AppBanner {
    var lineStyle: AnyShapeStyle {
        isCalm ? AnyShapeStyle(.secondary) : AnyShapeStyle(.red)
    }
}
