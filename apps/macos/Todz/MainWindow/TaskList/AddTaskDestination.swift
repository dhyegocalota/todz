import TodzKit

struct AddTaskDestination: Hashable {
    let projectIdentifier: String
    let dueDate: CalendarDate?

    var target: WriteTarget {
        .newTask(projectIdentifier: projectIdentifier)
    }
}
