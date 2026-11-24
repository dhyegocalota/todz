import SwiftUI
import TodzKit
import WidgetKit

private let kind = "NextUpWidget"

struct NextUpWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayTimelineProvider()) { entry in
            NextUpView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName(WidgetCopy.nextUpName)
        .description(WidgetCopy.nextUpDescription)
        .supportedFamilies([.systemSmall])
    }
}
