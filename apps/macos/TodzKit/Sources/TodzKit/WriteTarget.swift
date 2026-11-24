public enum WriteTarget: Hashable, Sendable {
    case newWorkspace
    case newProject
    case projectName(projectIdentifier: String)
    case newTask(projectIdentifier: String)
    case taskField(TaskKey, TaskWriteField)

    var belongsToTheActiveWorkspace: Bool {
        switch self {
        case .newWorkspace: false
        case .newProject, .projectName, .newTask, .taskField: true
        }
    }

    var goneBanner: AppBanner {
        switch self {
        case .newWorkspace, .newProject: .workspaceGone
        case .projectName, .newTask, .taskField: .projectGone
        }
    }
}
