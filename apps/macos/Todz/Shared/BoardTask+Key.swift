import TodzKit

extension BoardTask {
    var key: TaskKey {
        TaskKey(projectIdentifier: project.identifier, number: task.number)
    }

    var isDone: Bool {
        task.state == .done
    }
}
