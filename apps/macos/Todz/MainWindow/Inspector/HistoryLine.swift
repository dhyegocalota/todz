import SwiftUI
import TodzKit

struct HistoryLine: View {
    let entry: HistoryEntry
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(DayFormat.moment(instant: entry.at, timeZone: model.timeZone))
                .monospacedDigit()
                .foregroundStyle(.secondary)
            VStack(alignment: .leading) {
                Text(entry.sentence)
                if let note = entry.note {
                    Text(note)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .font(.callout)
        .accessibilityElement(children: .combine)
    }
}
