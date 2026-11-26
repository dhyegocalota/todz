extension AppModel {
    public func refreshOwnerSettings() async {
        let canRead = session != nil && isOwnerConfirmed && !isReadingOwnerSettings
        guard canRead else { return }
        isReadingOwnerSettings = true
        defer { isReadingOwnerSettings = false }
        let wasSavingAgentNudge = isSavingAgentNudge
        let wasSavingDayEmail = isSavingDayEmail
        let agentNudgeSavesBefore = agentNudgeSavesStarted
        let dayEmailSavesBefore = dayEmailSavesStarted
        guard let owner = try? await request({ try await service.readOwner(session: $0) }) else { return }
        let isAgentNudgeSaved = wasSavingAgentNudge || agentNudgeSavesStarted != agentNudgeSavesBefore
        let isDayEmailSaved = wasSavingDayEmail || dayEmailSavesStarted != dayEmailSavesBefore
        if !isAgentNudgeSaved { agentNudge = owner.agentNudge }
        guard !isDayEmailSaved else { return }
        dayEmail = owner.dayEmail
        dayEmailMinutes = owner.dayEmailMinutes
    }
}
