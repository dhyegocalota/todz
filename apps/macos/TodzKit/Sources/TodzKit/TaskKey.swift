public struct TaskKey: Hashable, Sendable {
    public let projectIdentifier: String
    public let number: Int

    public init(projectIdentifier: String, number: Int) {
        self.projectIdentifier = projectIdentifier
        self.number = number
    }
}
