import TodzKit

extension ChangeActor {
    func line(owner ownerLine: String, agent agentLine: (String) -> String) -> String {
        switch self {
        case .owner: ownerLine
        case let .agent(clientName): agentLine(clientName)
        }
    }
}
