import TodzKit

extension WidgetSnapshotTask {
    var key: TaskKey? {
        guard let number else { return nil }
        return TaskKey(projectIdentifier: projectIdentifier, number: number)
    }

    var isDone: Bool {
        state == .done
    }
}
