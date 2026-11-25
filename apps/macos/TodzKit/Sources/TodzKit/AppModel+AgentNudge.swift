extension AppModel {
    public var canChangeAgentNudge: Bool {
        let isKnown = agentNudge != nil
        let isWorthTrying = !isOffline || isAgentNudgeNotSaved
        return isKnown && isOwnerConfirmed && isWorthTrying && !isSavingAgentNudge
    }

    public var agentNudgeNotice: AgentNudgeNotice {
        if case .signedOut = phase { return .signedOut }
        guard !isAgentNudgeNotSaved else { return .notSaved }
        guard !isOffline else { return .offline }
        return .detail
    }

    public func changeAgentNudge(isEnabled: Bool) async {
        guard canChangeAgentNudge, let lastKnown = agentNudge, let savingSession = session else { return }
        agentNudge = isEnabled
        isSavingAgentNudge = true
        isAgentNudgeNotSaved = false
        do {
            let saved = try await request { try await service.updateAgentNudge(session: $0, isEnabled: isEnabled) }
            isSavingAgentNudge = false
            agentNudge = saved.agentNudge
        } catch {
            guard session == savingSession else { return }
            isSavingAgentNudge = false
            agentNudge = lastKnown
            isAgentNudgeNotSaved = true
        }
    }

    public func forgetAgentNudgeFailure() {
        isAgentNudgeNotSaved = false
    }

    func forgetAgentNudge() {
        agentNudge = nil
        isSavingAgentNudge = false
        isAgentNudgeNotSaved = false
    }
}
