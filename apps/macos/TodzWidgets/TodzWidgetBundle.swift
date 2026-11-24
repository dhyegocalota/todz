import SwiftUI
import WidgetKit

@main
struct TodzWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayRingWidget()
        NextUpWidget()
        TodayListWidget()
    }
}
