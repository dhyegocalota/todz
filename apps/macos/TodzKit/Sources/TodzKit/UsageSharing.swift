import Foundation

private let unsentDaysMax = 7

public struct UsageSharing {
    static let talliesStorageKey = "usageTallies"

    private let domain: PersistentDomain
    private let preference: UsageSharingPreference
    private let identifier: UsageInstallIdentifier
    private let timeZone: TimeZone
    private let defaults: UserDefaults

    public init(defaults: UserDefaults, domainName: String, timeZone: TimeZone, makeIdentifier: @escaping () -> String = { UUID().uuidString.lowercased() }) {
        self.defaults = defaults
        domain = PersistentDomain(defaults: defaults, name: domainName)
        preference = UsageSharingPreference(defaults: defaults, domainName: domainName)
        identifier = UsageInstallIdentifier(defaults: defaults, domainName: domainName, makeIdentifier: makeIdentifier)
        self.timeZone = timeZone
    }

    public func record(_ event: UsageEvent, at now: Date) {
        guard preference.isOn else { return }
        let today = CalendarDate.today(in: timeZone, at: now)
        var tallies = tallies()
        tallies[today.text, default: [:]][event.rawValue, default: 0] += 1
        store(unsentDaysKept(tallies, today: today))
    }

    public func dueRollup(at now: Date, appVersion: String, macosMajor: Int) -> UsageRollup? {
        guard preference.isOn else { return nil }
        let today = CalendarDate.today(in: timeZone, at: now)
        let pastDays = tallies().keys.compactMap(CalendarDate.init(text:)).filter { $0 < today }.sorted()
        guard let oldest = pastDays.first else { return nil }
        let events = tallies()[oldest.text, default: [:]].compactMap { name, count in UsageEvent(rawValue: name).map { ($0, count) } }
        guard !events.isEmpty else { return nil }
        return UsageRollup(
            installId: identifier.current(at: now),
            appVersion: appVersion,
            macosMajor: macosMajor,
            tally: Dictionary(uniqueKeysWithValues: events)
        )
    }

    public func markSent() {
        var tallies = tallies()
        guard let oldest = tallies.keys.compactMap(CalendarDate.init(text:)).min() else { return }
        tallies[oldest.text] = nil
        store(tallies)
    }

    private func unsentDaysKept(_ tallies: [String: [String: Int]], today: CalendarDate) -> [String: [String: Int]] {
        let pastDays = tallies.keys.compactMap(CalendarDate.init(text:)).filter { $0 < today }.sorted()
        let expired = pastDays.dropLast(unsentDaysMax)
        return tallies.filter { name, _ in !expired.contains { $0.text == name } }
    }

    private func tallies() -> [String: [String: Int]] {
        guard let stored = domain.value(forKey: Self.talliesStorageKey) as? [String: [String: Int]] else { return [:] }
        return stored
    }

    private func store(_ tallies: [String: [String: Int]]) {
        defaults.set(tallies, forKey: Self.talliesStorageKey)
    }
}
