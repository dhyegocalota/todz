import Foundation

public struct WidgetRequest: Codable, Equatable, Sendable {
    public let projectIdentifier: String
    public let number: Int
    public let state: TaskState
    public let at: Date

    public init(projectIdentifier: String, number: Int, state: TaskState, at: Date) {
        self.projectIdentifier = projectIdentifier
        self.number = number
        self.state = state
        self.at = at
    }
}
