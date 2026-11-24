import Foundation

public enum PendingChange: Codable, Sendable, Equatable {
    case add(projectIdentifier: String, draft: TaskDraft)
    case field(TaskKey, TaskPatch)
    case state(TaskKey, TaskState, at: Date)

    enum CodingKeys: String, CodingKey {
        case kind
        case projectIdentifier
        case draft
        case taskKey
        case patch
        case state
        case at
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(PendingChangeKind.self, forKey: .kind) {
        case .add:
            self = .add(
                projectIdentifier: try container.decode(String.self, forKey: .projectIdentifier),
                draft: try container.decode(TaskDraft.self, forKey: .draft)
            )
        case .field:
            self = .field(try container.decode(TaskKey.self, forKey: .taskKey), try container.decode(TaskPatch.self, forKey: .patch))
        case .state:
            self = .state(
                try container.decode(TaskKey.self, forKey: .taskKey),
                try container.decode(TaskState.self, forKey: .state),
                at: try container.decode(Date.self, forKey: .at)
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .add(projectIdentifier, draft):
            try container.encode(PendingChangeKind.add, forKey: .kind)
            try container.encode(projectIdentifier, forKey: .projectIdentifier)
            try container.encode(draft, forKey: .draft)
        case let .field(taskKey, patch):
            try container.encode(PendingChangeKind.field, forKey: .kind)
            try container.encode(taskKey, forKey: .taskKey)
            try container.encode(patch, forKey: .patch)
        case let .state(taskKey, state, at):
            try container.encode(PendingChangeKind.state, forKey: .kind)
            try container.encode(taskKey, forKey: .taskKey)
            try container.encode(state, forKey: .state)
            try container.encode(at, forKey: .at)
        }
    }

    public var projectIdentifier: String {
        switch self {
        case let .add(projectIdentifier, _): projectIdentifier
        case let .field(taskKey, _), let .state(taskKey, _, _): taskKey.projectIdentifier
        }
    }

    public var taskKey: TaskKey? {
        switch self {
        case .add: nil
        case let .field(taskKey, _), let .state(taskKey, _, _): taskKey
        }
    }

    public var writeField: TaskWriteField? {
        switch self {
        case .add: nil
        case let .field(_, patch): patch.writeField
        case .state: .state
        }
    }
}
