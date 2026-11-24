import Foundation
import TodzKit
import WidgetKit

struct TodayTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        .sample(at: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        let entry = TodayEntry(date: .now, snapshot: storedSnapshot())
        let showsSample = context.isPreview && entry.snapshot == nil
        guard showsSample else { return completion(entry) }
        completion(.sample(at: entry.date))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let current = TodayEntry(date: .now, snapshot: storedSnapshot())
        let midnight = current.nextMidnight.map { TodayEntry(date: $0, snapshot: current.snapshot) }
        let entries = [current] + [midnight].compactMap(\.self)
        completion(Timeline(entries: entries, policy: .never))
    }

    private func storedSnapshot() -> WidgetSnapshot? {
        guard let store = FileWidgetStore.shared else { return nil }
        return try? store.readSnapshot()
    }
}
