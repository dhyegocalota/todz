import TodzKit

enum ChangeSource: Equatable {
    case owner
    case agent(client: String)

    init?(_ actor: ChangeActor) {
        switch actor.kind {
        case .owner:
            self = .owner
        case .agent:
            guard let client = actor.clientName else { return nil }
            self = .agent(client: client)
        }
    }

    func line(owner ownerLine: String, agent agentLine: (String) -> String) -> String {
        switch self {
        case .owner: ownerLine
        case let .agent(client): agentLine(client)
        }
    }
}
