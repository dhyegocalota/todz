import SwiftUI
import TodzKit
import WidgetKit

private let kind = "TodayListWidget"

struct TodayListWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayTimelineProvider()) { entry in
            TodayListView(entry: entry)
                .widgetURL(WidgetLink.today.url(scheme: AppLinkScheme.required(bundle: .main)))
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName(MainWindowCopy.today)
        .description(WidgetCopy.listDescription)
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
