import TodzKit

struct TaskSection: Identifiable {
    let identifier: String
    let title: String?
    let count: Int?
    let tasks: [BoardTask]
    let hasManualOrder: Bool

    var id: String {
        identifier
    }
}
