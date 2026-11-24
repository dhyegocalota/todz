import TodzKit

struct LingeringTasks {
    let entries: [(index: Int, task: BoardTask)]

    var keys: Set<TaskKey> {
        Set(entries.map(\.task.key))
    }

    func placed(into tasks: [BoardTask]) -> [BoardTask] {
        entries.reduce(tasks) { shown, entry in
            let isShown = shown.contains { $0.key == entry.task.key }
            guard !isShown else { return shown }
            var placed = shown
            placed.insert(entry.task, at: min(entry.index, shown.count))
            return placed
        }
    }
}
