import Foundation

public struct UsageSharing {
    static let tallyDayStorageKey = "usageTallyDay"
    static let tallyCountsStorageKey = "usageTallyCounts"

    private let domain: PersistentDomain
    private let preference: UsageSharingPreference
    private let identifier: UsageInstallIdentifier
    private let timeZone: TimeZone

    public init(defaults: UserDefaults, domainName: String, timeZone: TimeZone, makeIdentifier: @escaping () -> String = { UUID().uuidString.lowercased() }) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
        preference = UsageSharingPreference(defaults: defaults, domainName: domainName)
        identifier = UsageInstallIdentifier(defaults: defaults, domainName: domainName, makeIdentifier: makeIdentifier)
        self.timeZone = timeZone
    }

    public func record(_ event: UsageEvent, at now: Date) {
        guard preference.isOn else { return }
        let today = CalendarDate.today(in: timeZone, at: now).text
        var tally = tally(on: today)
        tally[event.rawValue, default: 0] += 1
        domain.set(today, forKey: Self.tallyDayStorageKey)
        domain.set(tally, forKey: Self.tallyCountsStorageKey)
    }

    public func dueRollup(at now: Date, appVersion: String, macosMajor: Int) -> UsageRollup? {
        guard preference.isOn else { return nil }
        guard let tallyDay = domain.day(forKey: Self.tallyDayStorageKey) else { return nil }
        guard tallyDay < CalendarDate.today(in: timeZone, at: now) else { return nil }
        let events = tally(on: tallyDay.text).compactMap { name, count in UsageEvent(rawValue: name).map { ($0, count) } }
        guard !events.isEmpty else { return nil }
        return UsageRollup(
            installId: identifier.current(at: now),
            appVersion: appVersion,
            macosMajor: macosMajor,
            tally: Dictionary(uniqueKeysWithValues: events)
        )
    }

    public func markSent() {
        domain.set([String: Int](), forKey: Self.tallyCountsStorageKey)
    }

    private func tally(on day: String) -> [String: Int] {
        guard domain.value(forKey: Self.tallyDayStorageKey) as? String == day else { return [:] }
        guard let stored = domain.value(forKey: Self.tallyCountsStorageKey) as? [String: Int] else { return [:] }
        return stored
    }
}
