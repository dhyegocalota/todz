public enum WriteTarget: Hashable, Sendable {
    case newWorkspace
    case newProject
    case projectName(projectIdentifier: String)
    case newTask(projectIdentifier: String)
    case taskField(TaskKey, TaskWriteField)

    var goneBanner: AppBanner {
        switch self {
        case .newWorkspace, .newProject: .workspaceGone
        case .projectName, .newTask, .taskField: .projectGone
        }
    }
}
