import Foundation

public enum PendingChange: Codable, Sendable, Equatable {
    case add(projectIdentifier: String, draft: TaskDraft)
    case field(TaskKey, TaskPatch)
    case state(TaskKey, TaskState, at: Date)

    public init(from decoder: any Decoder) throws {
        throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "PendingChange is not implemented"))
    }

    public func encode(to encoder: any Encoder) throws {
        throw EncodingError.invalidValue(self, EncodingError.Context(codingPath: encoder.codingPath, debugDescription: "PendingChange is not implemented"))
    }

    public var projectIdentifier: String {
        fatalError("PendingChange.projectIdentifier is not implemented")
    }

    public var taskKey: TaskKey? {
        fatalError("PendingChange.taskKey is not implemented")
    }

    public var writeField: TaskWriteField? {
        fatalError("PendingChange.writeField is not implemented")
    }
}
