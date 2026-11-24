import SwiftUI

struct TaskSectionHeader: View {
    let section: TaskSection

    var body: some View {
        if let title = section.title {
            HStack {
                Text(title)
                if let count = section.count {
                    Text(count.formatted())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
