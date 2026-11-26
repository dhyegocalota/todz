import Foundation

public struct WidgetRequest: Codable, Equatable, Sendable {
    public let projectIdentifier: String
    public let number: Int
    public let state: TaskState
    public let at: Date
    public let workspaceIdentifier: String?

    public init(projectIdentifier: String, number: Int, state: TaskState, at: Date, workspaceIdentifier: String? = nil) {
        self.projectIdentifier = projectIdentifier
        self.number = number
        self.state = state
        self.at = at
        self.workspaceIdentifier = workspaceIdentifier
    }
}
