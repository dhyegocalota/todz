@testable import TodzKit

struct FakeServer {
    let service: FakeOwnerService
    let signals: FakeChangeSignals
}

@MainActor final class FakeServers {
    private(set) var addresses: [ServerAddress] = []
    private(set) var created: [FakeServer] = []
    var onConnect: ((ServerAddress) -> Void)?
    var healthAnswerOfNext = FakeOwnerService.compatibleHealth
    private let first: ServerConnection

    init(service: FakeOwnerService, signals: FakeChangeSignals) {
        first = ServerConnection(service: service, signals: signals)
    }

    func connect(_ address: ServerAddress) -> ServerConnection {
        addresses.append(address)
        onConnect?(address)
        guard addresses.count > 1 else { return first }
        let server = FakeServer(service: FakeOwnerService(), signals: FakeChangeSignals())
        server.service.healthAnswer = healthAnswerOfNext
        created.append(server)
        return ServerConnection(service: server.service, signals: server.signals)
    }
}

@MainActor final class ProbeRecorder {
    private(set) var addresses: [ServerAddress] = []
    var outcome = ServerProbeOutcome.matches

    func probe(_ address: ServerAddress) -> ServerProbeOutcome {
        addresses.append(address)
        return outcome
    }
}
