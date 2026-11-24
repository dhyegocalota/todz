import SwiftUI
import TodzKit

struct TaskRowSubline: View {
    let details: TaskRowDetails

    var body: some View {
        HStack {
            if let projectTag = details.projectTag {
                Text(projectTag)
                    .background(.fill.quaternary)
            }
            if let dueDate = details.dueDate {
                DueLabel(dueDate: dueDate)
            }
            if let actor = details.actor {
                Text(actor)
            }
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .truncationMode(.tail)
    }
}
