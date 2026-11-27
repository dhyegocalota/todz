public enum WriteTarget: Hashable, Sendable {
    case newWorkspace
    case workspaceName(workspaceIdentifier: String)
    case workspaceRemoval(workspaceIdentifier: String)
    case newProject
    case projectName(projectIdentifier: String)
    case projectRemoval(projectIdentifier: String)
    case newTask(projectIdentifier: String)
    case taskField(TaskKey, TaskWriteField)
    case taskRemoval(TaskKey)

    var belongsToTheActiveWorkspace: Bool {
        switch self {
        case .newWorkspace, .workspaceName, .workspaceRemoval: false
        case .newProject, .projectName, .projectRemoval, .newTask, .taskField, .taskRemoval: true
        }
    }

    var keepsItsAnswerAcrossASwitch: Bool {
        switch self {
        case .newWorkspace, .workspaceName, .workspaceRemoval, .newProject, .projectName, .projectRemoval: true
        case .newTask, .taskField, .taskRemoval: false
        }
    }

    var goneBanner: AppBanner {
        switch self {
        case .newWorkspace, .workspaceName, .workspaceRemoval, .newProject: .workspaceGone
        case .projectName, .projectRemoval, .newTask, .taskField, .taskRemoval: .projectGone
        }
    }
}
