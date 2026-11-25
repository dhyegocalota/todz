import SwiftUI
import TodzKit

struct LeftTodaySnippet: View {
    let today: ShortcutToday

    var body: some View {
        TodayDigest(
            openCount: today.content.openCount,
            subtitle: today.workspaceName,
            rows: today.content.rows,
            restCount: today.content.restCount
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AccessibilityCopy.morningGlance(count: today.content.openCount))
        .accessibilityValue(today.content.rows.map(\.title).joined(separator: ", "))
    }
}
