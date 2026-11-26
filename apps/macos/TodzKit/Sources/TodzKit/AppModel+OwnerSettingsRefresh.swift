import Foundation

extension AppModel {
    public func refreshOwnerSettings() async {
        guard session != nil, isOwnerConfirmed, ownerSettingsReadIdentifier == nil else { return }
        let readIdentifier = UUID()
        ownerSettingsReadIdentifier = readIdentifier
        defer { if ownerSettingsReadIdentifier == readIdentifier { ownerSettingsReadIdentifier = nil } }
        let wasSavingAgentNudge = isSavingAgentNudge
        let wasSavingDayEmail = isSavingDayEmail
        let agentNudgeSavesBefore = agentNudgeSavesStarted
        let dayEmailSavesBefore = dayEmailSavesStarted
        guard let owner = try? await request({ try await service.readOwner(session: $0) }) else { return }
        let isAgentNudgeSaveRacing = wasSavingAgentNudge || agentNudgeSavesStarted != agentNudgeSavesBefore
        let isDayEmailSaveRacing = wasSavingDayEmail || dayEmailSavesStarted != dayEmailSavesBefore
        if !isAgentNudgeSaveRacing { agentNudge = owner.agentNudge }
        guard !isDayEmailSaveRacing else { return }
        dayEmail = owner.dayEmail
        dayEmailMinutes = owner.dayEmailMinutes
    }
}
