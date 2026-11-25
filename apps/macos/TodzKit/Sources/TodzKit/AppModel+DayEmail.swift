extension AppModel {
    public var canChangeDayEmail: Bool {
        let isKnown = dayEmail != nil && dayEmailMinutes != nil
        let isWorthTrying = !isOffline || isDayEmailNotSaved
        return isKnown && isOwnerConfirmed && isWorthTrying && !isSavingDayEmail
    }

    public var dayEmailNotice: OwnerSettingNotice {
        if case .signedOut = phase { return .signedOut }
        guard !isDayEmailNotSaved else { return .notSaved }
        guard !isOffline else { return .offline }
        return .detail
    }

    public func changeDayEmail(isEnabled: Bool) async {
        await saveDayEmail(
            change: { dayEmail = isEnabled },
            send: { try await service.updateDayEmail(session: $0, isEnabled: isEnabled) }
        )
    }

    public func changeDayEmail(minutes: Int) async {
        await saveDayEmail(
            change: { dayEmailMinutes = minutes },
            send: { try await service.updateDayEmailMinutes(session: $0, minutes: minutes) }
        )
    }

    public func forgetDayEmailFailure() {
        isDayEmailNotSaved = false
    }

    func forgetDayEmail() {
        dayEmail = nil
        dayEmailMinutes = nil
        isSavingDayEmail = false
        isDayEmailNotSaved = false
    }

    private func saveDayEmail(change: () -> Void, send: (String) async throws -> Owner) async {
        guard canChangeDayEmail, let lastEnabled = dayEmail, let lastMinutes = dayEmailMinutes, let savingSession = session else { return }
        change()
        isSavingDayEmail = true
        isDayEmailNotSaved = false
        do {
            let saved = try await request(send)
            isSavingDayEmail = false
            dayEmail = saved.dayEmail
            dayEmailMinutes = saved.dayEmailMinutes
        } catch {
            guard session == savingSession else { return }
            isSavingDayEmail = false
            dayEmail = lastEnabled
            dayEmailMinutes = lastMinutes
            isDayEmailNotSaved = true
        }
    }
}
