import AppIntents
import TodzKit

struct TodzTaskEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Task"
    static let defaultQuery = TodzTaskQuery()

    let id: String
    let title: String
    let projectName: String

    init(task: ShortcutTask) {
        id = task.key.shortcutIdentifier
        title = task.title
        projectName = task.projectName
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(projectName)")
    }
}
