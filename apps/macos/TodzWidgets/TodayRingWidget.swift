import SwiftUI
import TodzKit
import WidgetKit

private let kind = "TodayRingWidget"

struct TodayRingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayTimelineProvider()) { entry in
            TodayRing(content: entry.content(of: .small))
                .widgetURL(WidgetLink.today.url)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName(WidgetCopy.ringName)
        .description(WidgetCopy.ringDescription)
        .supportedFamilies([.systemSmall])
    }
}
