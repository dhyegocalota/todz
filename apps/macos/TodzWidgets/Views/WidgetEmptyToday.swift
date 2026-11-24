import SwiftUI

struct WidgetEmptyToday: View {
    var body: some View {
        VStack {
            Text(MainWindowCopy.todayEmptyTitle)
            Text(MainWindowCopy.todayEmptyBody)
                .font(.subheadline)
        }
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
