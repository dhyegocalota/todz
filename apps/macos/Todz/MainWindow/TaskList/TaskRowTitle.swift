import SwiftUI

private let titleLineLimit = 2

struct TaskRowTitle: View {
    let title: String
    let isDone: Bool

    var body: some View {
        Text(title)
            .lineLimit(titleLineLimit)
            .truncationMode(.tail)
            .strikethrough(isDone)
            .foregroundStyle(isDone ? Color.secondary : Color.primary)
    }
}
